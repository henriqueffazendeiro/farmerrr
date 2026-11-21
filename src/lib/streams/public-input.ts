import type { StreamPlatform } from './model'

export function normalizeStreamChannel(platform: StreamPlatform, input: string): string {
  let value = input.trim()
  if (!value || value.length > 200) throw new Error('Introduz o username ou URL do canal.')
  if (/^https?:\/\//i.test(value)) {
    const url = new URL(value)
    const hosts = { twitch: ['twitch.tv', 'www.twitch.tv'], kick: ['kick.com', 'www.kick.com'], youtube: ['youtube.com', 'www.youtube.com', 'm.youtube.com'] }
    if (!hosts[platform].includes(url.hostname) || url.username || url.password || url.port) throw new Error('O URL não corresponde à plataforma selecionada.')
    value = decodeURIComponent(url.pathname).replace(/^\/+|\/+$/g, '')
  }
  if (platform === 'youtube') {
    if (/^(channel\/)?UC[\w-]{22}$/.test(value)) return `https://www.youtube.com/channel/${value.replace(/^channel\//, '')}`
    if (/^(c|user)\/[\w.-]+$/.test(value)) return `https://www.youtube.com/${value}`
    value = value.replace(/^@/, '')
    if (!/^[\p{L}\p{N}_.-]{3,30}$/u.test(value)) throw new Error('Introduz o handle ou URL do canal YouTube.')
    return `https://www.youtube.com/@${value}`
  }
  value = value.replace(/^@/, '').toLowerCase()
  if (!(platform === 'twitch' ? /^[a-z0-9_]{1,25}$/ : /^[a-z0-9_-]{1,50}$/).test(value)) throw new Error('Introduz um username válido, sem caminhos de vídeos.')
  return `https://${platform === 'twitch' ? 'www.twitch.tv' : 'kick.com'}/${value}`
}
