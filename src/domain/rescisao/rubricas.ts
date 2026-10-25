/*
 * Rubricas da rescisao e incidencias padrao de INSS, IRRF e FGTS.
 *
 * As incidencias sao PARAMETROS: os valores abaixo sao o ponto de partida e
 * podem ser ajustados em Tabelas e parametros. Marcadas como `validar` as que
 * dependem de interpretacao juridica ou de definicao interna da empresa.
 */

export type CodigoRubrica =
  | 'saldo_salario'
  | 'adicionais_saldo'
  | 'variaveis_mes'
  | 'aviso_indenizado'
  | 'medias_aviso'
  | 'decimo_proporcional'
  | 'decimo_aviso'
  | 'ferias_vencidas'
  | 'ferias_dobro'
  | 'ferias_proporcionais'
  | 'ferias_aviso'
  | 'terco_ferias'
  | 'indenizacao_479'
  | 'indenizacao_7238'
  | 'multa_477'
  | 'desconto_aviso'
  | 'indenizacao_480'
  | 'adiantamento_decimo'
  | 'outros_descontos'

/** Remuneratoria integra o salario; indenizatoria repara direito; desconto reduz o liquido. */
export type Natureza = 'remuneratoria' | 'indenizatoria' | 'desconto'

/** Grupo de tributacao: mensal ou 13o (INSS e IRRF calculados em separado). */
export type GrupoTributacao = 'mensal' | 'decimo'

export interface Incidencia {
  inss: boolean
  irrf: boolean
  fgts: boolean
}

export interface DefinicaoRubrica {
  codigo: CodigoRubrica
  descricao: string
  tipo: 'provento' | 'desconto'
  natureza: Natureza
  grupo: GrupoTributacao
  padrao: Incidencia
  fundamento: string
  /** Incidencia sujeita a interpretacao: revisar antes de uso em producao. */
  validar?: boolean
}

const SIM_TODAS: Incidencia = { inss: true, irrf: true, fgts: true }
const NENHUMA: Incidencia = { inss: false, irrf: false, fgts: false }

