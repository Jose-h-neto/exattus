/*
 * Parametros legais vigentes. Valores em centavos e aliquotas em pontos-base.
 *
 * IRRF 2026: https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/tabelas/2026
 * Lei 15.270/2025: https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/tabelas/exemplos-de-aplicacao-da-lei-15-270-2025
 * INSS 2026: https://www.gov.br/inss/pt-br/direitos-e-deveres/inscricao-e-contribuicao/tabela-de-contribuicao-mensal
 */

export const ANO_VIGENCIA = 2026

export interface FaixaInss {
  limite: number
  aliquota: number
  /** Valor fixo usado quando a base ultrapassa a faixa inteira; `null` = calcular. */
  valorFixo: number | null
}

export interface TabelaInss {
  faixas: FaixaInss[]
  aliquotaProlabore: number
}

export const TABELA_INSS_2026: Readonly<TabelaInss> = Object.freeze({
  faixas: [
    { limite: 162100, aliquota: 750, valorFixo: 12158 },
    { limite: 290284, aliquota: 900, valorFixo: 11537 },
    { limite: 435427, aliquota: 1200, valorFixo: 17417 },
    { limite: 847555, aliquota: 1400, valorFixo: null },
  ],
  aliquotaProlabore: 1100,
})

export function copiarTabelaInss(tabela: Readonly<TabelaInss>): TabelaInss {
  return {
    faixas: tabela.faixas.map((faixa) => ({ ...faixa })),
    aliquotaProlabore: tabela.aliquotaProlabore,
  }
}

export interface FaixaIrrf {
  limite: number
  aliquota: number
  deducao: number
}

export interface ReducaoLei15270 {
  limiteIsencao: number
  limiteTransicao: number
  reducaoMaxima: number
  parcelaFixa: number
  coeficiente: number
  divisor: number
}

export interface TabelaIrrf {
  dependente: number
  simplificado: number
  faixas: readonly FaixaIrrf[]
  /** Ausente nas competencias anteriores a Lei n. 15.270/2025. */
  reducao: ReducaoLei15270 | null
}

/** Reducao do imposto mensal prevista na Lei n. 15.270/2025. */
export const REDUCAO_2026: Readonly<ReducaoLei15270> = Object.freeze({
  limiteIsencao: 500000,
  limiteTransicao: 735000,
  reducaoMaxima: 31289,
  parcelaFixa: 97862,
  coeficiente: 133145,
  divisor: 1000000,
})

export const IRRF_2026: Readonly<TabelaIrrf> = Object.freeze({
  dependente: 18959,
  simplificado: 60720,

  faixas: Object.freeze([
    { limite: 242880, aliquota: 0, deducao: 0 },
    { limite: 282665, aliquota: 750, deducao: 18216 },
    { limite: 375105, aliquota: 1500, deducao: 39416 },
    { limite: 466468, aliquota: 2250, deducao: 67549 },
    { limite: Infinity, aliquota: 2750, deducao: 90873 },
  ]),

  reducao: REDUCAO_2026,
})

export function copiarTabelaIrrf(tabela: Readonly<TabelaIrrf>): TabelaIrrf {
  return {
    dependente: tabela.dependente,
    simplificado: tabela.simplificado,
    faixas: tabela.faixas.map((faixa) => ({ ...faixa })),
    reducao: tabela.reducao,
  }
}

/** Aliquota padrao do FGTS (8%). */
export const ALIQUOTA_FGTS = 800

/**
 * Tabelas versionadas por competencia. Para atualizar, inclua uma nova versao
 * com a competencia inicial de vigencia ("AAAA-MM"); a mais recente que nao
 * ultrapasse a competencia do calculo e aplicada.
 */
export interface VersaoTabelas {
  vigencia: string
  rotulo: string
  inss: Readonly<TabelaInss>
  irrf: Readonly<TabelaIrrf>
}

export const VERSOES_TABELAS: readonly VersaoTabelas[] = [
  { vigencia: '2026-01', rotulo: `Tabelas ${ANO_VIGENCIA}`, inss: TABELA_INSS_2026, irrf: IRRF_2026 },
]

export function versaoDaCompetencia(competencia: string): VersaoTabelas | null {
  return (
    [...VERSOES_TABELAS]
      .sort((a, b) => b.vigencia.localeCompare(a.vigencia))
      .find((versao) => versao.vigencia <= competencia) ?? null
  )
}

export const FONTES_OFICIAIS = [
  {
    titulo: 'Receita Federal — Tributação de 2026',
    url: 'https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/tabelas/2026',
  },
  {
    titulo: 'Receita Federal — Exemplos da Lei nº 15.270/2025',
    url: 'https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/tabelas/exemplos-de-aplicacao-da-lei-15-270-2025',
  },
  {
    titulo: 'INSS — Tabela de contribuição mensal',
    url: 'https://www.gov.br/inss/pt-br/direitos-e-deveres/inscricao-e-contribuicao/tabela-de-contribuicao-mensal',
  },
] as const
