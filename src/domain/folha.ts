import { dividirArredondando } from './dinheiro'
import { calcularInss, type Modalidade, type ResultadoInss } from './inss'
import { calcularIrrf, type ResultadoIrrf } from './irrf'
import { IRRF_2026, type TabelaInss, type TabelaIrrf } from './parametros'

export interface EntradaFolha {
  modalidade: Modalidade
  salario: number
  /** Dias trabalhados no mes comercial de 30 dias. */
  dias: number
  dependentes: number
  /** Base do INSS diferente do salario proporcional. */
  baseInssManual: number | null
  inssInformado: number | null
  irrfInformado: number | null
}

export interface Conferencia {
  calculado: number
  informado: number
  /** Informado - calculado. */
  diferenca: number
}

export interface ResultadoFolha {
  entrada: EntradaFolha
  /** Valor-dia em centavos fracionarios (salario / 30). */
  valorDia: number
  proporcional: number
  baseInss: number
  inss: ResultadoInss
  irrf: ResultadoIrrf
  totalDescontos: number
  liquido: number
  conferenciaInss: Conferencia | null
  conferenciaIrrf: Conferencia | null
}

function conferir(calculado: number, informado: number | null): Conferencia | null {
  return informado === null ? null : { calculado, informado, diferenca: informado - calculado }
}

export function calcularFolha(
  entrada: EntradaFolha,
  tabela: TabelaInss,
  tabelaIrrf: Readonly<TabelaIrrf> = IRRF_2026,
): ResultadoFolha {
  const proporcional = dividirArredondando(entrada.salario * entrada.dias, 30)
  const baseInss = entrada.baseInssManual ?? proporcional
  const inss = calcularInss(baseInss, tabela, entrada.modalidade)

  const irrf = calcularIrrf({
    rendimento: proporcional,
    inss: inss.total,
    dependentes: entrada.dependentes,
  }, { tabela: tabelaIrrf })

  const totalDescontos = inss.total + irrf.escolhida.irrf

  return {
    entrada,
    valorDia: entrada.salario / 30,
    proporcional,
    baseInss,
    inss,
    irrf,
    totalDescontos,
    liquido: proporcional - totalDescontos,
    conferenciaInss: conferir(inss.total, entrada.inssInformado),
    conferenciaIrrf: conferir(irrf.escolhida.irrf, entrada.irrfInformado),
  }
}
