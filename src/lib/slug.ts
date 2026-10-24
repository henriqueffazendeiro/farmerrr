/** Endereços que não podem ser usados como slug — a lista viva está na BD. */
export const RESERVED_SLUGS = new Set([
  'api', 'auth', 'join', 'dashboard', 'entrar', 'registar', 'sair', 'precos',
  'legal', 'overlay', 'stream', 'admin', 'conta', 'settings', 'definicoes',
  'novo', 'new', 'app', 'www', 'static', 'public', 'assets', '_next',
  'favicon', 'robots', 'sitemap', 'farmerrr', 'suporte', 'ajuda', 'blog',
])

export const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/

/** "Luís Ferreira" → "luis-ferreira" */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '')
}

export type SlugProblem = 'curto' | 'longo' | 'formato' | 'reservado' | null

export function validateSlug(slug: string): SlugProblem {
  if (slug.length < 3) return 'curto'
  if (slug.length > 40) return 'longo'
  if (!SLUG_PATTERN.test(slug)) return 'formato'
  if (RESERVED_SLUGS.has(slug)) return 'reservado'
  return null
}

export function slugProblemMessage(problem: SlugProblem): string | null {
  switch (problem) {
    case 'curto':
      return 'O endereço precisa de pelo menos 3 caracteres.'
    case 'longo':
      return 'O endereço não pode ter mais de 40 caracteres.'
    case 'formato':
      return 'Usa apenas letras minúsculas, números e hífenes.'
    case 'reservado':
      return 'Esse endereço está reservado. Escolhe outro.'
    default:
      return null
  }
}
