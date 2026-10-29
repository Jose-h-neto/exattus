import { reactive } from 'vue'

import { lerData, paraInputData, somarDias } from '@/domain/datas'
import { paraCentavos, paraInteiro } from '@/domain/dinheiro'
import type { EntradaRescisao, TratamentoAviso } from '@/domain/rescisao/calculo'
import {
  obterModalidade,
  regraEfetiva,
  type CodigoModalidade,
  type TipoContrato,
} from '@/domain/rescisao/modalidades'
import { periodosAquisitivos } from '@/domain/rescisao/tempo'

export interface PeriodoFormulario {
  gozado: boolean
  faltas: string
}

export type ModoMedias = 'unica' | 'por_verba'

export const CAMPOS_MEDIAS = ['mediasFerias', 'mediasDecimo', 'mediasAviso'] as const

export interface FormularioRescisao {
  referencia: string
  salario: string
  adicionais: string
  /** Unica: a mesma media entra nas tres verbas. Por verba: uma media para cada. */
  mediasModo: ModoMedias
  mediaUnica: string
  mediasFerias: string
  mediasDecimo: string
  mediasAviso: string
  dependentes: string

  tipoContrato: TipoContrato
  admissao: string
  fimContrato: string
  clausulaAssecuratoria: boolean
  desligamento: string
  pagamento: string
  pagamentoAutomatico: boolean

  variaveisMes: string
  faltasMes: string

  periodos: PeriodoFormulario[]
  faltasPeriodoAtual: string

  adiantamentoDecimo: string
  saldoFgts: string
  folhaRendimentos: string
  folhaInss: string
  folhaIrrf: string
  competenciaRemuneracao: string
  competenciaInss: string

  modalidade: CodigoModalidade
  aviso: TratamentoAviso
  diasAvisoNaoCumpridos: string
  indenizacao480: string
  multa477: boolean
  indenizacao7238: boolean
  outrosDescontos: string

  /** Valores processados pela folha, por item conferivel. */
  folha: Record<string, string>
}

export function formularioRescisaoPadrao(): FormularioRescisao {
  return {
    referencia: '',
    salario: '',
    adicionais: '',
    mediasModo: 'unica',
    mediaUnica: '',
    mediasFerias: '',
    mediasDecimo: '',
    mediasAviso: '',
    dependentes: '0',
    tipoContrato: 'indeterminado',
    admissao: '',
    fimContrato: '',
    clausulaAssecuratoria: false,
    desligamento: '',
    pagamento: '',
    pagamentoAutomatico: true,
    variaveisMes: '',
    faltasMes: '0',
    periodos: [],
    faltasPeriodoAtual: '0',
    adiantamentoDecimo: '',
    saldoFgts: '',
    folhaRendimentos: '',
    folhaInss: '',
    folhaIrrf: '',
    competenciaRemuneracao: '',
    competenciaInss: '',
    modalidade: 'sem_justa_causa',
    aviso: 'indenizado',
    diasAvisoNaoCumpridos: '30',
    indenizacao480: '',
    multa477: false,
    indenizacao7238: false,
    outrosDescontos: '',
    folha: {},
  }
}

export const formularioRescisao = reactive<FormularioRescisao>(formularioRescisaoPadrao())

/**
 * Copia independente de um formulario salvo, convertendo formatos anteriores:
 * - media unica antiga (`medias`): vira o modo Unica com o mesmo valor;
 * - tres medias sem modo: Unica se forem iguais, Por verba se diferirem.
 */
export function restaurarFormularioRescisao(salvo: object): Partial<FormularioRescisao> {
  const copia: Partial<FormularioRescisao> & { medias?: string } = JSON.parse(JSON.stringify(salvo))

  if (copia.medias !== undefined) {
    copia.mediasModo ??= 'unica'
    copia.mediaUnica ??= copia.medias
    delete copia.medias
  } else if (copia.mediasModo === undefined && CAMPOS_MEDIAS.some((campo) => copia[campo] !== undefined)) {
    const valores = CAMPOS_MEDIAS.map((campo) => copia[campo] ?? '')

    copia.mediasModo = new Set(valores).size === 1 ? 'unica' : 'por_verba'
    copia.mediaUnica = copia.mediasModo === 'unica' ? valores[0] : ''
  }

  return copia
}

/**
 * Troca a forma de informar as medias sem perder o que foi digitado:
 * - Unica -> Por verba: as medias vazias recebem a media unica (so se ajusta a que difere);
 * - Por verba -> Unica: tres valores iguais viram a media unica; diferentes ficam guardados.
 */
export function definirModoMedias(formulario: FormularioRescisao, modo: ModoMedias) {
  if (modo === formulario.mediasModo) return

  if (modo === 'por_verba') {
    for (const campo of CAMPOS_MEDIAS) {
      if (!formulario[campo].trim()) formulario[campo] = formulario.mediaUnica
    }
  } else {
    const valores = new Set(CAMPOS_MEDIAS.map((campo) => formulario[campo].trim()))

    if (valores.size === 1) formulario.mediaUnica = [...valores][0] ?? ''
  }

  formulario.mediasModo = modo
}

