import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  // Keep the local OBS preview free of the development status badge.
  devIndicators: false,
  images: {
    remotePatterns: [
      // Thumbnails e avatares vindos do Supabase Storage
      { protocol: 'https', hostname: '*.supabase.co' },
      // CDN do TikTok (usado só como fallback — ver ARQUITETURA.md §6.5)
      { protocol: 'https', hostname: '*.tiktokcdn.com' },
      { protocol: 'https', hostname: '*.tiktokcdn-us.com' },
    ],
  },
}

export default nextConfig
