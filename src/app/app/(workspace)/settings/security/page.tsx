import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChangePasswordForm, RevokeSessionsButton } from '@/components/settings/account-forms'
import { getAuth } from '@/lib/auth/auth'
import { getSession, requireOrgContext } from '@/lib/auth/session'
import { formatDateTime } from '@/lib/utils'

export const metadata: Metadata = { title: 'Security' }

function describeAgent(ua: string | null) {
  if (!ua) return 'Unknown device'
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser'
  const os = /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Linux/.test(ua) ? 'Linux' : ''
  return `${browser}${os ? ` on ${os}` : ''}`
}

export default async function SecuritySettingsPage() {
  await requireOrgContext()
  const [session, sessions] = await Promise.all([getSession(), getAuth().api.listSessions({ headers: await headers() })])
  return (
    <>
      <ChangePasswordForm />
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Active sessions</CardTitle>
            <CardDescription>Devices currently signed in to your account. Sessions expire after 7 days of inactivity.</CardDescription>
          </div>
          <RevokeSessionsButton />
        </CardHeader>
        <CardContent className="divide-y divide-border p-0">
          {sessions.map((s) => (
            <div key={s.id} className="flex items-center justify-between px-5 py-3 text-[13px]">
              <div>
                <p className="text-fg">
                  {describeAgent(s.userAgent ?? null)} {s.id === session?.session.id ? <span className="ml-1 text-2xs text-success">This device</span> : null}
                </p>
                <p className="text-xs text-fg-subtle">Signed in {formatDateTime(s.createdAt)}</p>
              </div>
              <p className="text-xs text-fg-subtle">Expires {formatDateTime(s.expiresAt)}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  )
}
