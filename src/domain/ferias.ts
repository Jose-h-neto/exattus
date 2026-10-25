import { chaveMes, somarDias } from './datas'
import { dividirArredondando } from './dinheiro'
import { calcularInss, type ResultadoInss } from './inss'
import { calcularIrrf, type ResultadoIrrf } from './irrf'
import type { TabelaInss } from './parametros'

/*
 * Ordem do calculo:
 * 1. Salario bruto / 30 x dias de gozo.
 * 2. Soma das medias (valor TOTAL correspondente aos dias gozados).
 * 3. 1/3 sobre salario proporcional + medias.
 * 4. Abono pecuniario isento; o 1/3 sobre o abono integra a base do IRRF.
 * 5. INSS separado por competencia de gozo (sem abono e sem o 1/3 do abono).
 * 6. IRRF exclusivo sobre ferias + 1/3 + 1/3 do abono.
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
  base: number
  inss: ResultadoInss
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
  irrf: ResultadoIrrf
  totalDescontos: number
  liquido: number
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

export function calcularFerias(entrada: EntradaFerias, tabela: TabelaInss): ResultadoFerias {
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

    return {
      ...periodo,
      salario,
      medias: mediasCompetencia,
      terco: tercoCompetencia,
      base,
      inss: calcularInss(base, tabela),
    }
  })

  const inssEstimado = competencias.reduce((soma, item) => soma + item.inss.total, 0)
  const inssUsado = entrada.inssManual ?? inssEstimado

  const irrf = calcularIrrf({
    rendimento: rendimentoIrrf,
    inss: inssUsado,
    dependentes: entrada.dependentes,
  })

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
    irrf,
    totalDescontos,
    liquido: Math.max(0, totalBruto - totalDescontos),
  }
}
