import { z } from 'zod'
import { hexColor, optionalEmail, optionalText, optionalUrl, requiredText, email } from './common'

export const organizationSchema = z.object({
  name: requiredText(120, 'Organization name').min(2, 'Use at least 2 characters'),
  website: optionalUrl,
  industry: optionalText(120),
  country: optionalText(80),
  businessEmail: optionalEmail,
  brandColor: hexColor.default('#6D6AF5'),
})
export type OrganizationInput = z.infer<typeof organizationSchema>

export const brandingSchema = z.object({
  companyName: optionalText(160),
  brandColor: hexColor,
  accentColor: hexColor,
  contactEmail: optionalEmail,
  contactPhone: optionalText(40),
  contactWebsite: optionalUrl,
  address: optionalText(500),
  reportFooter: optionalText(500),
  reportTitleDefault: optionalText(200),
  whiteLabelEnabled: z.preprocess((v) => v === 'on' || v === 'true' || v === true, z.boolean()),
})
export type BrandingInput = z.infer<typeof brandingSchema>

export const inviteSchema = z.object({
  email,
  role: z.enum(['admin', 'member']),
})

export const roleSchema = z.enum(['owner', 'admin', 'member'])