export const RUBRICAS: readonly DefinicaoRubrica[] = [
  {
    codigo: 'saldo_salario',
    descricao: 'Saldo de salário',
    tipo: 'provento',
    natureza: 'remuneratoria',
    grupo: 'mensal',
    padrao: SIM_TODAS,
    fundamento: 'Dias trabalhados no mês do desligamento.',
  },
  {
    codigo: 'adicionais_saldo',
    descricao: 'Adicionais sobre saldo de salário',
    tipo: 'provento',
    natureza: 'remuneratoria',
    grupo: 'mensal',
    padrao: SIM_TODAS,
    fundamento: 'Adicionais fixos (insalubridade, periculosidade etc.) proporcionais aos dias trabalhados.',
  },
  {
    codigo: 'variaveis_mes',
    descricao: 'Verbas variáveis do mês',
    tipo: 'provento',
    natureza: 'remuneratoria',
    grupo: 'mensal',
    padrao: SIM_TODAS,
    fundamento: 'Horas extras, comissões e demais variáveis apuradas no mês do desligamento.',
  },
  {
    codigo: 'aviso_indenizado',
    descricao: 'Aviso prévio indenizado',
    tipo: 'provento',
    natureza: 'indenizatoria',
    grupo: 'mensal',
    padrao: { inss: false, irrf: false, fgts: true },
    fundamento: 'CLT, art. 487, § 1º; Lei 12.506/2011. FGTS: Súmula 305 TST.',
  },
  {
    codigo: 'medias_aviso',
    descricao: 'Médias sobre aviso prévio indenizado',
    tipo: 'provento',
    natureza: 'indenizatoria',
    grupo: 'mensal',
    padrao: SIM_TODAS,
    fundamento: 'Reflexo das médias variáveis no aviso indenizado. Incidência de INSS e IRRF definida pela empresa.',
    validar: true,
  },
  {
    codigo: 'decimo_proporcional',
    descricao: '13º salário proporcional',
    tipo: 'provento',
    natureza: 'remuneratoria',
    grupo: 'decimo',
    padrao: SIM_TODAS,
    fundamento: 'Lei 4.090/62. Tributação separada do mês.',
  },
  {
    codigo: 'decimo_aviso',
    descricao: '13º salário sobre aviso prévio indenizado',
    tipo: 'provento',
    natureza: 'indenizatoria',
    grupo: 'decimo',
    padrao: SIM_TODAS,
    fundamento: 'Avos do 13º gerados pela projeção do aviso indenizado. Incidência definida pela empresa.',
    validar: true,
  },
  {
    codigo: 'ferias_vencidas',
    descricao: 'Férias vencidas',
    tipo: 'provento',
    natureza: 'indenizatoria',
    grupo: 'mensal',
    padrao: NENHUMA,
    fundamento: 'CLT, art. 146. Indenizadas na rescisão: sem INSS, IRRF e FGTS.',
  },
  {
    codigo: 'ferias_dobro',
    descricao: 'Férias vencidas em dobro',
    tipo: 'provento',
    natureza: 'indenizatoria',
    grupo: 'mensal',
    padrao: NENHUMA,
    fundamento: 'CLT, art. 137: férias não concedidas no período concessivo.',
  },
  {
    codigo: 'ferias_proporcionais',
    descricao: 'Férias proporcionais',
    tipo: 'provento',
    natureza: 'indenizatoria',
    grupo: 'mensal',
    padrao: NENHUMA,
    fundamento: 'CLT, art. 146, parágrafo único; Súmula 261 TST.',
  },
  {
    codigo: 'ferias_aviso',
    descricao: 'Férias sobre aviso prévio indenizado',
    tipo: 'provento',
    natureza: 'indenizatoria',
    grupo: 'mensal',
    padrao: NENHUMA,
    fundamento: 'Avos de férias gerados pela projeção do aviso indenizado.',
  },
  {
    codigo: 'terco_ferias',
    descricao: '1/3 constitucional de férias',
    tipo: 'provento',
    natureza: 'indenizatoria',
    grupo: 'mensal',
    padrao: NENHUMA,
    fundamento: 'CF, art. 7º, XVII, sobre férias indenizadas.',
  },
  {
    codigo: 'indenizacao_479',
    descricao: 'Indenização art. 479 CLT',
    tipo: 'provento',
    natureza: 'indenizatoria',
    grupo: 'mensal',
    padrao: NENHUMA,
    fundamento: 'Metade da remuneração devida até o termo do contrato a prazo.',
  },
  {
    codigo: 'indenizacao_7238',
    descricao: 'Indenização adicional Lei 7.238/84',
    tipo: 'provento',
    natureza: 'indenizatoria',
    grupo: 'mensal',
    padrao: NENHUMA,
    fundamento: 'Dispensa nos 30 dias que antecedem a data-base (art. 9º; Súmula 242 TST).',
  },
  {
    codigo: 'multa_477',
    descricao: 'Multa art. 477, § 8º CLT',
    tipo: 'provento',
    natureza: 'indenizatoria',
    grupo: 'mensal',
    padrao: NENHUMA,
    fundamento: 'Atraso no pagamento das verbas rescisórias (prazo de 10 dias).',
  },
  {
    codigo: 'desconto_aviso',
    descricao: 'Aviso prévio não cumprido',
    tipo: 'desconto',
    natureza: 'desconto',
    grupo: 'mensal',
    padrao: NENHUMA,
    fundamento: 'CLT, art. 487, § 2º.',
    validar: true,
  },
  {
    codigo: 'indenizacao_480',
    descricao: 'Indenização art. 480 CLT',
    tipo: 'desconto',
    natureza: 'desconto',
    grupo: 'mensal',
    padrao: NENHUMA,
    fundamento: 'Prejuízos da antecipação pelo empregado, limitados ao valor do art. 479.',
  },
  {
    codigo: 'adiantamento_decimo',
    descricao: 'Adiantamento de 13º salário',
    tipo: 'desconto',
    natureza: 'desconto',
    grupo: 'decimo',
    padrao: NENHUMA,
    fundamento: 'Primeira parcela do 13º paga no ano.',
  },
  {
    codigo: 'outros_descontos',
    descricao: 'Outros descontos',
    tipo: 'desconto',
    natureza: 'desconto',
    grupo: 'mensal',
    padrao: NENHUMA,
    fundamento: 'Vale-transporte, adiantamentos, faltas de meses anteriores etc.',
  },
]

export function definicaoRubrica(codigo: CodigoRubrica): DefinicaoRubrica {
  return RUBRICAS.find((item) => item.codigo === codigo)!
}

export type IncidenciasRescisao = Record<CodigoRubrica, Incidencia>

export function incidenciasPadrao(): IncidenciasRescisao {
  return Object.fromEntries(RUBRICAS.map((item) => [item.codigo, { ...item.padrao }])) as IncidenciasRescisao
}

export interface RegrasRescisao {
  /** Projeta o aviso indenizado para os avos de 13o e ferias (OJ 82 SDI-1). */
  projetarAviso: boolean
  /** No aviso trabalhado, indeniza os dias que excedem 30 (Lei 12.506). */
  indenizarExcedenteAviso: boolean
  /** Ferias vencidas apos o periodo concessivo pagas em dobro (art. 137). */
  feriasEmDobro: boolean
  /** Permite o desconto simplificado no IRRF do 13o. */
  simplificadoNoDecimo: boolean
  /** Aplica a reducao da Lei 15.270/2025 no IRRF do 13o. */
  reducaoNoDecimo: boolean
  /** Aliquota do FGTS em pontos-base (800 = 8%; 200 = 2% para aprendiz). */
  aliquotaFgts: number
  /** Diferenca maxima aceita na conferencia, em centavos. */
  tolerancia: number
}

export function regrasPadrao(): RegrasRescisao {
  return {
    projetarAviso: true,
    indenizarExcedenteAviso: true,
    feriasEmDobro: true,
    simplificadoNoDecimo: true,
    reducaoNoDecimo: true,
    aliquotaFgts: 800,
    tolerancia: 0,
  }
}
