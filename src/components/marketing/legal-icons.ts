import { BookOpen, CreditCard, Database, LayoutGrid, Scale, Share2, ShieldCheck, type LucideIcon } from 'lucide-react'

/** Ícones dos títulos de grupo do índice legal, por nome (o nome passa de servidor para cliente; o componente não). */
export const LEGAL_ICONS = {
  book: BookOpen, card: CreditCard, database: Database, grid: LayoutGrid, scale: Scale, share: Share2, shield: ShieldCheck,
} satisfies Record<string, LucideIcon>

export type LegalIcon = keyof typeof LEGAL_ICONS
