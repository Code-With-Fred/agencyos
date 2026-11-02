import { AppError } from '@/lib/errors'

export const MAX_LOGO_BYTES = 2 * 1024 * 1024

export type ValidatedImage = { buffer: Buffer; mime: 'image/png' | 'image/jpeg'; ext: 'png' | 'jpg' }

/**
 * Validates uploads by size and magic bytes — the browser-supplied MIME type
 * and filename are ignored. Only PNG and JPEG are accepted (SVG is rejected
 * because it can carry script; both formats render in PDFs).
 */
export function detectImage(bytes: Uint8Array): ValidatedImage['mime'] | null {
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (bytes.length >= 8 && png.every((b, i) => bytes[i] === b)) return 'image/png'
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  return null
}

export async function validateImageUpload(file: unknown, maxBytes = MAX_LOGO_BYTES): Promise<ValidatedImage> {
  if (!file || typeof file !== 'object' || !('arrayBuffer' in file) || !('size' in file)) {
    throw new AppError('validation', 'Choose an image file to upload.')
  }
  const f = file as File
  if (f.size === 0) throw new AppError('validation', 'The file is empty.')
  if (f.size > maxBytes) throw new AppError('validation', `Images must be ${Math.round(maxBytes / 1024 / 1024)} MB or smaller.`)
  const buffer = Buffer.from(await f.arrayBuffer())
  const mime = detectImage(buffer)
  if (!mime) throw new AppError('validation', 'Only PNG and JPEG images are supported.')
  return { buffer, mime, ext: mime === 'image/png' ? 'png' : 'jpg' }
}