/* Regras de interface ------------------------------------------------- */

export interface OpcaoAviso {
  valor: TratamentoAviso
  rotulo: string
}

/** Tratamentos de aviso possiveis para a modalidade e o contrato. */
export function opcoesAviso(formulario: FormularioRescisao): OpcaoAviso[] {
  const modalidade = regraEfetiva(
    obterModalidade(formulario.modalidade),
    formulario.tipoContrato !== 'indeterminado' && formulario.clausulaAssecuratoria,
  )

  switch (modalidade.aviso) {
    case 'empregador':
    case 'metade':
      return [
        { valor: 'indenizado', rotulo: 'Indenizado' },
        { valor: 'trabalhado', rotulo: 'Trabalhado' },
      ]
    case 'empregado':
      return [
        { valor: 'trabalhado', rotulo: 'Trabalhado' },
        { valor: 'dispensado', rotulo: 'Dispensado' },
        { valor: 'nao_cumprido', rotulo: 'Não cumprido' },
      ]
    case 'indenizado':
    case 'culpa':
      return [{ valor: 'indenizado', rotulo: 'Indenizado' }]
    default:
      return []
  }
}

/** Ao trocar o tipo de contrato, escolhe uma modalidade compativel. */
export function ajustarModalidade(formulario: FormularioRescisao) {
  if (!obterModalidade(formulario.modalidade).contratos.includes(formulario.tipoContrato)) {
    formulario.modalidade = formulario.tipoContrato === 'indeterminado' ? 'sem_justa_causa' : 'termino_contrato'
  }

  ajustarAviso(formulario)
}

/** Mantem o tratamento do aviso coerente com a modalidade escolhida. */
export function ajustarAviso(formulario: FormularioRescisao) {
  const opcoes = opcoesAviso(formulario)

  if (opcoes.length && !opcoes.some((opcao) => opcao.valor === formulario.aviso)) {
    formulario.aviso = opcoes[0]!.valor
  }
}

/** Sugere o pagamento no prazo legal: 10 dias apos o termino (art. 477, par. 6o). */
export function sugerirPagamento(formulario: FormularioRescisao) {
  const desligamento = lerData(formulario.desligamento)

  if (desligamento && (formulario.pagamentoAutomatico || !formulario.pagamento)) {
    formulario.pagamento = paraInputData(somarDias(desligamento, 10))
  }
}

/**
 * Ajusta a lista de periodos aquisitivos completos as datas informadas.
 * Padrao: periodos com concessivo encerrado foram gozados; o ultimo, ainda no
 * concessivo, nao foi.
 */
export function sincronizarPeriodos(formulario: FormularioRescisao) {
  const admissao = lerData(formulario.admissao)
  const desligamento = lerData(formulario.desligamento)

  if (!admissao || !desligamento || desligamento < admissao) {
    formulario.periodos = []
    return
  }

  const completos = periodosAquisitivos(admissao, desligamento).filter((periodo) => periodo.completo)

  formulario.periodos = completos.map(
    (periodo, indice) =>
      formulario.periodos[indice] ?? { gozado: periodo.fimConcessivo < desligamento, faltas: '0' },
  )
}

/* Leitura e validacao -------------------------------------------------- */

export type CampoRescisao = Exclude<keyof FormularioRescisao, 'periodos' | 'folha'>

export type ErrosRescisao = Partial<Record<CampoRescisao | `periodo-${number}`, string>>

const ETAPA_DOS_CAMPOS: Record<string, 1 | 2> = {
  modalidade: 2,
  aviso: 2,
  diasAvisoNaoCumpridos: 2,
  indenizacao480: 2,
  outrosDescontos: 2,
  saldoFgts: 2,
}

export function etapaDoCampo(campo: string): 1 | 2 {
  return ETAPA_DOS_CAMPOS[campo] ?? 1
}

