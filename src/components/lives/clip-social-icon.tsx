import Image from 'next/image'

type ClipSocialIconName = 'like' | 'comment' | 'favorite' | 'share'

export function ClipSocialIcon({ name }: { name: ClipSocialIconName }) {
  if (name === 'favorite') {
    return <svg width="28" height="28" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path d="M10 5a2 2 0 0 0-2 2v35.17c0 1.1 1.24 1.74 2.14 1.1L24 33.5l13.86 9.77c.9.64 2.14 0 2.14-1.1V7a2 2 0 0 0-2-2H10Z" fill="white" fillOpacity=".9" />
    </svg>
  }

  // Original SVG artwork from TikTok's embedded player, including its shading.
  return <Image src={`/icons/tiktok/${name}.svg`} width={28} height={28} alt="" aria-hidden="true" />
}
