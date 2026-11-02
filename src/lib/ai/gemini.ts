import 'server-only'
import { GoogleGenAI, ApiError } from '@google/genai'
import { z } from 'zod'
import { env } from '@/lib/env'
import { AppError } from '@/lib/errors'
import { withUser } from '@/lib/db'
import type { AiFeature } from '@/lib/db/types'
import type { TenantContext } from '@/lib/auth/session'
import { assertAiQuota, getEntitlements } from '@/lib/licensing/entitlements'
import { rateLimit } from '@/lib/security/rate-limit'
import { GROUNDING_RULES } from './prompts/shared'

/** Minimal surface of the SDK we use — lets tests inject a fake model. */
export type ModelClient = {
  generate(req: { model: string; system: string; prompt: string; jsonSchema: unknown; temperature: number; maxOutputTokens: number; timeoutMs: number }): Promise<{
    text: string
    usage: { input: number; output: number; total: number }
  }>
}

export type StructuredRequest<T> = {
  feature: AiFeature
  promptVersion: string
  schema: z.ZodType<T>
  system: string
  prompt: string
  temperature?: number
  maxOutputTokens?: number
}

export type StructuredResult<T> = { data: T; model: string; usage: { input: number; output: number; total: number }; attempts: number; latencyMs: number }

const ALLOWED_SCHEMA_KEYS = new Set(['type', 'properties', 'required', 'items', 'enum', 'description', 'minItems', 'maxItems', 'minimum', 'maximum', 'format'])

/**
 * Converts a Zod schema to the JSON-Schema subset Gemini accepts. Zod still
 * enforces the full schema (lengths, refinements) after generation.
 */
export function toGeminiSchema(schema: z.ZodType): unknown {
  const json = z.toJSONSchema(schema, { target: 'draft-2020-12', unrepresentable: 'any' })
  const strip = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(strip)
    if (!node || typeof node !== 'object') return node
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (!ALLOWED_SCHEMA_KEYS.has(k)) continue
      if (k === 'properties') out[k] = Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([pk, pv]) => [pk, strip(pv)]))
      else if (k === 'format' && !['date-time', 'date', 'enum'].includes(String(v))) continue
      else out[k] = strip(v)
    }
    return out
  }
  return strip(json)
}

export function isRetryable(err: unknown): boolean {
  if (err instanceof ApiError) return [408, 429, 500, 502, 503, 504].includes(err.status)
  const e = err as { name?: string; code?: string; status?: number }
  if (typeof e?.status === 'number') return [408, 429, 500, 502, 503, 504].includes(e.status)
  return e?.name === 'AbortError' || e?.name === 'TimeoutError' || ['ECONNRESET', 'ETIMEDOUT', 'UND_ERR_SOCKET', 'EAI_AGAIN'].includes(e?.code ?? '')
}

export function errorCode(err: unknown): string {
  if (err instanceof ApiError) return `http_${err.status}`
  if (err instanceof z.ZodError) return 'invalid_output'
  if (err instanceof SyntaxError) return 'invalid_json'
  const e = err as { name?: string }
  if (e?.name === 'AbortError' || e?.name === 'TimeoutError') return 'timeout'
  return 'unknown'
}

/** Parses model text as JSON (tolerating code fences) and validates it. */
export function parseStructured<T>(text: string, schema: z.ZodType<T>): T {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  return schema.parse(JSON.parse(trimmed))
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Calls the model with retries for transient failures and one corrective
 * retry for malformed/invalid output. Pure with respect to the database.
 */
export async function callWithRetry<T>(
  client: ModelClient,
  req: StructuredRequest<T>,
  opts: { model: string; timeoutMs: number; maxAttempts?: number; backoffMs?: number },
): Promise<StructuredResult<T>> {
  const maxAttempts = opts.maxAttempts ?? 3
  const started = Date.now()
  const jsonSchema = toGeminiSchema(req.schema)
  let lastErr: unknown
  let prompt = req.prompt
  let validationRetried = false
  const usage = { input: 0, output: 0, total: 0 }
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await client.generate({
        model: opts.model,
        system: `${req.system}\n\n${GROUNDING_RULES}`,
        prompt,
        jsonSchema,
        temperature: req.temperature ?? 0.4,
        maxOutputTokens: req.maxOutputTokens ?? 8192,
        timeoutMs: opts.timeoutMs,
      })
      usage.input += res.usage.input
      usage.output += res.usage.output
      usage.total += res.usage.total
      try {
        const data = parseStructured(res.text, req.schema)
        return { data, model: opts.model, usage, attempts: attempt, latencyMs: Date.now() - started }
      } catch (err) {
        lastErr = err
        if (validationRetried) throw err
        validationRetried = true
        const detail = err instanceof z.ZodError ? err.issues.slice(0, 5).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') : 'response was not valid JSON'
        prompt = `${req.prompt}\n\nYour previous response was rejected (${detail}). Return only JSON that matches the schema exactly.`
        continue
      }
    } catch (err) {
      lastErr = err
      if (err instanceof z.ZodError || err instanceof SyntaxError) break
      if (!isRetryable(err) || attempt === maxAttempts) break
      const base = opts.backoffMs ?? 800
      await sleep(base * 2 ** (attempt - 1) + Math.random() * base)
    }
  }
  throw Object.assign(new Error('AI generation failed'), { cause: lastErr, usage, latencyMs: Date.now() - started })
}

