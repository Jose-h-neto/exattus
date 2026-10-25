import { dividirArredondando } from './dinheiro'
import type { FaixaInss, TabelaInss } from './parametros'

export type Modalidade = 'empregado' | 'prolabore'

export interface EtapaInss {
  numero: number
  de: number
  ate: number
  base: number
  aliquota: number
  valor: number
  usouValorFixo: boolean
}

export interface ResultadoInss {
  modalidade: Modalidade
  base: number
  /** Base limitada ao teto. */
  baseConsiderada: number
  teto: number
  limitado: boolean
  /** Aliquota unica do pro-labore; `null` no calculo progressivo. */
  aliquota: number | null
  etapas: EtapaInss[]
  total: number
}

export function tetoInss(tabela: TabelaInss): number {
  return tabela.faixas.at(-1)?.limite ?? 0
}

export function calcularInss(
  baseOriginal: number,
  tabela: TabelaInss,
  modalidade: Modalidade = 'empregado',
): ResultadoInss {
  const teto = tetoInss(tabela)
  const base = Math.max(baseOriginal, 0)
  const baseConsiderada = Math.min(base, teto)
  const limitado = base > teto

  if (modalidade === 'prolabore') {
    return {
      modalidade,
      base,
      baseConsiderada,
      teto,
      limitado,
      aliquota: tabela.aliquotaProlabore,
      etapas: [],
      total: dividirArredondando(baseConsiderada * tabela.aliquotaProlabore, 10000),
    }
  }

  const etapas: EtapaInss[] = []
  let limiteAnterior = 0
  let total = 0

  for (const [indice, faixa] of tabela.faixas.entries()) {
    if (baseConsiderada <= limiteAnterior) {
      break
    }

    const baseFaixa = Math.min(baseConsiderada, faixa.limite) - limiteAnterior
    const usouValorFixo = baseConsiderada >= faixa.limite && faixa.valorFixo !== null

    const valor = usouValorFixo
      ? (faixa.valorFixo ?? 0)
      : dividirArredondando(baseFaixa * faixa.aliquota, 10000)

    total += valor

    etapas.push({
      numero: indice + 1,
      de: limiteAnterior,
      ate: faixa.limite,
      base: baseFaixa,
      aliquota: faixa.aliquota,
      valor,
      usouValorFixo,
    })

    limiteAnterior = faixa.limite
  }

  return {
    modalidade,
    base,
    baseConsiderada,
    teto,
    limitado,
    aliquota: null,
    etapas,
    total,
  }
}

/** Contribuicao de uma faixa completa: (limite - limite anterior) x aliquota. */
export function valorCheioFaixa(faixas: FaixaInss[], indice: number): number {
  const faixa = faixas[indice]
  const anterior = faixas[indice - 1]?.limite ?? 0

  if (!faixa) {
    return 0
  }

  return dividirArredondando(Math.max(faixa.limite - anterior, 0) * faixa.aliquota, 10000)
}

export function validarTabelaInss(tabela: TabelaInss): string[] {
  const erros: string[] = []
  let anterior = 0

  tabela.faixas.forEach((faixa, indice) => {
    if (faixa.limite <= anterior) {
      erros.push(`O limite da faixa ${indice + 1} deve ser maior que o da faixa anterior.`)
    }

    if (faixa.aliquota > 10000) {
      erros.push(`A alíquota da faixa ${indice + 1} não pode passar de 100%.`)
    }

    anterior = faixa.limite
  })

  if (tabela.aliquotaProlabore > 10000) {
    erros.push('A alíquota do pró-labore não pode passar de 100%.')
  }

  return erros
}
