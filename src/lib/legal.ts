/**
 * Dados usados nos Termos de Serviço e na Política de Privacidade.
 *
 * Os campos entre [ ] têm de ser preenchidos com os dados reais de quem explora
 * o farmerrr (empresa ou empresário em nome individual) antes de aceitar o
 * primeiro pagamento: o RGPD obriga a identificar o responsável pelo tratamento
 * e a lei portuguesa obriga a identificar o prestador de serviços.
 */
export const LEGAL = {
  brand: 'farmerrr',
  /** Nome legal (ex.: "Farmerrr, Lda." ou o nome do empresário em nome individual). */
  entity: '[Nome legal da entidade]',
  /** NIF / NIPC. */
  taxId: '[NIF]',
  /** Morada da sede ou do domicílio profissional. */
  address: '[Morada completa]',
  supportEmail: 'suporte@farmerrr.app',
  privacyEmail: 'privacidade@farmerrr.app',
  /** Entidade de Resolução Alternativa de Litígios de consumo a que aderiu (ou a competente pela área). */
  adrEntity: '[Entidade RAL, ex.: CNIACC — Centro Nacional de Informação e Arbitragem de Conflitos de Consumo]',
  /** Data mostrada como "Última atualização" nos dois documentos. */
  updatedAt: '19 de novembro de 2026',
} as const
