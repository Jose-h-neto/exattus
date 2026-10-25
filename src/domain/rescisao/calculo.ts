import { chaveMes, formatarData, somarDias } from '../datas'
import { dividirArredondando, formatarMoeda, formatarPercentual } from '../dinheiro'
import { calcularInss, type ResultadoInss } from '../inss'
import { calcularIrrf, type ResultadoIrrf } from '../irrf'
import { versaoDaCompetencia, type TabelaInss, type TabelaIrrf, type VersaoTabelas } from '../parametros'
import {
  obterModalidade,
  regraEfetiva,
  ROTULOS_CONTRATO,
  type CodigoModalidade,
  type Modalidade,
  type TipoContrato,
} from './modalidades'
import {
  definicaoRubrica,
  type CodigoRubrica,
  type GrupoTributacao,
  type Incidencia,
  type IncidenciasRescisao,
  type Natureza,
  type RegrasRescisao,
} from './rubricas'
import {
  avosDecimoTerceiro,
  avosDoPeriodo,
  diasAvisoProporcional,
  diasDeFeriasPorFaltas,
  diasInclusivos,
  diasSaldoSalario,
  periodosAquisitivos,
  anosCompletos,
} from './tempo'

/* ------------------------------------------------------------------ */
/* Entrada                                                             */
/* ------------------------------------------------------------------ */

/** Como o aviso foi tratado (as opcoes validas dependem da modalidade). */
export type TratamentoAviso = 'indenizado' | 'trabalhado' | 'dispensado' | 'nao_cumprido'

export interface PeriodoInformado {
  gozado: boolean
  /** Faltas injustificadas no periodo (CLT, art. 130). */
  faltas: number
}

export interface EntradaRescisao {
  /** Salario base mensal. */
  salario: number
  /** Adicionais fixos mensais que integram a remuneracao. */
  adicionais: number
  /** Media mensal das verbas variaveis (horas extras, comissoes). */
  medias: number
  /** Variaveis apuradas no proprio mes do desligamento. */
  variaveisMes: number
  /** Faltas injustificadas no mes do desligamento, em dias. */
  faltasMes: number

  admissao: Date
  desligamento: Date
  pagamento: Date
  tipoContrato: TipoContrato
  fimContrato: Date | null
  clausulaAssecuratoria: boolean

  modalidade: CodigoModalidade
  aviso: TratamentoAviso
  /** Dias de aviso nao cumpridos pelo empregado (pedido de demissao). */
  diasAvisoNaoCumpridos: number

  dependentes: number

  /** Situacao de cada periodo aquisitivo completo, na ordem. */
  periodos: PeriodoInformado[]
  faltasPeriodoAtual: number

  adiantamentoDecimo: number
  saldoFgts: number
  outrosDescontos: number
  multa477: boolean
  indenizacao7238: boolean
  /** Valor dos prejuizos (art. 480); `null` usa o limite legal. */
  indenizacao480: number | null

  /** Folha anterior paga no mesmo mes do pagamento da rescisao (IRRF por regime de caixa). */
  folhaAnterior: { rendimentos: number; inss: number; irrf: number }
  /** Remuneracao ja paga na competencia do desligamento (INSS por competencia). */
  competenciaAnterior: { remuneracao: number; inss: number }
}

/* ------------------------------------------------------------------ */
/* Resultado                                                           */
/* ------------------------------------------------------------------ */

export type CodigoTributo = 'inss_mensal' | 'inss_decimo' | 'irrf_mensal' | 'irrf_decimo'

export interface Rubrica {
  codigo: CodigoRubrica | CodigoTributo
  descricao: string
  tipo: 'provento' | 'desconto'
  natureza: Natureza | 'tributo'
  grupo: GrupoTributacao
  referencia: string
  valor: number
  incidencia: Incidencia
  /** Memoria de calculo, linha a linha. */
  memoria: string[]
}

