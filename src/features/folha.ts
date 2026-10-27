import { reactive } from 'vue'

import { paraCentavos, paraInteiro } from '@/domain/dinheiro'
import type { EntradaFolha } from '@/domain/folha'
import {
  calcularHorasExtras,
  lerHoras,
  LIMITE_ADICIONAL_HORA_EXTRA,
  LIMITE_DIVISOR,
  LIMITE_MINUTOS_HORA_EXTRA,
  valorLinhaHoraExtra,
  type LinhaHoraExtra,
  type ResultadoHorasExtras,
} from '@/domain/horasExtras'
import type { Modalidade } from '@/domain/inss'

export type ModoHorasExtras = 'valor' | 'horas'

export interface LinhaHoraExtraFormulario {
  /** "hh:mm" */
  horas: string
  /** Adicional em %, ex.: "50". */
  adicional: string
}

export interface FormularioFolha {
  referencia: string
  modalidade: Modalidade
  salario: string
  dias: string
  horasExtrasModo: ModoHorasExtras
  horasExtras: string
  horasExtrasLinhas: LinhaHoraExtraFormulario[]
  baseValorHora: string
  divisor: string
  comissoes: string
  dsr: string
  dependentes: string
  baseInssManual: string
  inssInformado: string
  irrfInformado: string
}

export type ErrosFolha = Partial<Record<keyof FormularioFolha, string>>

export interface ErrosLinhaHoraExtra {
  horas?: string
  adicional?: string
}

export interface LeituraHorasExtras {
  /** Base efetiva do valor-hora (informada ou salario); null sem base valida. */
  base: number | null
  divisor: number | null
  /** Valor-hora em centavos fracionarios; null quando nao calculavel. */
  valorHora: number | null
  /** Valor de cada linha do formulario; null quando vazia, invalida ou sem base. */
  valores: (number | null)[]
  erros: ErrosLinhaHoraExtra[]
  resultado: ResultadoHorasExtras | null
}

export const DIVISOR_PADRAO = '220'

export function novaLinhaHoraExtra(adicional = '50'): LinhaHoraExtraFormulario {
  return { horas: '', adicional }
}

export function formularioFolhaPadrao(): FormularioFolha {
  return {
    referencia: '',
    modalidade: 'empregado',
    salario: '',
    dias: '30',
    horasExtrasModo: 'valor',
    horasExtras: '',
    horasExtrasLinhas: [novaLinhaHoraExtra()],
    baseValorHora: '',
    divisor: DIVISOR_PADRAO,
    comissoes: '',
    dsr: '',
    dependentes: '0',
    baseInssManual: '',
    inssInformado: '',
    irrfInformado: '',
  }
}

/** Estado mantido entre trocas de pagina, para nao perder o que foi digitado. */
export const formularioFolha = reactive<FormularioFolha>(formularioFolhaPadrao())

/** Copia independente do formulario (as linhas de horas extras sao uma lista). */
export function copiarFormularioFolha(formulario: object): Partial<FormularioFolha> {
  return JSON.parse(JSON.stringify(formulario))
}

function valorOpcional(texto: string, erros: ErrosFolha, campo: keyof FormularioFolha, mensagem: string) {
  const valor = paraCentavos(texto)

  if (valor !== null && Number.isNaN(valor)) {
    erros[campo] = mensagem
  }

  return valor === null || Number.isNaN(valor) ? null : valor
}

/** Provento adicional opcional: vazio vale zero; negativo e invalido. */
function valorAdicional(texto: string, erros: ErrosFolha, campo: keyof FormularioFolha) {
  const valor = valorOpcional(texto, erros, campo, 'Informe um valor válido.')

  if (valor !== null && valor < 0) {
    erros[campo] = 'Informe um valor positivo.'
    return 0
  }

  return valor ?? 0
}

