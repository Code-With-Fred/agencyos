import { redirect } from 'next/navigation'
import { isPreviewMode } from '@/lib/preview'

/** In preview mode there is no sign-in: send auth pages straight to the app. */
export function redirectInPreview() {
  if (isPreviewMode()) redirect('/app')
}
