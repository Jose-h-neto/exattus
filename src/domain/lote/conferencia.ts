/*
 * Conferencia em lote: compara os valores calculados pelo sistema com os da
 * folha do cliente, item a item, com uma tolerancia em centavos.
 * Mesma regra da conferencia da rescisao: |informado - calculado| <= tolerancia.
 */

export type ChaveItemLote = 'proventos' | 'descontos' | 'inss' | 'irrf' | 'liquido' | 'fgts'

export type SituacaoItemLote = 'confere' | 'divergente' | 'nao_informado'

export interface ItemConferenciaLote {
  chave: ChaveItemLote
  descricao: string
  calculado: number
  informado: number | null
  /** Informado - calculado; null quando nao informado. */
  diferenca: number | null
  situacao: SituacaoItemLote
}

export const CHAVES_ITENS_LOTE: readonly ChaveItemLote[] = ['proventos', 'descontos', 'inss', 'irrf', 'liquido', 'fgts']

export function conferirValor(calculado: number, informado: number | null, tolerancia: number) {
  if (informado === null) {
    return { calculado, informado, diferenca: null, situacao: 'nao_informado' as const }
  }

  const diferenca = informado - calculado

  return {
    calculado,
    informado,
    diferenca,
    situacao: Math.abs(diferenca) <= tolerancia ? ('confere' as const) : ('divergente' as const),
  }
}

/** Situacao do funcionario: divergente se algum item diverge; confere se ao menos um foi conferido. */
export function situacaoDosItens(itens: readonly ItemConferenciaLote[]): 'confere' | 'divergente' | 'sem_informado' {
  if (itens.some((item) => item.situacao === 'divergente')) return 'divergente'
  if (itens.some((item) => item.situacao === 'confere')) return 'confere'

  return 'sem_informado'
}
