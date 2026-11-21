import { SettingsContent } from '@/components/dashboard/settings-content'

export const metadata = { title: 'Definições' }

export default async function SettingsPage({ params, searchParams }: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ streams?: string; premios?: string }>
}) {
  const [{ id }, { streams, premios }] = await Promise.all([params, searchParams])
  return <SettingsContent id={id} streams={streams} premios={premios} />
}
