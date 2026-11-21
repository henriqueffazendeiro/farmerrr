import { SettingsDrawer } from '@/components/dashboard/settings-drawer'

export default function SettingsPanelLayout({ children }: { children: React.ReactNode }) {
  return <SettingsDrawer>{children}</SettingsDrawer>
}