export function geminiClient(apiKey: string): ModelClient {
  const ai = new GoogleGenAI({ apiKey })
  return {
    async generate(req) {
      const res = await ai.models.generateContent({
        model: req.model,
        contents: [{ role: 'user', parts: [{ text: req.prompt }] }],
        config: {
          systemInstruction: req.system,
          responseMimeType: 'application/json',
          responseJsonSchema: req.jsonSchema,
          temperature: req.temperature,
          maxOutputTokens: req.maxOutputTokens,
          httpOptions: { timeout: req.timeoutMs },
          abortSignal: AbortSignal.timeout(req.timeoutMs + 2000),
        },
      })
      const u = res.usageMetadata
      return { text: res.text ?? '', usage: { input: u?.promptTokenCount ?? 0, output: u?.candidatesTokenCount ?? 0, total: u?.totalTokenCount ?? 0 } }
    },
  }
}

let testClient: ModelClient | null = null
/** Tests only. */
export function __setModelClient(c: ModelClient | null) {
  testClient = c
}

export function isAiConfigured(): boolean {
  return Boolean(testClient || env().GEMINI_API_KEY)
}

/**
 * The single entry point for AI generation. Enforces configuration, plan
 * quota and rate limits, then logs usage (success or failure) for the
 * organization. Prompts never contain secrets; logs never contain prompts.
 */
export async function generateStructured<T>(ctx: TenantContext, req: StructuredRequest<T>): Promise<StructuredResult<T>> {
  const e = env()
  if (!testClient && !e.GEMINI_API_KEY) {
    throw new AppError('not_configured', 'AI generation is not configured. Set GEMINI_API_KEY on the server.')
  }
  await rateLimit({ key: `ai:${ctx.userId}`, limit: 20, windowSeconds: 300, message: 'You are generating content very quickly. Please wait a few minutes.' })
  const ent = await getEntitlements(ctx.orgId)
  await withUser(ctx.userId, (tx) => assertAiQuota(tx, ctx.orgId, ent))

  const client = testClient ?? geminiClient(e.GEMINI_API_KEY!)
  const model = e.GEMINI_MODEL
  try {
    const result = await callWithRetry(client, req, { model, timeoutMs: e.GEMINI_TIMEOUT_MS })
    await logUsage(ctx, req, model, 'success', null, result.usage, result.latencyMs, result.attempts)
    return result
  } catch (err) {
    const cause = (err as { cause?: unknown }).cause ?? err
    const code = errorCode(cause)
    const meta = err as { usage?: StructuredResult<T>['usage']; latencyMs?: number }
    console.error(`[ai] ${req.feature} failed (${code}) org=${ctx.orgId}`)
    await logUsage(ctx, req, model, 'error', code, meta.usage ?? { input: 0, output: 0, total: 0 }, meta.latencyMs ?? 0, 0).catch(() => undefined)
    const message =
      code === 'http_429'
        ? 'The AI provider is rate limiting requests. Please try again in a minute.'
        : code === 'timeout'
          ? 'The AI provider took too long to respond. Please try again.'
          : code === 'invalid_output' || code === 'invalid_json'
            ? 'The AI response did not pass validation. Please try again.'
            : code === 'http_400' || code === 'http_403' || code === 'http_401'
              ? 'The AI provider rejected the request. Check the Gemini API key and model configuration.'
              : 'AI generation failed. Please try again.'
    throw new AppError('ai_failed', message, { cause })
  }
}

async function logUsage(ctx: TenantContext, req: StructuredRequest<unknown>, model: string, status: 'success' | 'error', code: string | null, usage: { input: number; output: number; total: number }, latencyMs: number, attempts: number) {
  await withUser(ctx.userId, (tx) =>
    tx
      .insertInto('ai_usage_logs')
      .values({
        organization_id: ctx.orgId,
        user_id: ctx.userId,
        feature: req.feature,
        model,
        prompt_version: req.promptVersion,
        status,
        error_code: code,
        input_tokens: usage.input,
        output_tokens: usage.output,
        total_tokens: usage.total,
        latency_ms: Math.round(latencyMs),
        attempts,
      })
      .execute(),
  )
}
