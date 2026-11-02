import type { ModelClient } from '@/lib/ai/gemini'

/** Deterministic fake model: returns queued responses (string or thrown error). */
export function fakeModel(responses: (string | Error | ((prompt: string) => string))[]) {
  const calls: { prompt: string; system: string; model: string }[] = []
  const client: ModelClient = {
    async generate(req) {
      calls.push({ prompt: req.prompt, system: req.system, model: req.model })
      const next = responses.length > 1 ? responses.shift()! : responses[0]
      if (next instanceof Error) throw next
      const text = typeof next === 'function' ? next(req.prompt) : next
      return { text, usage: { input: 100, output: 200, total: 300 } }
    },
  }
  return { client, calls }
}
