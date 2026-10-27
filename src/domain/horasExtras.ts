/*
 * Horas extras lancadas em horas:
 *   valor = base x minutos x (100% + adicional) / (divisor x 60)
 *
 * A base e o salario mensal (ou a base informada, quando ha adicionais que
 * integram o valor-hora, Sumula 264 do TST). O arredondamento e feito uma
 * unica vez, no valor de cada linha; o valor-hora e exibido apenas como
 * referencia.
 */

/** 300:00 horas por linha. */
export const LIMITE_MINUTOS_HORA_EXTRA = 300 * 60
/** 200% de adicional, em pontos-base. */
export const LIMITE_ADICIONAL_HORA_EXTRA = 20000
export const LIMITE_DIVISOR = 400

export interface LinhaHoraExtra {
  minutos: number
  /** Adicional em pontos-base (50% = 5000). */
  adicional: number
}

export interface EntradaHorasExtras {
  /** Base do valor-hora, em centavos. */
  base: number
  divisor: number
  linhas: LinhaHoraExtra[]
}

export interface LinhaHoraExtraCalculada extends LinhaHoraExtra {
  valor: number
}

export interface ResultadoHorasExtras {
  entrada: EntradaHorasExtras
  /** Valor-hora em centavos fracionarios (base / divisor). */
  valorHora: number
  linhas: LinhaHoraExtraCalculada[]
  total: number
}

/** Valor de uma linha, arredondado meio para cima (BigInt: o produto passa do limite seguro). */
export function valorLinhaHoraExtra(base: number, divisor: number, linha: LinhaHoraExtra): number {
  const numerador = BigInt(base) * BigInt(linha.minutos) * BigInt(10000 + linha.adicional)
  const denominador = BigInt(divisor) * BigInt(60 * 10000)

  return Number((numerador * BigInt(2) + denominador) / (denominador * BigInt(2)))
}

export function calcularHorasExtras(entrada: EntradaHorasExtras): ResultadoHorasExtras {
  const linhas = entrada.linhas.map((linha) => ({
    ...linha,
    valor: valorLinhaHoraExtra(entrada.base, entrada.divisor, linha),
  }))

  return {
    entrada,
    valorHora: entrada.base / entrada.divisor,
    linhas,
    total: linhas.reduce((soma, linha) => soma + linha.valor, 0),
  }
}

/**
 * Converte "10:30" em minutos. Aceita horas inteiras sem minutos ("10").
 * Retorna `null` quando vazio e `NaN` quando invalido.
 */
export function lerHoras(texto: string): number | null {
  const limpo = String(texto ?? '').trim()

  if (!limpo) {
    return null
  }

  const partes = /^(\d{1,3})(?::([0-5]\d))?$/.exec(limpo)

  return partes ? Number(partes[1]) * 60 + Number(partes[2] ?? 0) : Number.NaN
}

/** 630 -> "10:30". */
export function formatarHoras(minutos: number): string {
  const horas = Math.floor(minutos / 60)

  return `${String(horas).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`
}

/**
 * Mascara de digitacao sobre os digitos: "1030" -> "10:30" (os dois ultimos sao
 * os minutos). Os dois-pontos digitados sao ignorados, entao "10:30" tambem funciona.
 */
export function mascararHoras(texto: string): string {
  const digitos = texto.replace(/\D/g, '').replace(/^0+(?=\d{3})/, '').slice(0, 5)

  return digitos.length <= 2 ? digitos : `${digitos.slice(0, -2)}:${digitos.slice(-2)}`
}

const numeroPercentual = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })

/** 5000 -> "50%". */
export function formatarAdicional(pontos: number): string {
  return `${numeroPercentual.format(pontos / 100)}%`
}