export function interpretarRescisao(formulario: FormularioRescisao) {
  const erros: ErrosRescisao = {}
  const pendentes: string[] = []

  const dinheiro = (campo: CampoRescisao, opcional = true) => {
    const valor = paraCentavos(String(formulario[campo] ?? ''))

    if (valor === null) {
      if (!opcional) pendentes.push(campo)
      return 0
    }

    if (Number.isNaN(valor)) {
      erros[campo] = 'Informe um valor válido.'
      return 0
    }

    return valor
  }

  const inteiro = (campo: CampoRescisao, minimo: number, maximo: number, mensagem: string) => {
    const valor = paraInteiro(String(formulario[campo] ?? ''), minimo, maximo)

    if (valor === null || Number.isNaN(valor)) {
      erros[campo] = mensagem
      return 0
    }

    return valor
  }

  const data = (campo: CampoRescisao, obrigatoria: boolean) => {
    const texto = String(formulario[campo] ?? '')

    if (!texto) {
      if (obrigatoria) pendentes.push(campo)
      return null
    }

    const valor = lerData(texto)

    if (!valor) erros[campo] = 'Informe uma data válida.'

    return valor
  }

  const salario = dinheiro('salario', false)

  if (formulario.salario && !erros.salario && salario <= 0) {
    erros.salario = 'Informe um salário maior que zero.'
  }

  const admissao = data('admissao', true)
  const desligamento = data('desligamento', true)
  const pagamento = data('pagamento', true)
  const contratoAPrazo = formulario.tipoContrato !== 'indeterminado'
  const fimContrato = data('fimContrato', contratoAPrazo)

  if (admissao && desligamento && desligamento < admissao) {
    erros.desligamento = 'O desligamento deve ser posterior à admissão.'
  }

  if (desligamento && pagamento && pagamento < desligamento) {
    erros.pagamento = 'O pagamento não pode ser anterior ao desligamento.'
  }

  if (contratoAPrazo && admissao && fimContrato && fimContrato < admissao) {
    erros.fimContrato = 'O término previsto deve ser posterior à admissão.'
  }

  const modalidade = obterModalidade(formulario.modalidade)

  if (!modalidade.contratos.includes(formulario.tipoContrato)) {
    erros.modalidade = 'Modalidade incompatível com o tipo de contrato. Escolha outra.'
  }

  const periodos = formulario.periodos.map((periodo, indice) => {
    const faltas = paraInteiro(periodo.faltas, 0, 366)

    if (faltas === null || Number.isNaN(faltas)) {
      erros[`periodo-${indice}`] = 'Faltas inválidas.'
    }

    return { gozado: periodo.gozado, faltas: Number.isInteger(faltas) ? (faltas as number) : 0 }
  })

  // Modo Unica: a mesma media nas tres verbas. So o modo escolhido e lido (e validado).
  const mediaUnica = formulario.mediasModo === 'unica' ? dinheiro('mediaUnica') : 0
  const media = (campo: (typeof CAMPOS_MEDIAS)[number]) =>
    formulario.mediasModo === 'unica' ? mediaUnica : dinheiro(campo)

  const indenizacao480Texto = formulario.indenizacao480.trim()
  const indenizacao480 = indenizacao480Texto ? dinheiro('indenizacao480') : null

  const entrada: Omit<EntradaRescisao, 'admissao' | 'desligamento' | 'pagamento'> = {
    salario,
    adicionais: dinheiro('adicionais'),
    mediasFerias: media('mediasFerias'),
    mediasDecimo: media('mediasDecimo'),
    mediasAviso: media('mediasAviso'),
    variaveisMes: dinheiro('variaveisMes'),
    faltasMes: inteiro('faltasMes', 0, 30, 'Informe de 0 a 30 dias.'),
    tipoContrato: formulario.tipoContrato,
    fimContrato: contratoAPrazo ? fimContrato : null,
    clausulaAssecuratoria: contratoAPrazo && formulario.clausulaAssecuratoria,
    modalidade: formulario.modalidade,
    aviso: formulario.aviso,
    diasAvisoNaoCumpridos:
      formulario.aviso === 'nao_cumprido'
        ? inteiro('diasAvisoNaoCumpridos', 1, 30, 'Informe de 1 a 30 dias.')
        : 30,
    dependentes: inteiro('dependentes', 0, 99, 'Informe de 0 a 99 dependentes.'),
    periodos,
    faltasPeriodoAtual: inteiro('faltasPeriodoAtual', 0, 366, 'Informe as faltas do período.'),
    adiantamentoDecimo: dinheiro('adiantamentoDecimo'),
    saldoFgts: dinheiro('saldoFgts'),
    outrosDescontos: dinheiro('outrosDescontos'),
    multa477: formulario.multa477,
    indenizacao7238: formulario.indenizacao7238,
    indenizacao480,
    folhaAnterior: {
      rendimentos: dinheiro('folhaRendimentos'),
      inss: dinheiro('folhaInss'),
      irrf: dinheiro('folhaIrrf'),
    },
    competenciaAnterior: {
      remuneracao: dinheiro('competenciaRemuneracao'),
      inss: dinheiro('competenciaInss'),
    },
  }

  const valido = pendentes.length === 0 && Object.keys(erros).length === 0

  return {
    entrada: valido && admissao && desligamento && pagamento ? { ...entrada, admissao, desligamento, pagamento } : null,
    erros,
    pendentes,
  }
}

export const ROTULOS_PENDENTES: Record<string, string> = {
  salario: 'salário base',
  admissao: 'data de admissão',
  desligamento: 'data de desligamento',
  pagamento: 'data do pagamento',
  fimContrato: 'término previsto do contrato',
}

/** Valores informados da folha, em centavos. */
export function lerValoresFolha(formulario: FormularioRescisao) {
  const valores: Record<string, number | null> = {}
  const invalidos: string[] = []

  for (const [chave, texto] of Object.entries(formulario.folha)) {
    const valor = paraCentavos(texto)

    if (valor !== null && Number.isNaN(valor)) {
      invalidos.push(chave)
      valores[chave] = null
    } else {
      valores[chave] = valor
    }
  }

  return { valores, invalidos }
}
