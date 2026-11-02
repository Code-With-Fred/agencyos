import { PageContainer, PageHeader } from '@/components/ui/page'
import { SettingsNav } from '@/components/settings/settings-nav'

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageContainer>
      <PageHeader title="Settings" description="Manage your profile, organization, security and license." />
      <div className="grid gap-6 lg:grid-cols-[180px_1fr]">
        <SettingsNav />
        <div className="min-w-0 space-y-6">{children}</div>
      </div>
    </PageContainer>
  )
}