/** Horas extras lancadas em horas. Linhas sem horas sao ignoradas. */
function interpretarHorasExtras(
  formulario: FormularioFolha,
  salario: number | null,
  erros: ErrosFolha,
): LeituraHorasExtras {
  const baseInformada = valorOpcional(formulario.baseValorHora, erros, 'baseValorHora', 'Informe uma base válida.')

  if (baseInformada === 0) {
    erros.baseValorHora = 'Informe uma base maior que zero.'
  }

  const divisor = paraInteiro(formulario.divisor, 1, LIMITE_DIVISOR)

  if (divisor === null || Number.isNaN(divisor)) {
    erros.divisor = `Informe de 1 a ${LIMITE_DIVISOR}.`
  }

  const salarioValido = salario !== null && !Number.isNaN(salario) && salario > 0 ? salario : null
  const base = erros.baseValorHora ? null : (baseInformada ?? salarioValido)
  const divisorValido = erros.divisor ? null : divisor

  const errosLinhas: ErrosLinhaHoraExtra[] = []
  const linhas: (LinhaHoraExtra | null)[] = []

  for (const linha of formulario.horasExtrasLinhas) {
    const errosLinha: ErrosLinhaHoraExtra = {}
    const minutos = lerHoras(linha.horas)
    const adicional = paraCentavos(linha.adicional)

    errosLinhas.push(errosLinha)

    if (minutos === null) {
      linhas.push(null)
      continue
    }

    if (Number.isNaN(minutos) || minutos > LIMITE_MINUTOS_HORA_EXTRA) {
      errosLinha.horas = 'Use hh:mm, até 300:00.'
    }

    if (adicional === null || Number.isNaN(adicional) || adicional > LIMITE_ADICIONAL_HORA_EXTRA) {
      errosLinha.adicional = 'Adicional de 0 a 200%.'
    }

    linhas.push(errosLinha.horas || errosLinha.adicional ? null : { minutos, adicional: adicional as number })
  }

  if (base === null || divisorValido === null) {
    return { base, divisor: divisorValido, valorHora: null, valores: linhas.map(() => null), erros: errosLinhas, resultado: null }
  }

  return {
    base,
    divisor: divisorValido,
    valorHora: base / divisorValido,
    valores: linhas.map((linha) => (linha ? valorLinhaHoraExtra(base, divisorValido, linha) : null)),
    erros: errosLinhas,
    resultado: calcularHorasExtras({
      base,
      divisor: divisorValido,
      linhas: linhas.filter((linha): linha is LinhaHoraExtra => linha !== null),
    }),
  }
}

export function interpretarFolha(formulario: FormularioFolha) {
  const erros: ErrosFolha = {}
  const salario = paraCentavos(formulario.salario)
  const dias = paraInteiro(formulario.dias, 0, 30)
  const dependentes = paraInteiro(formulario.dependentes, 0, 99)

  if (salario !== null && (Number.isNaN(salario) || salario <= 0)) {
    erros.salario = 'Informe um salário bruto maior que zero.'
  }

  if (dias === null || Number.isNaN(dias)) {
    erros.dias = 'Informe de 0 a 30 dias.'
  }

  if (dependentes === null || Number.isNaN(dependentes)) {
    erros.dependentes = 'Informe de 0 a 99 dependentes.'
  }

  // Horas extras, comissoes e DSR nao se aplicam ao pro-labore (os campos ficam ocultos).
  const empregado = formulario.modalidade === 'empregado'
  const emHoras = empregado && formulario.horasExtrasModo === 'horas'
  const leituraHoras = emHoras ? interpretarHorasExtras(formulario, salario, erros) : null
  const horasExtras = !empregado
    ? 0
    : leituraHoras
      ? (leituraHoras.resultado?.total ?? 0)
      : valorAdicional(formulario.horasExtras, erros, 'horasExtras')
  const comissoes = empregado ? valorAdicional(formulario.comissoes, erros, 'comissoes') : 0
  const dsr = empregado ? valorAdicional(formulario.dsr, erros, 'dsr') : 0

  const baseInssManual = valorOpcional(formulario.baseInssManual, erros, 'baseInssManual', 'Informe uma base válida.')
  const inssInformado = valorOpcional(formulario.inssInformado, erros, 'inssInformado', 'Informe um valor válido.')
  const irrfInformado = valorOpcional(formulario.irrfInformado, erros, 'irrfInformado', 'Informe um valor válido.')

  const errosNasLinhas = Boolean(leituraHoras?.erros.some((linha) => linha.horas || linha.adicional))
  const vazio = salario === null
  const valido = !vazio && Object.keys(erros).length === 0 && !errosNasLinhas

  const entrada: EntradaFolha | null = valido
    ? {
        modalidade: formulario.modalidade,
        salario: salario as number,
        dias: dias as number,
        horasExtras,
        comissoes,
        dsr,
        dependentes: dependentes as number,
        baseInssManual,
        inssInformado,
        irrfInformado,
      }
    : null

  return { entrada, erros, vazio, horasExtras: leituraHoras }
}
