import { SettingsDrawer } from '@/components/dashboard/settings-drawer'

export default function JoinPanelLayout({ children }: { children: React.ReactNode }) {
  return <SettingsDrawer title="Participar" closeLabel="Fechar participação">{children}</SettingsDrawer>
}
