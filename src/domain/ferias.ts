import { chaveMes, somarDias } from './datas'
import { dividirArredondando } from './dinheiro'
import { calcularFgts, type ResultadoFgts } from './fgts'
import { calcularInss, type ResultadoInss } from './inss'
import { calcularIrrf, type ResultadoIrrf } from './irrf'
import { tabelasDaCompetencia, type OpcoesTabelas } from './parametros'

/*
 * Ordem do calculo:
 * 1. Salario bruto / 30 x dias de gozo.
 * 2. Soma das medias (valor TOTAL correspondente aos dias gozados).
 * 3. 1/3 sobre salario proporcional + medias.
 * 4. Abono pecuniario isento; o 1/3 sobre o abono integra a base do IRRF.
 * 5. INSS separado por competencia de gozo (sem abono e sem o 1/3 do abono),
 *    cada competencia com a tabela do seu ano. Sem tabela cadastrada para o ano
 *    (gozo que vira o ano), usa a mais recente e marca o INSS como provisorio.
 * 6. IRRF exclusivo sobre ferias + 1/3 + 1/3 do abono, sobre o total, pela
 *    tabela vigente na data do pagamento.
 */

export interface EntradaFerias {
  salario: number
  medias: number
  diasFerias: number
  dependentes: number
  inicio: Date
  fim: Date
  pagamento: Date
  diasAbono: number
  inssManual: number | null
}

export interface CompetenciaFerias {
  chave: string
  dias: number
  salario: number
  medias: number
  terco: number
  /** Ferias + medias + 1/3 da competencia: valor bruto e base do INSS. */
  base: number
  inss: ResultadoInss
  /** Ano da tabela de INSS aplicada. */
  anoTabela: number
  /** Nao ha tabela do ano da competencia: usada a mais recente (rever quando a oficial sair). */
  provisoria: boolean
}

export interface ResultadoFerias {
  entrada: EntradaFerias
  salarioFerias: number
  mediasFerias: number
  ferias: number
  terco: number
  /** Ferias + 1/3: base do INSS. */
  tributavel: number
  /** Ferias + 1/3 + 1/3 do abono: rendimento do IRRF. */
  rendimentoIrrf: number
  salarioAbono: number
  mediasAbono: number
  abono: number
  tercoAbono: number
  totalAbono: number
  totalBruto: number
  competencias: CompetenciaFerias[]
  inssEstimado: number
  inssUsado: number
  usouInssManual: boolean
  /** Alguma competencia usou tabela de outro ano por falta da tabela do ano dela. */
  inssProvisorio: boolean
  irrf: ResultadoIrrf
  /** Ano da tabela de IRRF aplicada (vigente na data do pagamento). */
  anoTabelaIrrf: number
  totalDescontos: number
  liquido: number
  /** Sobre ferias + 1/3; o abono pecuniario e o 1/3 do abono nao tem FGTS. */
  fgts: ResultadoFgts
}

export function separarCompetencias(inicio: Date, dias: number): { chave: string; dias: number }[] {
  const mapa = new Map<string, number>()

  for (let indice = 0; indice < dias; indice += 1) {
    const chave = chaveMes(somarDias(inicio, indice))

    mapa.set(chave, (mapa.get(chave) ?? 0) + 1)
  }

  return Array.from(mapa, ([chave, quantidade]) => ({ chave, dias: quantidade }))
}

/** Rateio proporcional sem perda de centavos (maiores restos). */
export function ratearPorPesos(total: number, pesos: number[]): number[] {
  const somaPesos = pesos.reduce((soma, peso) => soma + peso, 0)

  if (total === 0) {
    return pesos.map(() => 0)
  }

  if (somaPesos <= 0) {
    throw new Error('Não foi possível ratear um valor sem uma base positiva.')
  }

  const itens = pesos.map((peso, indice) => ({
    indice,
    valor: Math.floor((total * peso) / somaPesos),
    resto: (total * peso) % somaPesos,
  }))

  const diferenca = total - itens.reduce((soma, item) => soma + item.valor, 0)
  const ordem = [...itens].sort((a, b) => b.resto - a.resto || a.indice - b.indice)

  for (let indice = 0; indice < diferenca; indice += 1) {
    const item = ordem[indice % ordem.length]

    if (item) {
      item.valor += 1
    }
  }

  return itens.map((item) => item.valor)
}

/**
 * tabelas: versoes cadastradas e as tabelas editadas em Parametros (que valem
 * para a versao mais recente). Sem opcoes, usa as tabelas oficiais.
 */
