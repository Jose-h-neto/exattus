import { dividirArredondando, formatarMoeda, formatarPercentual } from './dinheiro'
import { ALIQUOTA_FGTS } from './parametros'

/*
 * FGTS: deposito do empregador (Lei 8.036/1990, art. 15), fora do liquido.
 * Nao ha teto: incide sobre toda a remuneracao do mes.
 */

export interface ResultadoFgts {
  base: number
  /** Pontos-base (800 = 8%). */
  aliquota: number
  valor: number
}

export function calcularFgts(base: number, aliquota = ALIQUOTA_FGTS): ResultadoFgts {
  const baseValida = Math.max(0, base)

  return { base: baseValida, aliquota, valor: dividirArredondando(baseValida * aliquota, 10000) }
}

/** Linha de encargo para o demonstrativo: "FGTS (8%)" e a conta "base × 8%". */
export function encargoFgts(fgts: ResultadoFgts | null, rotulo = 'FGTS') {
  if (!fgts) return []

  return [{ rotulo: `${rotulo} (${formatarPercentual(fgts.aliquota)})`, detalhe: `${formatarMoeda(fgts.base)} × ${formatarPercentual(fgts.aliquota)}`, valor: fgts.valor }]
}
