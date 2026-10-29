import { dividirArredondando } from './dinheiro'
import { calcularInss, type Modalidade, type ResultadoInss } from './inss'
import { calcularIrrf, type ResultadoIrrf } from './irrf'
import { IRRF_2026, type TabelaInss, type TabelaIrrf } from './parametros'

export interface EntradaFolha {
  modalidade: Modalidade
  salario: number
  /** Dias trabalhados no mes comercial de 30 dias. */
  dias: number
  /** Valor das horas extras do mes, nao proporcionalizado pelos dias. */
  horasExtras: number
  /** Valor das comissoes do mes, nao proporcionalizado pelos dias. */
  comissoes: number
  /** DSR sobre horas extras e comissoes, como consta no holerite. */
  dsr: number
  dependentes: number
  /** Adiantamento salarial (vale): descontado do liquido, depois do INSS e do IRRF. */
  adiantamentoSalarial: number
  /** Liquido de ferias pago antecipadamente: descontado do liquido, depois do INSS e do IRRF. */
  adiantamentoFerias: number
  /** Base do INSS diferente do total de proventos. */
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
  /** Salario proporcional + horas extras + comissoes + DSR: base do INSS e do IRRF. */
  totalProventos: number
  baseInss: number
  inss: ResultadoInss
  irrf: ResultadoIrrf
  /** Adiantamentos (salarial + ferias): fora das bases, so reduzem o liquido. */
  adiantamentos: number
  /** INSS + IRRF + adiantamentos. */
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
  const totalProventos = proporcional + entrada.horasExtras + entrada.comissoes + entrada.dsr
  const baseInss = entrada.baseInssManual ?? totalProventos
  const inss = calcularInss(baseInss, tabela, entrada.modalidade)

  const irrf = calcularIrrf({
    rendimento: totalProventos,
    inss: inss.total,
    dependentes: entrada.dependentes,
  }, { tabela: tabelaIrrf })

  // Adiantamentos entram depois dos tributos: nao alteram as bases do INSS e do IRRF.
  const adiantamentos = entrada.adiantamentoSalarial + entrada.adiantamentoFerias
  const totalDescontos = inss.total + irrf.escolhida.irrf + adiantamentos

  return {
    entrada,
    valorDia: entrada.salario / 30,
    proporcional,
    totalProventos,
    baseInss,
    inss,
    irrf,
    adiantamentos,
    totalDescontos,
    liquido: totalProventos - totalDescontos,
    conferenciaInss: conferir(inss.total, entrada.inssInformado),
    conferenciaIrrf: conferir(irrf.escolhida.irrf, entrada.irrfInformado),
  }
}
