import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  title: {
    default: 'farmerrr — Repercute. Recebe. Reage.',
    template: '%s · farmerrr',
  },
  description:
    'Leaderboards automáticos para os teus clippers. As views são contadas pela API oficial do TikTok e o ranking atualiza-se sozinho.',
  openGraph: {
    type: 'website',
    siteName: 'farmerrr',
    locale: 'pt_PT',
  },
}

export const viewport: Viewport = {
  themeColor: '#08080a',
  colorScheme: 'dark',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-PT">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  )
}
