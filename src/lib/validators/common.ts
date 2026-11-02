import { z } from 'zod'

/** Empty strings from forms become null. */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be ${max} characters or fewer`)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null))

export const requiredText = (max: number, label = 'This field') =>
  z.string({ error: `${label} is required` }).trim().min(1, `${label} is required`).max(max, `Must be ${max} characters or fewer`)

export const optionalEmail = z
  .string()
  .trim()
  .max(320)
  .optional()
  .nullable()
  .transform((v) => (v ? v.toLowerCase() : null))
  .refine((v) => v === null || z.email().safeParse(v).success, 'Enter a valid email address')

export const email = z.string().trim().toLowerCase().max(320).pipe(z.email('Enter a valid email address'))

export const optionalUrl = z
  .string()
  .trim()
  .max(2048)
  .optional()
  .nullable()
  .transform((v) => (v ? (/^https?:\/\//i.test(v) ? v : `https://${v}`) : null))
  .refine((v) => {
    if (v === null) return true
    try {
      const u = new URL(v)
      return u.protocol === 'https:' || u.protocol === 'http:'
    } catch {
      return false
    }
  }, 'Enter a valid URL')

export const hexColor = z
  .string()
  .trim()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Use a hex color such as #6D6AF5')
  .transform((v) => v.toUpperCase())

export const uuid = z.uuid('Invalid identifier')
export const optionalUuid = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))
  .pipe(z.uuid().nullable())

export const optionalDate = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), 'Use YYYY-MM-DD')

export const optionalMoney = z
  .union([z.string(), z.number()])
  .optional()
  .nullable()
  .transform((v) => (v === '' || v === null || v === undefined ? null : Number(v)))
  .refine((v) => v === null || (Number.isFinite(v) && v >= 0 && v < 1e12), 'Enter a valid amount')

export const currency = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, 'Use a 3-letter currency code')
  .default('USD')

export const password = z.string().min(10, 'Use at least 10 characters').max(128, 'Use 128 characters or fewer')

/** FormData -> plain object (last value wins; checkboxes become 'on'). */
export function formToObject(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of fd.entries()) if (typeof v === 'string') out[k] = v
  return out
}

export const contactSchema = z.object({
  name: requiredText(160, 'Name'),
  email,
  company: optionalText(160),
  topic: z.enum(['sales', 'support', 'partnership', 'self_hosted', 'other']).default('sales'),
  message: z.string().trim().min(10, 'Please write at least 10 characters').max(5000),
  website: z.string().max(0).optional(), // honeypot
})
