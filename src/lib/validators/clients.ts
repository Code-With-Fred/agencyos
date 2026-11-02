import { z } from 'zod'
import { optionalEmail, optionalText, optionalUrl, requiredText, optionalDate, optionalMoney, currency, optionalUuid } from './common'

export const CLIENT_STATUSES = ['lead', 'active', 'paused', 'archived'] as const
export const clientSchema = z.object({
  name: requiredText(160, 'Name'),
  company: optionalText(160),
  email: optionalEmail,
  phone: optionalText(40),
  website: optionalUrl,
  industry: optionalText(120),
  country: optionalText(80),
  notes: optionalText(10000),
  status: z.enum(CLIENT_STATUSES).default('active'),
})
export type ClientInput = z.infer<typeof clientSchema>

export const clientListSchema = z.object({
  q: z.string().trim().max(120).optional().default(''),
  status: z.enum(['all', ...CLIENT_STATUSES]).optional().default('all'),
  page: z.coerce.number().int().min(1).max(10000).optional().default(1),
})

export const PROJECT_STATUSES = ['planning', 'in_progress', 'review', 'completed', 'on_hold'] as const
export const projectSchema = z.object({
  name: requiredText(160, 'Project name'),
  clientId: optionalUuid,
  description: optionalText(10000),
  status: z.enum(PROJECT_STATUSES).default('planning'),
  deadline: optionalDate,
  budget: optionalMoney,
  currency,
  internalNotes: optionalText(20000),
})
export type ProjectInput = z.infer<typeof projectSchema>

export const taskSchema = z.object({
  title: requiredText(300, 'Task title'),
  description: optionalText(5000),
  assigneeId: z
    .string()
    .max(100)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  dueDate: optionalDate,
})
export const taskStatusSchema = z.enum(['todo', 'in_progress', 'done'])
