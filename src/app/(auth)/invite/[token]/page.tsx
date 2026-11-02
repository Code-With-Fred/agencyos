import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Notice } from '@/components/ui/states'
import { AcceptInvitation } from '@/components/team/accept-invitation'
import { getSessionUser } from '@/lib/auth/session'
import { getInvitationPreview } from '@/lib/services/team'

export const metadata: Metadata = { title: 'Invitation', robots: { index: false } }
export const dynamic = 'force-dynamic'

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const [invite, user] = await Promise.all([getInvitationPreview(token), getSessionUser()])
  const next = `/invite/${token}`

  if (!invite || invite.status !== 'open') {
    const msg = !invite ? 'This invitation link is invalid.' : invite.status === 'expired' ? 'This invitation has expired.' : invite.status === 'accepted' ? 'This invitation has already been accepted.' : 'This invitation was revoked.'
    return (
      <>
        <h1 className="text-lg font-semibold">Invitation unavailable</h1>
        <Notice tone="warning" className="mt-4">
          {msg} Ask an administrator of the organization for a new invitation.
        </Notice>
      </>
    )
  }

  return (
    <>
      <h1 className="text-lg font-semibold">Join {invite.orgName}</h1>
      <p className="mt-1 text-[13px] text-fg-muted">
        {invite.inviterName ?? 'An administrator'} invited <span className="text-fg">{invite.email}</span> to join as <span className="capitalize text-fg">{invite.role}</span>.
      </p>
      <div className="mt-6 space-y-3">
        {!user ? (
          <>
            <Button asChild className="w-full">
              <Link href={`/register?next=${encodeURIComponent(next)}`}>Create an account to accept</Link>
            </Button>
            <Button asChild variant="secondary" className="w-full">
              <Link href={`/login?next=${encodeURIComponent(next)}`}>I already have an account</Link>
            </Button>
          </>
        ) : user.email.toLowerCase() !== invite.email ? (
          <Notice tone="warning">
            You are signed in as {user.email}. This invitation is for {invite.email} — sign out and sign in with the invited email to accept it.
          </Notice>
        ) : (
          <AcceptInvitation token={token} />
        )}
      </div>
    </>
  )
}
