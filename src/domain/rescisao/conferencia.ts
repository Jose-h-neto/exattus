import { formatarMoeda, formatarPercentual } from '../dinheiro'
import { RUBRICAS } from './rubricas'
import type { ResultadoRescisao, Rubrica } from './calculo'

/*
 * Confronta o calculo com os valores processados pela folha de pagamento.
 */

export type GrupoConferencia = 'provento' | 'desconto' | 'total' | 'encargo'

export type SituacaoConferencia = 'confere' | 'divergente' | 'nao_informado'

export interface ItemConferencia {
  chave: string
  descricao: string
  grupo: GrupoConferencia
  calculado: number
  informado: number | null
  diferenca: number | null
  situacao: SituacaoConferencia
  /** Verba que nao e devida neste calculo (valor calculado zero). */
  naoDevida: boolean
  memoria: string[]
}

export interface ResumoConferencia {
  itens: ItemConferencia[]
  conferidos: number
  divergentes: number
  naoInformados: number
  /** Diferenca no liquido (informado - calculado), quando informado. */
  diferencaLiquido: number | null
}

/** Itens conferiveis de um resultado, na ordem do demonstrativo. */
export function itensConferiveis(resultado: ResultadoRescisao): Omit<ItemConferencia, 'informado' | 'diferenca' | 'situacao'>[] {
  const calculadas = new Map<string, Rubrica>(
    [...resultado.proventos, ...resultado.descontos].map((rubrica) => [rubrica.codigo, rubrica]),
  )

  const deRubrica = (chave: string, descricao: string, grupo: GrupoConferencia) => {
    const rubrica = calculadas.get(chave)

    return {
      chave,
      descricao,
      grupo,
      calculado: rubrica?.valor ?? 0,
      naoDevida: !rubrica,
      memoria: rubrica?.memoria ?? ['Verba não devida para os dados e a modalidade informados.'],
    }
  }

  const proventos = RUBRICAS.filter((item) => item.tipo === 'provento').map((item) =>
    deRubrica(item.codigo, item.descricao, 'provento'),
  )

  const descontos = [
    ...RUBRICAS.filter((item) => item.tipo === 'desconto').map((item) =>
      deRubrica(item.codigo, item.descricao, 'desconto'),
    ),
    deRubrica('inss_mensal', 'INSS', 'desconto'),
    deRubrica('inss_decimo', 'INSS sobre 13º salário', 'desconto'),
    deRubrica('irrf_mensal', 'IRRF', 'desconto'),
    deRubrica('irrf_decimo', 'IRRF sobre 13º salário', 'desconto'),
  ]

  const total = (chave: string, descricao: string, grupo: GrupoConferencia, calculado: number, memoria: string[]) => ({
    chave,
    descricao,
    grupo,
    calculado,
    naoDevida: false,
    memoria,
  })

  const { bases, fgts } = resultado

  return [
    ...proventos,
    ...descontos,
    total('total_proventos', 'Total de proventos', 'total', resultado.totalProventos, ['Soma dos proventos.']),
    total('total_descontos', 'Total de descontos', 'total', resultado.totalDescontos, ['Soma dos descontos.']),
    total('liquido', 'Valor líquido', 'total', resultado.liquido, ['Proventos − descontos.']),
    total('base_inss_mensal', 'Base do INSS', 'encargo', bases.inssMensal, ['Soma das rubricas com incidência de INSS (mensal).']),
    total('base_inss_decimo', 'Base do INSS sobre 13º', 'encargo', bases.inssDecimo, ['Soma das rubricas de 13º com incidência de INSS.']),
    total('base_irrf_mensal', 'Base do IRRF (rendimentos)', 'encargo', bases.irrfMensal, ['Rendimentos tributáveis da rescisão, sem a folha anterior.']),
    total('base_irrf_decimo', 'Base do IRRF sobre 13º (rendimentos)', 'encargo', bases.irrfDecimo, ['Rendimentos de 13º tributáveis.']),
    total('fgts_mensal', 'FGTS do mês rescisório', 'encargo', fgts.mensal, [`${formatarMoeda(fgts.baseMensal)} × ${formatarPercentual(fgts.aliquota)}`]),
    total('fgts_decimo', 'FGTS sobre 13º', 'encargo', fgts.decimo, [`${formatarMoeda(fgts.baseDecimo)} × ${formatarPercentual(fgts.aliquota)}`]),
    total('multa_fgts', 'Multa rescisória do FGTS', 'encargo', fgts.multa, [`(${formatarMoeda(fgts.saldoAnterior)} + ${formatarMoeda(fgts.mensal)} + ${formatarMoeda(fgts.decimo)}) × ${formatarPercentual(fgts.percentualMulta)}`]),
  ]
}

export function conferirRescisao(
  resultado: ResultadoRescisao,
  informados: Record<string, number | null>,
  tolerancia: number,
): ResumoConferencia {
  const itens: ItemConferencia[] = itensConferiveis(resultado).map((item) => {
    const informado = informados[item.chave] ?? null

    if (informado === null) {
      return { ...item, informado, diferenca: null, situacao: 'nao_informado' }
    }

    const diferenca = informado - item.calculado

    return {
      ...item,
      informado,
      diferenca,
      situacao: Math.abs(diferenca) <= tolerancia ? 'confere' : 'divergente',
    }
  })

  const liquido = itens.find((item) => item.chave === 'liquido')

  return {
    itens,
    conferidos: itens.filter((item) => item.situacao === 'confere').length,
    divergentes: itens.filter((item) => item.situacao === 'divergente').length,
    naoInformados: itens.filter((item) => item.situacao === 'nao_informado' && !item.naoDevida).length,
    diferencaLiquido: liquido?.diferenca ?? null,
  }
}
