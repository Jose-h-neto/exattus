import { reactive } from 'vue'

import { paraCentavos, paraInteiro } from '@/domain/dinheiro'
import type { EntradaFolha } from '@/domain/folha'
import { calcularHoraAula, LIMITE_AULAS, type ResultadoHoraAula, type TabelaHoraAula } from '@/domain/horaAula'
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

/** mensal: salario x dias / 30; hora_aula: aulas do mes x valor da tabela da instituicao. */
export type Remuneracao = 'mensal' | 'hora_aula'

/** total: um valor so; separadas: varias comissoes lancadas uma a uma e somadas. */
export type ModoComissoes = 'total' | 'separadas'

export interface LinhaComissaoFormulario {
  /** Opcional: ex.: "Vendas loja", "Meta". */
  descricao: string
  valor: string
}

export function novaLinhaComissao(): LinhaComissaoFormulario {
  return { descricao: '', valor: '' }
}

export interface LinhaHoraExtraFormulario {
  /** "hh:mm" */
  horas: string
  /** Adicional em %, ex.: "50". */
  adicional: string
}

export interface FormularioFolha {
  referencia: string
  modalidade: Modalidade
  remuneracao: Remuneracao
  /** Empresa do cofre cuja tabela de hora-aula e usada. */
  instituicaoId: string
  /** Professor cadastrado na instituicao cujas aulas padrao preencheram o formulario ('' = manual). */
  professorId: string
  /** Quantidade de aulas no mes por tipo de aula (id do tipo -> "80"). */
  aulas: Record<string, string>
  salario: string
  dias: string
  horasExtrasModo: ModoHorasExtras
  horasExtras: string
  horasExtrasLinhas: LinhaHoraExtraFormulario[]
  baseValorHora: string
  divisor: string
  comissoesModo: ModoComissoes
  comissoes: string
  comissoesLinhas: LinhaComissaoFormulario[]
  dsr: string
  dependentes: string
  adiantamentoSalarial: string
  adiantamentoFerias: string
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
    remuneracao: 'mensal',
    instituicaoId: '',
    professorId: '',
    aulas: {},
    salario: '',
    dias: '30',
    horasExtrasModo: 'valor',
    horasExtras: '',
    horasExtrasLinhas: [novaLinhaHoraExtra()],
    baseValorHora: '',
    divisor: DIVISOR_PADRAO,
    comissoesModo: 'total',
    comissoes: '',
    comissoesLinhas: [novaLinhaComissao(), novaLinhaComissao()],
    dsr: '',
    dependentes: '0',
    adiantamentoSalarial: '',
    adiantamentoFerias: '',
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

export interface LeituraComissoes {
  /** Comissoes com valor, na ordem lancada (descricao padrao "Comissao N"). */
  linhas: { descricao: string; valor: number }[]
  /** Erro de cada linha do formulario (mesma posicao), quando houver. */
  erros: (string | undefined)[]
  total: number
}

/** Comissoes separadas: linhas sem valor sao ignoradas; o total e a soma. */
function interpretarComissoes(formulario: FormularioFolha): LeituraComissoes {
  const linhas: LeituraComissoes['linhas'] = []
  const erros: LeituraComissoes['erros'] = []

  formulario.comissoesLinhas.forEach((linha, indice) => {
    const valor = paraCentavos(linha.valor)

    if (valor === null) {
      erros.push(undefined)
    } else if (Number.isNaN(valor) || valor < 0) {
      erros.push('Informe um valor válido.')
    } else {
      erros.push(undefined)
      if (valor > 0) linhas.push({ descricao: linha.descricao.trim() || `Comissão ${indice + 1}`, valor })
    }
  })

  return { linhas, erros, total: linhas.reduce((soma, linha) => soma + linha.valor, 0) }
}

export interface LeituraHoraAula {
  /** Erros por tipo de aula (id do tipo -> mensagem). */
  erros: Record<string, string>
  resultado: ResultadoHoraAula | null
}

/** Aulas do mes: vazio vale zero; aceita fracao ("80,5"). */
function interpretarHoraAula(formulario: FormularioFolha, tabela: TabelaHoraAula | null, erros: ErrosFolha): LeituraHoraAula {
  if (!tabela) {
    erros.instituicaoId = formulario.instituicaoId
      ? 'A instituição escolhida não tem tabela de hora-aula.'
      : 'Escolha a instituição da tabela de hora-aula.'

    return { erros: {}, resultado: null }
  }

  const errosAulas: Record<string, string> = {}
  const quantidades: Record<string, number> = {}

  for (const tipo of tabela.tipos) {
    const quantidade = paraCentavos(formulario.aulas[tipo.id] ?? '')

    if (quantidade === null) continue

    if (Number.isNaN(quantidade) || quantidade > LIMITE_AULAS) {
      errosAulas[tipo.id] = 'Informe a quantidade de aulas.'
    } else {
      quantidades[tipo.id] = quantidade
    }
  }

  return { erros: errosAulas, resultado: calcularHoraAula(tabela, quantidades) }
}

/**
 * tabelaHoraAula: tabela da instituicao escolhida, usada quando a remuneracao
 * e por hora-aula (o formulario guarda so o id da instituicao e as quantidades).
 */
export function interpretarFolha(formulario: FormularioFolha, tabelaHoraAula: TabelaHoraAula | null = null) {
  const erros: ErrosFolha = {}
  const empregado = formulario.modalidade === 'empregado'
  // Professor por hora-aula: sem salario mensal; o mes e sempre completo.
  const porHoraAula = empregado && formulario.remuneracao === 'hora_aula'
  const salario = porHoraAula ? 0 : paraCentavos(formulario.salario)
  const dias = porHoraAula ? 30 : paraInteiro(formulario.dias, 0, 30)
  const dependentes = paraInteiro(formulario.dependentes, 0, 99)

  if (salario !== null && (Number.isNaN(salario) || (!porHoraAula && salario <= 0))) {
    erros.salario = 'Informe um salário bruto maior que zero.'
  }

  if (dias === null || Number.isNaN(dias)) {
    erros.dias = 'Informe de 0 a 30 dias.'
  }

  if (dependentes === null || Number.isNaN(dependentes)) {
    erros.dependentes = 'Informe de 0 a 99 dependentes.'
  }

  const leituraHoraAula = porHoraAula ? interpretarHoraAula(formulario, tabelaHoraAula, erros) : null

  // Horas extras, comissoes e DSR nao se aplicam ao pro-labore (os campos ficam ocultos).
  const emHoras = empregado && formulario.horasExtrasModo === 'horas'
  const leituraHoras = emHoras ? interpretarHorasExtras(formulario, porHoraAula ? null : salario, erros) : null

  // Na hora-aula nao ha salario para servir de base do valor-hora: a base precisa ser informada.
  if (porHoraAula && leituraHoras && leituraHoras.base === null && !erros.baseValorHora && formulario.horasExtrasLinhas.some((linha) => linha.horas)) {
    erros.baseValorHora = 'Informe a base do valor-hora.'
  }
  const horasExtras = !empregado
    ? 0
    : leituraHoras
      ? (leituraHoras.resultado?.total ?? 0)
      : valorAdicional(formulario.horasExtras, erros, 'horasExtras')
  const leituraComissoes = empregado && formulario.comissoesModo === 'separadas' ? interpretarComissoes(formulario) : null
  const comissoes = !empregado ? 0 : leituraComissoes ? leituraComissoes.total : valorAdicional(formulario.comissoes, erros, 'comissoes')
  const dsr = empregado ? valorAdicional(formulario.dsr, erros, 'dsr') : 0

  // Adiantamentos: descontados depois dos tributos. Pro-labore nao tem ferias.
  const adiantamentoSalarial = valorAdicional(formulario.adiantamentoSalarial, erros, 'adiantamentoSalarial')
  const adiantamentoFerias = empregado ? valorAdicional(formulario.adiantamentoFerias, erros, 'adiantamentoFerias') : 0

  const baseInssManual = valorOpcional(formulario.baseInssManual, erros, 'baseInssManual', 'Informe uma base válida.')
  const inssInformado = valorOpcional(formulario.inssInformado, erros, 'inssInformado', 'Informe um valor válido.')
  const irrfInformado = valorOpcional(formulario.irrfInformado, erros, 'irrfInformado', 'Informe um valor válido.')

  const errosNasLinhas = Boolean(leituraHoras?.erros.some((linha) => linha.horas || linha.adicional))
  const errosNasAulas = Object.keys(leituraHoraAula?.erros ?? {}).length > 0
  const errosNasComissoes = Boolean(leituraComissoes?.erros.some(Boolean))
  // Sem salario (mensal) ou sem nenhuma aula lancada (hora-aula): nada a calcular ainda.
  const vazio = porHoraAula
    ? Boolean(leituraHoraAula?.resultado && leituraHoraAula.resultado.quantidade === 0 && !errosNasAulas)
    : salario === null
  const valido = !vazio && Object.keys(erros).length === 0 && !errosNasLinhas && !errosNasAulas && !errosNasComissoes

  const entrada: EntradaFolha | null = valido
    ? {
        modalidade: formulario.modalidade,
        salario: salario as number,
        dias: dias as number,
        horaAula: leituraHoraAula?.resultado ?? null,
        horasExtras,
        comissoes,
        dsr,
        dependentes: dependentes as number,
        adiantamentoSalarial,
        adiantamentoFerias,
        baseInssManual,
        inssInformado,
        irrfInformado,
      }
    : null

  return { entrada, erros, vazio, horasExtras: leituraHoras, horaAula: leituraHoraAula, comissoes: leituraComissoes }
}