export type SituacaoPeriodo = 'gozado' | 'vencido' | 'vencido_dobro' | 'em_curso'

export interface PeriodoCalculado {
  numero: number
  inicio: Date
  fim: Date
  fimConcessivo: Date
  situacao: SituacaoPeriodo
  faltas: number
  dias: number
  valor: number
}

export interface TempoServico {
  anos: number
  diasAvisoDireito: number
  diasAvisoIndenizados: number
  diasProjecao: number
  dataProjetada: Date
  avosDecimoReal: number
  avosDecimoProjetado: number
  avosFeriasReal: number
  avosFeriasProjetado: number
  diasSaldo: number
  diasFeriasDireito: number
  periodos: PeriodoCalculado[]
}

export interface Fgts {
  aliquota: number
  baseMensal: number
  baseDecimo: number
  mensal: number
  decimo: number
  saldoAnterior: number
  baseMulta: number
  percentualMulta: number
  multa: number
}

export interface ResultadoRescisao {
  entrada: EntradaRescisao
  modalidade: Modalidade
  versaoInss: VersaoTabelas
  versaoIrrf: VersaoTabelas
  tempo: TempoServico
  proventos: Rubrica[]
  descontos: Rubrica[]
  bases: {
    inssMensal: number
    inssDecimo: number
    irrfMensal: number
    irrfDecimo: number
  }
  inssMensal: ResultadoInss
  inssMensalDevido: number
  inssDecimo: ResultadoInss
  irrfMensal: ResultadoIrrf
  irrfMensalDevido: number
  irrfDecimo: ResultadoIrrf
  fgts: Fgts
  totalProventos: number
  totalDescontos: number
  liquido: number
  /** Situacoes que merecem atencao do usuario. */
  alertas: string[]
}

export interface ConfiguracaoRescisao {
  incidencias: IncidenciasRescisao
  regras: RegrasRescisao
  /** Tabela INSS personalizada para a versao vigente, quando houver. */
  inssPersonalizado?: { vigencia: string; tabela: TabelaInss }
  /** Tabela IRRF personalizada para a versao vigente, quando houver. */
  irrfPersonalizado?: { vigencia: string; tabela: TabelaIrrf }
}

export class ErroRescisao extends Error {}

/* ------------------------------------------------------------------ */
/* Calculo                                                             */
/* ------------------------------------------------------------------ */

const m = formatarMoeda

/** valor x numerador x fator / denominador, com fator 1, 0,5 ou 0. */
function proporcional(valor: number, numerador: number, denominador: number, fator = 1): number {
  return dividirArredondando(valor * numerador * Math.round(fator * 2), denominador * 2)
}

function textoFator(fator: number): string {
  return fator === 1 ? '' : ` × ${fator.toLocaleString('pt-BR')}`
}

function versaoPara(data: Date, configuracao: ConfiguracaoRescisao, tipo: string): VersaoTabelas {
  const competencia = chaveMes(data)
  const versao = versaoDaCompetencia(competencia)

  if (!versao) {
    throw new ErroRescisao(`Não há tabelas de ${tipo} cadastradas para a competência ${competencia}.`)
  }

  const { inssPersonalizado, irrfPersonalizado } = configuracao

  return {
    ...versao,
    inss: inssPersonalizado?.vigencia === versao.vigencia ? inssPersonalizado.tabela : versao.inss,
    irrf: irrfPersonalizado?.vigencia === versao.vigencia ? irrfPersonalizado.tabela : versao.irrf,
  }
}

