import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

/** Endereço antigo: a entrada do clipper abre agora a página da competição com o pop-up "Inscrição feita". */
export default async function JoinSuccessPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  redirect(`/${encodeURIComponent(slug)}?entrou=1`)
}
