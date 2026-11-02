import { Building2, ClipboardList, FileSignature, FolderKanban, Gauge, KeyRound, LayoutDashboard, LineChart, Palette, Plug, ScanSearch, Settings, Users } from 'lucide-react'
import type { Module } from '@/lib/licensing/plans'

export type NavItem = { href: string; label: string; icon: typeof Users; module?: Module }

export const NAV_MAIN: NavItem[] = [
  { href: '/app', label: 'Overview', icon: LayoutDashboard },
  { href: '/app/clients', label: 'Clients', icon: Building2, module: 'clients' },
  { href: '/app/projects', label: 'Projects', icon: FolderKanban, module: 'projects' },
  { href: '/app/audits', label: 'Website Audits', icon: ScanSearch, module: 'audits' },
  { href: '/app/proposals', label: 'Proposals', icon: FileSignature, module: 'proposals' },
  { href: '/app/reports', label: 'Reports', icon: LineChart, module: 'reports' },
  { href: '/app/onboarding', label: 'Onboarding', icon: ClipboardList, module: 'onboarding' },
]

export const NAV_ORG: NavItem[] = [
  { href: '/app/team', label: 'Team', icon: Users },
  { href: '/app/integrations', label: 'Integrations', icon: Plug },
  { href: '/app/branding', label: 'Branding', icon: Palette },
  { href: '/app/settings', label: 'Settings', icon: Settings },
]

export const NAV_ADMIN: NavItem[] = [{ href: '/app/admin/licenses', label: 'License admin', icon: KeyRound }]

export const QUICK_ACTIONS = [
  { href: '/app/audits?new=1', label: 'Run a website audit', icon: ScanSearch },
  { href: '/app/proposals/new', label: 'Create a proposal', icon: FileSignature },
  { href: '/app/reports?new=1', label: 'Create a client report', icon: Gauge },
  { href: '/app/onboarding?new=1', label: 'Generate onboarding documents', icon: ClipboardList },
  { href: '/app/clients?new=1', label: 'Add a client', icon: Building2 },
]