export function calcularRescisao(
  entrada: EntradaRescisao,
  configuracao: ConfiguracaoRescisao,
): ResultadoRescisao {
  const { regras, incidencias } = configuracao
  const alertas: string[] = []

  if (entrada.desligamento < entrada.admissao) {
    throw new ErroRescisao('A data de desligamento é anterior à admissão.')
  }

  const contratoAPrazo = entrada.tipoContrato !== 'indeterminado'
  const base = obterModalidade(entrada.modalidade)

  if (!base.contratos.includes(entrada.tipoContrato)) {
    throw new ErroRescisao(
      `A modalidade "${base.rotulo}" não se aplica a contrato ${ROTULOS_CONTRATO[entrada.tipoContrato].toLowerCase()}.`,
    )
  }

  const modalidade = regraEfetiva(base, contratoAPrazo && entrada.clausulaAssecuratoria)
  const versaoInss = versaoPara(entrada.desligamento, configuracao, 'INSS')
  const versaoIrrf = versaoPara(entrada.pagamento, configuracao, 'IRRF')

  const remuneracaoFixa = entrada.salario + entrada.adicionais
  const remuneracao = remuneracaoFixa + entrada.medias

  const proventos: Rubrica[] = []
  const descontos: Rubrica[] = []

  function lancar(codigo: CodigoRubrica, valor: number, referencia: string, memoria: string[]) {
    if (valor <= 0) return

    const definicao = definicaoRubrica(codigo)
    const rubrica: Rubrica = {
      codigo,
      descricao: definicao.descricao,
      tipo: definicao.tipo,
      natureza: definicao.natureza,
      grupo: definicao.grupo,
      referencia,
      valor,
      incidencia: { ...incidencias[codigo] },
      memoria,
    }

    if (definicao.tipo === 'provento') {
      proventos.push(rubrica)
    } else {
      descontos.push(rubrica)
    }
  }

  /* Aviso previo e projecao ------------------------------------------ */

  const anos = anosCompletos(entrada.admissao, entrada.desligamento)
  let diasAvisoDireito = 0
  let diasAvisoIndenizados = 0
  let fatorAviso = 1

  switch (modalidade.aviso) {
    case 'empregador':
    case 'metade':
    case 'culpa':
    case 'indenizado': {
      diasAvisoDireito = diasAvisoProporcional(entrada.admissao, entrada.desligamento)
      fatorAviso = modalidade.aviso === 'metade' || modalidade.aviso === 'culpa' ? 0.5 : 1

      const indenizado =
        modalidade.aviso === 'indenizado' || modalidade.aviso === 'culpa' || entrada.aviso === 'indenizado'

      if (indenizado) {
        diasAvisoIndenizados = diasAvisoDireito
      } else if (regras.indenizarExcedenteAviso) {
        // Aviso trabalhado: os dias que excedem 30 sao indenizados.
        diasAvisoIndenizados = Math.max(diasAvisoDireito - 30, 0)
      }
      break
    }
    case 'empregado':
      diasAvisoDireito = 30
      break
    case 'nenhum':
      break
  }

  const diasProjecao = regras.projetarAviso ? Math.floor(diasAvisoIndenizados * fatorAviso) : 0
  const dataProjetada = somarDias(entrada.desligamento, diasProjecao)

  if (diasAvisoIndenizados > 0) {
    const regraDias = `30 dias + 3 × ${anos} ${anos === 1 ? 'ano' : 'anos'} = ${diasAvisoDireito} dias (Lei 12.506)`
    const parteIndenizada =
      diasAvisoIndenizados === diasAvisoDireito
        ? `${diasAvisoIndenizados} dias indenizados`
        : `${diasAvisoIndenizados} dias excedentes a 30 indenizados`
    const metade = fatorAviso === 1 ? [] : [`Modalidade com aviso pela metade: × ${fatorAviso.toLocaleString('pt-BR')}.`]

    lancar(
      'aviso_indenizado',
      proporcional(remuneracaoFixa, diasAvisoIndenizados, 30, fatorAviso),
      `${diasAvisoIndenizados} dias`,
      [
        regraDias,
        parteIndenizada,
        ...metade,
        `(${m(entrada.salario)} + adicionais ${m(entrada.adicionais)}) ÷ 30 × ${diasAvisoIndenizados}${textoFator(fatorAviso)}`,
        diasProjecao > 0
          ? `Projeção de ${diasProjecao} dias: data projetada ${formatarData(dataProjetada)}.`
          : 'Projeção do aviso desativada nos parâmetros.',
      ],
    )

    lancar(
      'medias_aviso',
      proporcional(entrada.medias, diasAvisoIndenizados, 30, fatorAviso),
      `${diasAvisoIndenizados} dias`,
      [`Médias ${m(entrada.medias)} ÷ 30 × ${diasAvisoIndenizados}${textoFator(fatorAviso)}`],
    )
  }

  if (modalidade.aviso === 'empregado' && entrada.aviso === 'nao_cumprido') {
    const dias = Math.min(entrada.diasAvisoNaoCumpridos, 30)

    lancar('desconto_aviso', proporcional(remuneracaoFixa, dias, 30), `${dias} dias`, [
      'Aviso prévio do empregado não cumprido (art. 487, § 2º).',
      `(${m(entrada.salario)} + adicionais ${m(entrada.adicionais)}) ÷ 30 × ${dias}`,
    ])
  }

  /* Saldo de salario -------------------------------------------------- */

  const diasMes = diasSaldoSalario(entrada.admissao, entrada.desligamento)
  const diasSaldo = Math.max(diasMes - entrada.faltasMes, 0)
  const memoriaDias = entrada.faltasMes
    ? `${diasMes} dias no mês − ${entrada.faltasMes} faltas = ${diasSaldo} dias`
    : `${diasSaldo} dias no mês (mês comercial de 30 dias)`

  lancar('saldo_salario', proporcional(entrada.salario, diasSaldo, 30), `${diasSaldo} dias`, [
    memoriaDias,
    `${m(entrada.salario)} ÷ 30 × ${diasSaldo}`,
  ])

  lancar('adicionais_saldo', proporcional(entrada.adicionais, diasSaldo, 30), `${diasSaldo} dias`, [
    `Adicionais ${m(entrada.adicionais)} ÷ 30 × ${diasSaldo}`,
  ])

  lancar('variaveis_mes', entrada.variaveisMes, '', ['Valor informado das variáveis do mês.'])

  /* 13o salario ------------------------------------------------------- */

  const ano = entrada.desligamento.getUTCFullYear()
  const avosDecimoReal = avosDecimoTerceiro(entrada.admissao, entrada.desligamento, ano)
  const avosDecimoProjetado =
    avosDecimoTerceiro(entrada.admissao, dataProjetada, ano) +
    (dataProjetada.getUTCFullYear() > ano ? avosDecimoTerceiro(entrada.admissao, dataProjetada, ano + 1) : 0)

  let totalDecimo = 0

  if (modalidade.decimo > 0) {
    const real = proporcional(remuneracao, avosDecimoReal, 12, modalidade.decimo)
    const projetado = proporcional(remuneracao, avosDecimoProjetado - avosDecimoReal, 12, modalidade.decimo)
    const memoriaRemuneracao = `Remuneração ${m(remuneracao)} (salário + adicionais + médias)`

    totalDecimo = real + projetado

    lancar('decimo_proporcional', real, `${avosDecimoReal}/12`, [
      memoriaRemuneracao,
      `${avosDecimoReal} avos em ${ano} até ${formatarData(entrada.desligamento)} (meses com 15 dias ou mais)`,
      `${m(remuneracao)} ÷ 12 × ${avosDecimoReal}${textoFator(modalidade.decimo)}`,
    ])

    lancar('decimo_aviso', projetado, `${avosDecimoProjetado - avosDecimoReal}/12`, [
      `Avos adicionais pela projeção até ${formatarData(dataProjetada)}: ${avosDecimoProjetado - avosDecimoReal}`,
      `${m(remuneracao)} ÷ 12 × ${avosDecimoProjetado - avosDecimoReal}${textoFator(modalidade.decimo)}`,
    ])
  }

  if (entrada.adiantamentoDecimo > 0) {
    lancar('adiantamento_decimo', entrada.adiantamentoDecimo, '', ['Primeira parcela do 13º paga no ano.'])

    if (entrada.adiantamentoDecimo > totalDecimo) {
      alertas.push(
        `O adiantamento de 13º (${m(entrada.adiantamentoDecimo)}) é maior que o 13º devido na rescisão (${m(totalDecimo)}).`,
      )
    }
  }

  /* Ferias ------------------------------------------------------------ */

  const periodos = periodosAquisitivos(entrada.admissao, entrada.desligamento)
  const periodosCalculados: PeriodoCalculado[] = []
  let feriasVencidas = 0
  let feriasDobro = 0
  const memoriaVencidas: string[] = []
  const memoriaDobro: string[] = []
  let indiceCompleto = 0

  // Periodo em curso; se o ultimo terminou no desligamento, o seguinte comeca no dia
  // posterior (relevante para a projecao do aviso).
  const ultimo = periodos.at(-1)
  const periodoAtual =
    periodos.find((periodo) => !periodo.completo) ??
    (ultimo
      ? periodosAquisitivos(entrada.admissao, somarDias(ultimo.fim, 1)).find((periodo) => !periodo.completo) ?? null
      : null)

  for (const periodo of periodos) {
    if (!periodo.completo) {
      continue
    }

    const informado = entrada.periodos[indiceCompleto] ?? { gozado: true, faltas: 0 }
    indiceCompleto += 1

    if (informado.gozado) {
      periodosCalculados.push({ ...periodo, situacao: 'gozado', faltas: informado.faltas, dias: 0, valor: 0 })
      continue
    }

    const dias = diasDeFeriasPorFaltas(informado.faltas)
    const valor = proporcional(remuneracao, dias, 30)
    const dobro = regras.feriasEmDobro && periodo.fimConcessivo < entrada.desligamento
    const intervalo = `${formatarData(periodo.inicio)} a ${formatarData(periodo.fim)}`

    feriasVencidas += valor
    memoriaVencidas.push(
      `Período ${periodo.numero} (${intervalo}): ${informado.faltas} faltas → ${dias} dias; ${m(remuneracao)} ÷ 30 × ${dias} = ${m(valor)}`,
    )

    if (dobro) {
      const dobra = valor + dividirArredondando(valor, 3)

      feriasDobro += dobra
      memoriaDobro.push(
        `Período ${periodo.numero}: concessivo encerrado em ${formatarData(periodo.fimConcessivo)}; dobra de ${m(valor)} + 1/3 = ${m(dobra)}`,
      )
    }

    periodosCalculados.push({
      ...periodo,
      situacao: dobro ? 'vencido_dobro' : 'vencido',
      faltas: informado.faltas,
      dias,
      valor,
    })
  }

  if (periodosCalculados.some((periodo) => periodo.situacao === 'vencido_dobro')) {
    alertas.push('Há férias vencidas fora do período concessivo, pagas em dobro (art. 137).')
  }

  const diasFeriasDireito = diasDeFeriasPorFaltas(entrada.faltasPeriodoAtual)
  let avosFeriasReal = 0
  let avosFeriasProjetado = 0
  let feriasProporcionais = 0
  let feriasAviso = 0

  if (periodoAtual) {
    avosFeriasReal = avosDoPeriodo(periodoAtual.inicio, entrada.desligamento)
    avosFeriasProjetado =
      avosDoPeriodo(periodoAtual.inicio, dataProjetada < periodoAtual.fim ? dataProjetada : periodoAtual.fim) +
      (dataProjetada > periodoAtual.fim ? avosDoPeriodo(somarDias(periodoAtual.fim, 1), dataProjetada) : 0)

    periodosCalculados.push({
      ...periodoAtual,
      situacao: 'em_curso',
      faltas: entrada.faltasPeriodoAtual,
      dias: diasFeriasDireito,
      valor: 0,
    })
  }

  if (modalidade.feriasProporcionais > 0 && periodoAtual) {
    const fator = modalidade.feriasProporcionais

    feriasProporcionais = proporcional(remuneracao, diasFeriasDireito * avosFeriasReal, 360, fator)
    feriasAviso = proporcional(remuneracao, diasFeriasDireito * (avosFeriasProjetado - avosFeriasReal), 360, fator)

    lancar('ferias_proporcionais', feriasProporcionais, `${avosFeriasReal}/12`, [
      `Período em curso desde ${formatarData(periodoAtual.inicio)}: ${avosFeriasReal} avos até ${formatarData(entrada.desligamento)} (fração de 15 dias conta 1 avo)`,
      `${entrada.faltasPeriodoAtual} faltas no período → direito a ${diasFeriasDireito} dias`,
      `${m(remuneracao)} ÷ 30 × ${diasFeriasDireito} ÷ 12 × ${avosFeriasReal}${textoFator(fator)}`,
    ])

    lancar('ferias_aviso', feriasAviso, `${avosFeriasProjetado - avosFeriasReal}/12`, [
      `Avos adicionais pela projeção até ${formatarData(dataProjetada)}: ${avosFeriasProjetado - avosFeriasReal}`,
      `${m(remuneracao)} ÷ 30 × ${diasFeriasDireito} ÷ 12 × ${avosFeriasProjetado - avosFeriasReal}${textoFator(fator)}`,
    ])
  }

  lancar('ferias_vencidas', feriasVencidas, `${memoriaVencidas.length} período(s)`, memoriaVencidas)

  const baseTerco = feriasVencidas + feriasProporcionais + feriasAviso

  lancar('terco_ferias', dividirArredondando(baseTerco, 3), '1/3', [
    `(vencidas ${m(feriasVencidas)} + proporcionais ${m(feriasProporcionais)} + sobre aviso ${m(feriasAviso)}) ÷ 3`,
  ])

  lancar('ferias_dobro', feriasDobro, '', memoriaDobro)

  /* Contratos a prazo: arts. 479 e 480 -------------------------------- */

  if (contratoAPrazo && entrada.fimContrato) {
    const diasRestantes = Math.max(diasInclusivos(entrada.desligamento, entrada.fimContrato) - 1, 0)
    const limite = proporcional(remuneracao, diasRestantes, 60)
    const memoria = [
      `Término previsto em ${formatarData(entrada.fimContrato)}: ${diasRestantes} dias restantes`,
      `${m(remuneracao)} ÷ 30 × ${diasRestantes} × 50%`,
    ]

    if (modalidade.indenizacao479) {
      lancar('indenizacao_479', limite, `${diasRestantes} dias`, memoria)
    }

    if (modalidade.indenizacao480) {
      const informado = entrada.indenizacao480
      const valor = informado === null ? limite : Math.min(informado, limite)

      lancar('indenizacao_480', valor, `${diasRestantes} dias`, [
        ...memoria,
        informado === null
          ? 'Prejuízo não informado: aplicado o limite legal.'
          : `Prejuízo informado ${m(informado)}, limitado a ${m(limite)}.`,
      ])
    }

    if (modalidade.codigo === 'termino_contrato' && diasRestantes !== 0) {
      alertas.push('No término do contrato a prazo, o desligamento deveria coincidir com a data prevista de término.')
    }

    if ((modalidade.indenizacao479 || modalidade.indenizacao480) && diasRestantes === 0) {
      alertas.push('Não há dias restantes até o término previsto: não há antecipação do contrato.')
    }
  }

  if (entrada.tipoContrato === 'experiencia' && entrada.fimContrato) {
    if (diasInclusivos(entrada.admissao, entrada.fimContrato) > 90) {
      alertas.push('O contrato de experiência não pode exceder 90 dias (art. 445, parágrafo único).')
    }
  }

  /* Indenizacoes e descontos avulsos ---------------------------------- */

  if (entrada.indenizacao7238) {
    lancar('indenizacao_7238', remuneracaoFixa, '1 mês', [
      `Salário ${m(entrada.salario)} + adicionais ${m(entrada.adicionais)} (Súmula 242 TST)`,
    ])
  }

  if (entrada.multa477) {
    lancar('multa_477', entrada.salario, '1 salário', [`Salário ${m(entrada.salario)}`])
  }

  lancar('outros_descontos', entrada.outrosDescontos, '', ['Valor informado.'])

  const prazoPagamento = somarDias(entrada.desligamento, 10)

  if (entrada.pagamento > prazoPagamento && !entrada.multa477) {
    alertas.push(
      `Pagamento após ${formatarData(prazoPagamento)} (10 dias do término): avalie a multa do art. 477, § 8º.`,
    )
  }

  /* Bases de calculo -------------------------------------------------- */

  const bases = { inssMensal: 0, inssDecimo: 0, irrfMensal: 0, irrfDecimo: 0, fgtsMensal: 0, fgtsDecimo: 0 }

  for (const rubrica of [...proventos, ...descontos]) {
    const sinal = rubrica.tipo === 'provento' ? 1 : -1
    const decimo = rubrica.grupo === 'decimo'

    if (rubrica.incidencia.inss) bases[decimo ? 'inssDecimo' : 'inssMensal'] += sinal * rubrica.valor
    if (rubrica.incidencia.irrf) bases[decimo ? 'irrfDecimo' : 'irrfMensal'] += sinal * rubrica.valor
    if (rubrica.incidencia.fgts) bases[decimo ? 'fgtsDecimo' : 'fgtsMensal'] += sinal * rubrica.valor
  }

  for (const chave of Object.keys(bases) as (keyof typeof bases)[]) {
    bases[chave] = Math.max(bases[chave], 0)
  }

  /* INSS (por competencia) ------------------------------------------ */

  const anterior = entrada.competenciaAnterior
  const inssMensal = calcularInss(bases.inssMensal + anterior.remuneracao, versaoInss.inss)
  const inssMensalDevido = Math.max(inssMensal.total - anterior.inss, 0)
  const inssDecimo = calcularInss(bases.inssDecimo, versaoInss.inss)

  /* IRRF (regime de caixa) ------------------------------------------- */

  const folha = entrada.folhaAnterior
  const irrfMensal = calcularIrrf(
    {
      rendimento: bases.irrfMensal + folha.rendimentos,
      inss: inssMensalDevido + folha.inss,
      dependentes: entrada.dependentes,
    },
    { tabela: versaoIrrf.irrf },
  )
  const irrfMensalDevido = Math.max(irrfMensal.escolhida.irrf - folha.irrf, 0)

  const irrfDecimo = calcularIrrf(
    { rendimento: bases.irrfDecimo, inss: inssDecimo.total, dependentes: entrada.dependentes },
    { tabela: versaoIrrf.irrf, simplificado: regras.simplificadoNoDecimo, reducao: regras.reducaoNoDecimo },
  )

  const tributos: Rubrica[] = []

  function lancarTributo(
    codigo: CodigoTributo,
    descricao: string,
    grupo: GrupoTributacao,
    valor: number,
    referencia: string,
    memoria: string[],
  ) {
    if (valor <= 0) return

    tributos.push({
      codigo,
      descricao,
      tipo: 'desconto',
      natureza: 'tributo',
      grupo,
      referencia,
      valor,
      incidencia: { inss: false, irrf: false, fgts: false },
      memoria,
    })
  }

  lancarTributo('inss_mensal', 'INSS', 'mensal', inssMensalDevido, `base ${m(inssMensal.baseConsiderada)}`, [
    `Base da rescisão ${m(bases.inssMensal)}` +
      (anterior.remuneracao ? ` + remuneração já paga na competência ${m(anterior.remuneracao)}` : ''),
    `INSS progressivo: ${m(inssMensal.total)}` + (anterior.inss ? ` − já descontado ${m(anterior.inss)}` : ''),
  ])

  lancarTributo('inss_decimo', 'INSS sobre 13º salário', 'decimo', inssDecimo.total, `base ${m(inssDecimo.baseConsiderada)}`, [
    `Base do 13º ${m(bases.inssDecimo)}, calculada separadamente.`,
  ])

  lancarTributo(
    'irrf_mensal',
    'IRRF',
    'mensal',
    irrfMensalDevido,
    formatarPercentual(irrfMensal.escolhida.faixa.aliquota),
    [
      `Rendimentos da rescisão ${m(bases.irrfMensal)}` +
        (folha.rendimentos ? ` + folha anterior paga no mês ${m(folha.rendimentos)}` : ''),
      `${irrfMensal.escolhida.nome}: IRRF ${m(irrfMensal.escolhida.irrf)}` +
        (folha.irrf ? ` − já retido ${m(folha.irrf)}` : ''),
    ],
  )

  lancarTributo(
    'irrf_decimo',
    'IRRF sobre 13º salário',
    'decimo',
    irrfDecimo.escolhida.irrf,
    formatarPercentual(irrfDecimo.escolhida.faixa.aliquota),
    [`Tributação exclusiva sobre ${m(bases.irrfDecimo)}; ${irrfDecimo.escolhida.nome}.`],
  )

  /* FGTS ------------------------------------------------------------- */

  const fgtsMensal = dividirArredondando(bases.fgtsMensal * regras.aliquotaFgts, 10000)
  const fgtsDecimo = dividirArredondando(bases.fgtsDecimo * regras.aliquotaFgts, 10000)
  const baseMulta = entrada.saldoFgts + fgtsMensal + fgtsDecimo

  const fgts: Fgts = {
    aliquota: regras.aliquotaFgts,
    baseMensal: bases.fgtsMensal,
    baseDecimo: bases.fgtsDecimo,
    mensal: fgtsMensal,
    decimo: fgtsDecimo,
    saldoAnterior: entrada.saldoFgts,
    baseMulta,
    percentualMulta: modalidade.multaFgts,
    multa: dividirArredondando(baseMulta * modalidade.multaFgts, 10000),
  }

  /* Totais ----------------------------------------------------------- */

  const todosDescontos = [...descontos, ...tributos]
  const totalProventos = proventos.reduce((soma, item) => soma + item.valor, 0)
  const totalDescontos = todosDescontos.reduce((soma, item) => soma + item.valor, 0)
  const liquido = totalProventos - totalDescontos

  if (liquido < 0) {
    alertas.push('Os descontos superam os proventos: o líquido da rescisão é negativo.')
  }

  if (chaveMes(entrada.desligamento).slice(0, 4) !== versaoInss.vigencia.slice(0, 4)) {
    alertas.push(`Aplicadas as ${versaoInss.rotulo}. Confirme se há tabelas atualizadas para a competência.`)
  }

  return {
    entrada,
    modalidade,
    versaoInss,
    versaoIrrf,
    tempo: {
      anos,
      diasAvisoDireito,
      diasAvisoIndenizados,
      diasProjecao,
      dataProjetada,
      avosDecimoReal,
      avosDecimoProjetado,
      avosFeriasReal,
      avosFeriasProjetado,
      diasSaldo,
      diasFeriasDireito,
      periodos: periodosCalculados,
    },
    proventos,
    descontos: todosDescontos,
    bases: {
      inssMensal: bases.inssMensal,
      inssDecimo: bases.inssDecimo,
      irrfMensal: bases.irrfMensal,
      irrfDecimo: bases.irrfDecimo,
    },
    inssMensal,
    inssMensalDevido,
    inssDecimo,
    irrfMensal,
    irrfMensalDevido,
    irrfDecimo,
    fgts,
    totalProventos,
    totalDescontos,
    liquido,
    alertas,
  }
}
