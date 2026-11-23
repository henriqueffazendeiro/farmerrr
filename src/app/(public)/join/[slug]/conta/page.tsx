import { redirect } from 'next/navigation'
import { ButtonLink } from '@/components/ui/button'
import { AutoRefresh } from '@/components/leaderboard/auto-refresh'
import { isMockMode } from '@/lib/providers/registry'
import { ClipperSettingsView, clipperSettingsData } from '@/components/clipper/clipper-settings'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Definições', robots: { index: false } }

/** As definições do clipper numa página própria (é para aqui que voltam "Levantar" e o Discord). */
export default async function ClipperAccount({ params, searchParams }: {
  params: Promise<{ slug: string }>; searchParams: Promise<{ estado?: string; premios?: string }>
}) {
  const { slug } = await params
  const { premios } = await searchParams
  const data = await clipperSettingsData(slug)
  if (!data) redirect(`/join/${encodeURIComponent(slug)}`)
  return <main className="mx-auto max-w-lg px-5 py-16">
    <AutoRefresh seconds={30} />
    <h1 className="mb-10 text-2xl font-semibold tracking-tight sm:text-3xl">Definições</h1>
    {isMockMode() && <p className="mb-6 text-sm text-gold">Demonstração: esta conta e os vídeos são simulados.</p>}
    <ClipperSettingsView data={data} premios={premios} />
    <ButtonLink href={`/${slug}`} variant="secondary" className="mt-10 w-full border-0">Voltar à competição</ButtonLink>
  </main>
}
