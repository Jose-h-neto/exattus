/*
 * Todos os valores monetarios da Exattus sao processados em centavos inteiros
 * e todas as aliquotas em pontos-base (7,5% = 750), evitando erros de ponto
 * flutuante.
 */

export function dividirArredondando(numerador: number, denominador: number): number {
  return Math.floor((numerador + denominador / 2) / denominador)
}

/**
 * Aceita "5500", "5500,00", "5.500,00", "5,500.00", "5.500" e "R$ 5.500,00".
 */
export function normalizarValor(valor: string): string {
  let texto = String(valor ?? '')
    .trim()
    .replace(/R\$/gi, '')
    .replace(/[\s%]/g, '')

  if (!texto) {
    return ''
  }

  const virgula = texto.lastIndexOf(',')
  const ponto = texto.lastIndexOf('.')

  if (virgula >= 0 && ponto >= 0) {
    texto = virgula > ponto
      ? texto.replace(/\./g, '').replace(',', '.')
      : texto.replace(/,/g, '')
  } else if (virgula >= 0) {
    texto = texto.replace(/\./g, '').replace(',', '.')
  } else {
    const partes = texto.split('.')
    const ultima = partes.at(-1) ?? ''

    if (partes.length > 1) {
      // "5.500" e "1.234.567" sao separadores de milhar; "1.234.56" tem decimal.
      texto = ultima.length === 3
        ? partes.join('')
        : `${partes.slice(0, -1).join('')}.${ultima}`
    }
  }

  return texto
}

/**
 * Converte o texto digitado em centavos.
 * Retorna `null` quando vazio e `NaN` quando invalido.
 */
export function paraCentavos(valor: string): number | null {
  const texto = normalizarValor(valor)

  if (!texto) {
    return null
  }

  if (!/^\d+(\.\d{0,2})?$/.test(texto)) {
    return Number.NaN
  }

  const [inteiro = '0', decimal = ''] = texto.split('.')
  const resultado = Number(inteiro) * 100 + Number(decimal.padEnd(2, '0'))

  return Number.isSafeInteger(resultado) ? resultado : Number.NaN
}

/** Inteiro nao negativo dentro do intervalo; `null` quando vazio e `NaN` quando invalido. */
export function paraInteiro(valor: string, minimo: number, maximo: number): number | null {
  const texto = String(valor ?? '').trim()

  if (!texto) {
    return null
  }

  if (!/^\d+$/.test(texto)) {
    return Number.NaN
  }

  const numero = Number(texto)

  return numero >= minimo && numero <= maximo ? numero : Number.NaN
}

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

const decimal = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const percentual = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
})

export function formatarMoeda(centavos: number): string {
  return moeda.format((Number.isFinite(centavos) ? centavos : 0) / 100)
}

/** Formato usado dentro dos campos: "5.500,00". */
export function formatarDecimal(centavos: number): string {
  return decimal.format(centavos / 100)
}

export function formatarPercentual(pontos: number): string {
  return `${percentual.format((Number.isFinite(pontos) ? pontos : 0) / 100)}%`
}