export function calcularFerias(entrada: EntradaFerias, tabelas: OpcoesTabelas = {}): ResultadoFerias {
  const salarioFerias = dividirArredondando(entrada.salario * entrada.diasFerias, 30)
  const mediasFerias = entrada.medias
  const ferias = salarioFerias + mediasFerias
  const terco = dividirArredondando(ferias, 3)
  const tributavel = ferias + terco

  // As medias do abono usam a mesma media diaria dos dias gozados.
  const salarioAbono = dividirArredondando(entrada.salario * entrada.diasAbono, 30)
  const mediasAbono = entrada.diasAbono === 0
    ? 0
    : dividirArredondando(entrada.medias * entrada.diasAbono, entrada.diasFerias)
  const abono = salarioAbono + mediasAbono
  const tercoAbono = dividirArredondando(abono, 3)
  const totalAbono = abono + tercoAbono

  const totalBruto = tributavel + totalAbono

  // Somente o abono e isento; o 1/3 sobre o abono e tributavel pelo IRRF.
  const rendimentoIrrf = tributavel + tercoAbono

  const periodos = separarCompetencias(entrada.inicio, entrada.diasFerias)
  const dias = periodos.map((item) => item.dias)
  const salarios = ratearPorPesos(salarioFerias, dias)
  const medias = ratearPorPesos(mediasFerias, dias)
  const basesSemTerco = periodos.map((_, indice) => (salarios[indice] ?? 0) + (medias[indice] ?? 0))
  const tercos = ratearPorPesos(terco, basesSemTerco)

  const competencias = periodos.map((periodo, indice) => {
    const salario = salarios[indice] ?? 0
    const mediasCompetencia = medias[indice] ?? 0
    const tercoCompetencia = tercos[indice] ?? 0
    const base = salario + mediasCompetencia + tercoCompetencia
    const vigentes = tabelasDaCompetencia(periodo.chave, tabelas)

    return {
      ...periodo,
      salario,
      medias: mediasCompetencia,
      terco: tercoCompetencia,
      base,
      inss: calcularInss(base, vigentes.inss),
      anoTabela: vigentes.ano,
      provisoria: vigentes.provisoria,
    }
  })

  const inssEstimado = competencias.reduce((soma, item) => soma + item.inss.total, 0)
  const inssUsado = entrada.inssManual ?? inssEstimado

  // IRRF sobre o total (nao por competencia), pela tabela da data do pagamento.
  const tabelasPagamento = tabelasDaCompetencia(chaveMes(entrada.pagamento), tabelas)

  const irrf = calcularIrrf({
    rendimento: rendimentoIrrf,
    inss: inssUsado,
    dependentes: entrada.dependentes,
  }, { tabela: tabelasPagamento.irrf })

  const totalDescontos = inssUsado + irrf.escolhida.irrf

  return {
    entrada,
    salarioFerias,
    mediasFerias,
    ferias,
    terco,
    tributavel,
    rendimentoIrrf,
    salarioAbono,
    mediasAbono,
    abono,
    tercoAbono,
    totalAbono,
    totalBruto,
    competencias,
    inssEstimado,
    inssUsado,
    usouInssManual: entrada.inssManual !== null,
    inssProvisorio: competencias.some((item) => item.provisoria),
    irrf,
    anoTabelaIrrf: tabelasPagamento.ano,
    totalDescontos,
    liquido: Math.max(0, totalBruto - totalDescontos),
    fgts: calcularFgts(tributavel),
  }
}

/**
 * Aviso quando o gozo vira o ano, ex.:
 * "5 dias caem em 2027. INSS calculado com a tabela de 2026 (provisório)."
 * null quando todo o gozo fica no ano do inicio.
 */
export function avisoViradaDeAno(resultado: ResultadoFerias): string | null {
  const anoInicio = resultado.entrada.inicio.getUTCFullYear()
  const porAno = new Map<number, CompetenciaFerias[]>()

  for (const competencia of resultado.competencias) {
    const ano = Number(competencia.chave.slice(0, 4))

    if (ano !== anoInicio) porAno.set(ano, [...(porAno.get(ano) ?? []), competencia])
  }

  if (!porAno.size) return null

  return [...porAno]
    .map(([ano, lista]) => {
      const dias = lista.reduce((soma, item) => soma + item.dias, 0)
      const anosTabela = [...new Set(lista.map((item) => item.anoTabela))].join(' e ')
      const provisorio = lista.some((item) => item.provisoria)

      return (
        `${dias} ${dias === 1 ? 'dia cai' : 'dias caem'} em ${ano}. ` +
        `INSS calculado com a tabela de ${anosTabela}${provisorio ? ' (provisório)' : ''}.`
      )
    })
    .join(' ')
}
