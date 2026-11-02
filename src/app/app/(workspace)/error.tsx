'use client'
import { ErrorState } from '@/components/ui/states'
import { Button } from '@/components/ui/button'
import { PageContainer } from '@/components/ui/page'

export default function WorkspaceError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <PageContainer>
      <ErrorState
        description={error.message && !error.digest ? error.message : 'This page could not be loaded. If the problem continues, contact your administrator.'}
        action={
          <Button variant="secondary" size="sm" onClick={reset}>
            Try again
          </Button>
        }
      />
    </PageContainer>
  )
}
