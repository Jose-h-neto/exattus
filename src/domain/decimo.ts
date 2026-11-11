import { dividirArredondando } from './dinheiro'
import { calcularFgts, type ResultadoFgts } from './fgts'
import type { Conferencia } from './folha'
import { calcularInss, type ResultadoInss } from './inss'
import { calcularIrrf, type ResultadoIrrf } from './irrf'
import { IRRF_2026, type TabelaInss, type TabelaIrrf } from './parametros'

/*
 * 13o salario (Lei 4.090/1962 e Lei 4.749/1965).
 *
 * 13o integral = (salario + media mensal das variaveis) / 12 x avos.
 * Um avo por mes com 15 dias ou mais de trabalho no ano.
 *
 * 1a parcela (adiantamento, ate 30/11): metade do 13o integral, sem INSS e
 *   sem IRRF. O FGTS incide sobre o valor pago.
 * 2a parcela (ate 20/12): 13o integral, com INSS (tabela propria, separada
 *   da folha do mes) e IRRF exclusivo na fonte sobre o integral; desconta a
 *   1a parcela ja paga. O FGTS incide sobre o integral menos a 1a parcela.
 */

export type ParcelaDecimo = 'primeira' | 'segunda'

export interface EntradaDecimo {
  parcela: ParcelaDecimo
  salario: number
  /** Media MENSAL de horas extras, comissoes e adicionais variaveis. */
  medias: number
  /** Meses com 15 dias ou mais de trabalho no ano (1 a 12). */
  avos: number
  dependentes: number
  /** 2a parcela: valor da 1a parcela ja paga; null = metade do 13o calculado. */
  primeiraParcelaPaga: number | null
  inssInformado: number | null
  irrfInformado: number | null
}

export interface ResultadoDecimo {
  entrada: EntradaDecimo
  /** Salario + medias. */
  remuneracao: number
  /** 13o integral: remuneracao / 12 x avos. */
  integral: number
  /** Metade do integral: valor da 1a parcela calculada. */
  primeiraParcela: number
  /** Provento do recibo: 1a parcela ou 13o integral (2a). */
  bruto: number
  /** 2a parcela: 1a parcela descontada (informada ou calculada). */
  adiantamento: number
  usouPrimeiraInformada: boolean
  /** Somente na 2a parcela. */
  inss: ResultadoInss | null
  irrf: ResultadoIrrf | null
  totalDescontos: number
  liquido: number
  fgts: ResultadoFgts
  conferenciaInss: Conferencia | null
  conferenciaIrrf: Conferencia | null
}

export const ROTULO_PARCELA: Record<ParcelaDecimo, string> = {
  primeira: '1ª parcela',
  segunda: '2ª parcela',
}

function conferir(calculado: number, informado: number | null): Conferencia | null {
  return informado === null ? null : { calculado, informado, diferenca: informado - calculado }
}

export function calcularDecimo(
  entrada: EntradaDecimo,
  tabela: TabelaInss,
  tabelaIrrf: Readonly<TabelaIrrf> = IRRF_2026,
): ResultadoDecimo {
  const remuneracao = entrada.salario + entrada.medias
  const integral = dividirArredondando(remuneracao * entrada.avos, 12)
  const primeiraParcela = dividirArredondando(integral, 2)

  if (entrada.parcela === 'primeira') {
    return {
      entrada,
      remuneracao,
      integral,
      primeiraParcela,
      bruto: primeiraParcela,
      adiantamento: 0,
      usouPrimeiraInformada: false,
      inss: null,
      irrf: null,
      totalDescontos: 0,
      liquido: primeiraParcela,
      fgts: calcularFgts(primeiraParcela),
      conferenciaInss: null,
      conferenciaIrrf: null,
    }
  }

  const adiantamento = entrada.primeiraParcelaPaga ?? primeiraParcela
  const inss = calcularInss(integral, tabela)

  // Tributacao exclusiva: o 13o nao soma com a folha do mes. Mesmas regras padrao da rescisao
  // (desconto simplificado e reducao da Lei 15.270/2025 permitidos).
  const irrf = calcularIrrf(
    { rendimento: integral, inss: inss.total, dependentes: entrada.dependentes },
    { tabela: tabelaIrrf },
  )

  const totalDescontos = inss.total + irrf.escolhida.irrf + adiantamento

  return {
    entrada,
    remuneracao,
    integral,
    primeiraParcela,
    bruto: integral,
    adiantamento,
    usouPrimeiraInformada: entrada.primeiraParcelaPaga !== null,
    inss,
    irrf,
    totalDescontos,
    liquido: integral - totalDescontos,
    fgts: calcularFgts(integral - adiantamento),
    conferenciaInss: conferir(inss.total, entrada.inssInformado),
    conferenciaIrrf: conferir(irrf.escolhida.irrf, entrada.irrfInformado),
  }
}
