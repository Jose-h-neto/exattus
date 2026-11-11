/*
 * Calcula cada funcionario da planilha com o motor do sistema. Cada linha vira
 * o mesmo formulario das telas de Folha, Ferias e 13o, passa pelas mesmas validacoes
 * (interpretarFolha / interpretarFerias / interpretarDecimo) e e conferida com os valores da folha.
 */

import { formatarData } from '@/domain/datas'
import { paraCentavos } from '@/domain/dinheiro'
import { calcularDecimo, ROTULO_PARCELA, type ParcelaDecimo } from '@/domain/decimo'
import { calcularFerias } from '@/domain/ferias'
import { calcularFolha } from '@/domain/folha'
import { formatarAulas, type ProfessorHoraAula, type TabelaHoraAula } from '@/domain/horaAula'
import {
  conferirValor,
  situacaoDosItens,
  type ChaveItemLote,
  type ItemConferenciaLote,
} from '@/domain/lote/conferencia'
import type { LinhaLote } from '@/domain/lote/tipos'
import type { TabelaInss, TabelaIrrf } from '@/domain/parametros'
import { formularioDecimoPadrao, interpretarDecimo, type FormularioDecimo } from '@/features/decimo'
import { formularioFeriasPadrao, interpretarFerias, sugerirPagamento, type FormularioFerias } from '@/features/ferias'
import { copiarFormularioFolha, formularioFolhaPadrao, interpretarFolha, type FormularioFolha } from '@/features/folha'

import { COLUNAS, COLUNAS_HORA_AULA_FIXAS, normalizarCabecalho, PREFIXO_AULA } from './colunas'
import type { RegistroPlanilha } from './leitura'

export interface Tabelas {
  inss: TabelaInss
  irrf: TabelaIrrf
}

/** Instituicao (pasta de destino) cuja tabela calcula as linhas da aba Hora-aula. */
export interface InstituicaoLote {
  empresaId: string
  tabela: TabelaHoraAula | null
  /** Professores cadastrados: ligam a linha ao professor (para comparar com as aulas padrao). */
  professores?: ProfessorHoraAula[]
}

function mesmoNome(a: string, b: string): boolean {
  return a.trim().localeCompare(b.trim(), 'pt-BR', { sensitivity: 'base' }) === 0
}

type Informados = Record<ChaveItemLote, number | null>

const ROTULOS_FOLHA: Partial<Record<keyof FormularioFolha, string>> = {
  salario: 'Salário base',
  dias: 'Dias trabalhados',
  horasExtras: 'Horas extras (R$)',
  baseValorHora: 'Base valor-hora (R$)',
  divisor: 'Divisor',
  comissoes: 'Comissões (R$)',
  dsr: 'DSR (R$)',
  dependentes: 'Dependentes IRRF',
  adiantamentoSalarial: 'Adiantamento salarial (R$)',
  adiantamentoFerias: 'Adiantamento de férias (R$)',
  baseInssManual: 'Base INSS manual (R$)',
  inssInformado: 'INSS',
  irrfInformado: 'IRRF',
}

const ROTULOS_FERIAS: Partial<Record<keyof FormularioFerias, string>> = {
  salario: 'Salário base',
  medias: 'Médias (R$)',
  diasFerias: 'Dias de férias',
  diasAbono: 'Dias de abono',
  dependentes: 'Dependentes IRRF',
  dataInicio: 'Início do gozo',
  dataPagamento: 'Data de pagamento',
  inssManual: 'INSS manual (R$)',
}

const ROTULOS_DECIMO: Partial<Record<keyof FormularioDecimo, string>> = {
  salario: 'Salário base',
  medias: 'Médias (R$)',
  avos: 'Avos',
  dependentes: 'Dependentes IRRF',
  primeiraParcelaPaga: '1ª parcela paga (R$)',
}

function rotuloInformado(registro: RegistroPlanilha, campo: string): string {
  const colunas = registro.tipo === 'hora_aula' ? COLUNAS_HORA_AULA_FIXAS : COLUNAS[registro.tipo]

  return colunas.find((coluna) => coluna.campo === campo)?.cabecalho ?? campo
}

/** Valor da folha do cliente: aceita negativo (ex.: liquido negativo). */
function lerInformado(texto: string): number | null {
  const limpo = texto.trim()
  const negativo = limpo.startsWith('-')
  const valor = paraCentavos(negativo ? limpo.slice(1) : limpo)

  if (valor === null || Number.isNaN(valor)) return valor

  return negativo ? -valor : valor
}

function lerInformados(registro: RegistroPlanilha, erros: string[]): Informados {
  const campos: Record<ChaveItemLote, string> = {
    proventos: 'proventosInformado',
    descontos: 'descontosInformado',
    inss: 'inssInformado',
    irrf: 'irrfInformado',
    liquido: 'liquidoInformado',
    fgts: 'fgtsInformado',
  }

  const informados = {} as Informados

  for (const [chave, campo] of Object.entries(campos) as [ChaveItemLote, string][]) {
    const valor = lerInformado(registro.valores[campo] ?? '')

    if (valor !== null && Number.isNaN(valor)) {
      erros.push(`${rotuloInformado(registro, campo)}: informe um valor válido.`)
      informados[chave] = null
    } else {
      informados[chave] = valor
    }
  }

  return informados
}

/** fgts ausente (pro-labore): o item nao entra na conferencia. */
function itensConferidos(
  calculados: Omit<Record<ChaveItemLote, number>, 'fgts'> & { fgts: number | null },
  informados: Informados,
  tolerancia: number,
  rotuloBruto: string,
): ItemConferenciaLote[] {
  const descricoes: Record<ChaveItemLote, string> = {
    proventos: rotuloBruto,
    descontos: 'Total descontos',
    inss: 'INSS',
    irrf: 'IRRF',
    liquido: 'Líquido',
    fgts: 'FGTS (empregador)',
  }

  return (Object.keys(descricoes) as ChaveItemLote[]).flatMap((chave) => {
    const calculado = calculados[chave]

    return calculado === null ? [] : [{ chave, descricao: descricoes[chave], ...conferirValor(calculado, informados[chave], tolerancia) }]
  })
}

function errosDoFormulario<T extends string>(erros: Partial<Record<T, string>>, rotulos: Partial<Record<T, string>>): string[] {
  return (Object.entries(erros) as [T, string][]).map(([campo, mensagem]) => `${rotulos[campo] ?? campo}: ${mensagem}`)
}

function identificacao(registro: RegistroPlanilha, erros: string[]) {
  const nome = (registro.valores.nome ?? '').trim()

  if (!nome) erros.push('Nome: informe o nome do funcionário.')

  return {
    nome: nome || `Linha ${registro.linha}`,
    matricula: (registro.valores.matricula ?? '').trim(),
    cpf: (registro.valores.cpf ?? '').trim(),
  }
}

function montarLinha(
  registro: RegistroPlanilha,
  dados: ReturnType<typeof identificacao>,
  formulario: Record<string, unknown>,
  erros: string[],
  itens: ItemConferenciaLote[],
  detalhe: string,
): LinhaLote {
  return {
    id: `${registro.tipo}-${registro.linha}`,
    // Hora-aula e uma folha mensal: abre na tela de Folha.
    tipo: registro.tipo === 'hora_aula' ? 'folha' : registro.tipo,
    ...(registro.tipo === 'hora_aula' ? { horaAula: true } : {}),
    linha: registro.linha,
    ...dados,
    formulario,
    status: erros.length ? 'erro' : situacaoDosItens(itens),
    erros,
    itens,
    detalhe,
  }
}

function processarFolha(registro: RegistroPlanilha, tolerancia: number, tabelas: Tabelas): LinhaLote {
  const v = registro.valores
  const erros: string[] = []
  const dados = identificacao(registro, erros)
  const form = formularioFolhaPadrao()

  form.referencia = dados.nome

  if (v.modalidade === 'empregado' || v.modalidade === 'prolabore') form.modalidade = v.modalidade
  else erros.push('Modalidade: escolha Empregado ou Pró-labore.')

  form.salario = v.salario ?? ''
  form.dias = v.dias || '30'
  form.divisor = v.divisor || form.divisor
  form.baseValorHora = v.baseValorHora ?? ''

  // "150 + 230,50": comissoes separadas, somadas (uma linha por comissao no calculo).
  const comissoes = (v.comissoes ?? '').split(/\s*[+;]\s*/).filter(Boolean)

  if (comissoes.length > 1) {
    form.comissoesModo = 'separadas'
    form.comissoesLinhas = comissoes.map((valor) => ({ descricao: '', valor }))
  } else {
    form.comissoes = v.comissoes ?? ''
  }

  form.dsr = v.dsr ?? ''
  form.dependentes = v.dependentes || '0'
  form.adiantamentoSalarial = v.adiantamentoSalarial ?? ''
  form.adiantamentoFerias = v.adiantamentoFerias ?? ''
  form.baseInssManual = v.baseInssManual ?? ''
  form.inssInformado = v.inssInformado ?? ''
  form.irrfInformado = v.irrfInformado ?? ''

  // Horas extras: em valor (R$) ou em horas (HE 50% / HE 100%), nunca os dois.
  const linhasHoras = [
    { horas: v.he50 ?? '', adicional: '50' },
    { horas: v.he100 ?? '', adicional: '100' },
  ].filter((linha) => linha.horas)

  if (linhasHoras.length) {
    if (v.horasExtras) erros.push('Horas extras: preencha o valor (R$) ou as horas (HE 50% / HE 100%), não os dois.')

    form.horasExtrasModo = 'horas'
    form.horasExtrasLinhas = linhasHoras
  } else {
    form.horasExtras = v.horasExtras ?? ''
  }

  const leitura = interpretarFolha(form)

  if (leitura.vazio) erros.push('Salário base: informe o salário.')

  erros.push(...errosDoFormulario(leitura.erros, ROTULOS_FOLHA))

  leitura.horasExtras?.erros.forEach((erro, indice) => {
    const rotulo = linhasHoras[indice]?.adicional === '100' ? 'HE 100%' : 'HE 50%'

    if (erro.horas) erros.push(`${rotulo}: ${erro.horas}`)
  })

  leitura.comissoes?.erros.forEach((erro, indice) => {
    if (erro) erros.push(`Comissões: o ${indice + 1}º valor (“${comissoes[indice]}”) é inválido.`)
  })

  const resultado = leitura.entrada ? calcularFolha(leitura.entrada, tabelas.inss, tabelas.irrf) : null
  const itens = conferirFolha(resultado, lerInformados(registro, erros), tolerancia)

  const detalhe = resultado
    ? [
        resultado.entrada.modalidade === 'prolabore' ? 'Pró-labore' : 'Empregado',
        `${resultado.entrada.dias} dias`,
        resultado.entrada.horasExtras > 0 ? 'horas extras' : '',
        resultado.entrada.comissoes > 0 ? 'comissões' : '',
        resultado.entrada.dsr > 0 ? 'DSR' : '',
        resultado.adiantamentos > 0 ? 'adiantamento' : '',
      ].filter(Boolean).join(' · ')
    : 'Folha mensal'

  return montarLinha(registro, dados, copiarFormularioFolha(form) as Record<string, unknown>, erros, itens, detalhe)
}

function conferirFolha(resultado: ReturnType<typeof calcularFolha> | null, informados: Informados, tolerancia: number) {
  return resultado
    ? itensConferidos(
        {
          proventos: resultado.totalProventos,
          descontos: resultado.totalDescontos,
          inss: resultado.inss.total,
          irrf: resultado.irrf.escolhida.irrf,
          liquido: resultado.liquido,
          fgts: resultado.fgts?.valor ?? null,
        },
        informados,
        tolerancia,
        'Total proventos',
      )
    : []
}

/** Professor por hora-aula: as colunas de aulas sao ligadas aos tipos da tabela pela descricao. */
function processarHoraAula(registro: RegistroPlanilha, tolerancia: number, tabelas: Tabelas, instituicao: InstituicaoLote | null): LinhaLote {
  const v = registro.valores
  const erros: string[] = []
  const dados = identificacao(registro, erros)
  const form = formularioFolhaPadrao()
  const tabela = instituicao?.tabela ?? null

  form.referencia = dados.nome
  form.remuneracao = 'hora_aula'
  form.instituicaoId = instituicao?.empresaId ?? ''
  form.professorId = instituicao?.professores?.find((professor) => mesmoNome(professor.nome, dados.nome))?.id ?? ''
  form.dependentes = v.dependentes || '0'
  form.horasExtras = v.horasExtras ?? ''
  form.adiantamentoSalarial = v.adiantamentoSalarial ?? ''
  form.adiantamentoFerias = v.adiantamentoFerias ?? ''
  form.baseInssManual = v.baseInssManual ?? ''
  form.inssInformado = v.inssInformado ?? ''
  form.irrfInformado = v.irrfInformado ?? ''

  if (!tabela) {
    erros.push('Hora-aula: a pasta escolhida não tem tabela de hora-aula. Cadastre na aba Hora-aula da pasta.')
  } else {
    const porDescricao = new Map(tabela.tipos.map((tipo) => [normalizarCabecalho(tipo.descricao), tipo]))

    for (const [campo, valor] of Object.entries(v)) {
      if (!campo.startsWith(PREFIXO_AULA) || !valor) continue

      const tipo = porDescricao.get(campo.slice(PREFIXO_AULA.length))

      if (tipo) form.aulas[tipo.id] = valor
      else erros.push(`Coluna “${campo.slice(PREFIXO_AULA.length)}”: não existe esse tipo de aula na tabela da instituição.`)
    }
  }

  const leitura = interpretarFolha(form, tabela)

  if (tabela && leitura.vazio) erros.push('Aulas: informe a quantidade de aulas de ao menos um tipo.')

  const { instituicaoId: _instituicao, ...outrosErros } = leitura.erros

  erros.push(...errosDoFormulario(outrosErros, ROTULOS_FOLHA))

  for (const [tipoId, mensagem] of Object.entries(leitura.horaAula?.erros ?? {})) {
    erros.push(`${tabela?.tipos.find((tipo) => tipo.id === tipoId)?.descricao ?? tipoId}: ${mensagem}`)
  }

  const resultado = leitura.entrada ? calcularFolha(leitura.entrada, tabelas.inss, tabelas.irrf) : null
  const itens = conferirFolha(resultado, lerInformados(registro, erros), tolerancia)
  const aulas = resultado?.entrada.horaAula

  const detalhe = aulas ? `Hora-aula · ${formatarAulas(aulas.quantidade)} aulas · ${aulas.linhas.length} ${aulas.linhas.length === 1 ? 'tipo' : 'tipos'}` : 'Hora-aula'

  return montarLinha(registro, dados, copiarFormularioFolha(form) as Record<string, unknown>, erros, itens, detalhe)
}

function processarFerias(registro: RegistroPlanilha, tolerancia: number, tabelas: Tabelas): LinhaLote {
  const v = registro.valores
  const erros: string[] = []
  const dados = identificacao(registro, erros)
  const form = formularioFeriasPadrao()

  form.referencia = dados.nome
  form.salario = v.salario ?? ''
  form.medias = v.medias ?? ''
  form.diasFerias = v.diasFerias || '30'
  form.dependentes = v.dependentes || '0'
  form.dataInicio = v.dataInicio ?? ''
  form.dataPagamento = v.dataPagamento ?? ''
  form.pagamentoAutomatico = !v.dataPagamento
  form.inssManual = v.inssManual ?? ''

  const abono = (v.diasAbono ?? '').trim()

  form.possuiAbono = abono !== '' && abono !== '0'
  form.diasAbono = form.possuiAbono ? abono : form.diasAbono

  if (form.pagamentoAutomatico) sugerirPagamento(form)

  const leitura = interpretarFerias(form)

  erros.push(...leitura.pendentes.map((pendente) => `${pendente}.`))
  erros.push(...errosDoFormulario(leitura.erros, ROTULOS_FERIAS))

  const informados = lerInformados(registro, erros)
  const resultado = leitura.entrada ? calcularFerias(leitura.entrada, tabelas.inss, tabelas.irrf) : null

  const itens = resultado
    ? itensConferidos(
        {
          proventos: resultado.totalBruto,
          descontos: resultado.totalDescontos,
          inss: resultado.inssUsado,
          irrf: resultado.irrf.escolhida.irrf,
          liquido: resultado.liquido,
          fgts: resultado.fgts.valor,
        },
        informados,
        tolerancia,
        'Total bruto',
      )
    : []

  const detalhe = resultado
    ? `${formatarData(resultado.entrada.inicio)} a ${formatarData(resultado.entrada.fim)} · ${resultado.entrada.diasFerias} dias` +
      (resultado.entrada.diasAbono ? ` + ${resultado.entrada.diasAbono} vendidos` : '')
    : 'Férias'

  return montarLinha(registro, dados, { ...form }, erros, itens, detalhe)
}

function processarDecimo(registro: RegistroPlanilha, tolerancia: number, tabelas: Tabelas): LinhaLote {
  const v = registro.valores
  const erros: string[] = []
  const dados = identificacao(registro, erros)
  const form = formularioDecimoPadrao()

  form.referencia = dados.nome

  const parcelaValida = v.parcela === 'primeira' || v.parcela === 'segunda'

  if (parcelaValida) form.parcela = v.parcela as ParcelaDecimo
  else erros.push(v.parcela ? 'Parcela: escolha 1ª parcela ou 2ª parcela.' : 'Parcela: informe 1ª parcela ou 2ª parcela.')

  form.salario = v.salario ?? ''
  form.medias = v.medias ?? ''
  form.avos = v.avos || '12'
  form.dependentes = v.dependentes || '0'
  form.primeiraParcelaPaga = v.primeiraParcelaPaga ?? ''

  if (parcelaValida && form.parcela === 'primeira' && form.primeiraParcelaPaga) {
    erros.push('1ª parcela paga (R$): só se aplica à 2ª parcela.')
  }

  const leitura = interpretarDecimo(form)

  if (leitura.vazio) erros.push('Salário base: informe o salário.')

  erros.push(...errosDoFormulario(leitura.erros, ROTULOS_DECIMO))

  const informados = lerInformados(registro, erros)
  const resultado = leitura.entrada && parcelaValida ? calcularDecimo(leitura.entrada, tabelas.inss, tabelas.irrf) : null

  const itens = resultado
    ? itensConferidos(
        {
          proventos: resultado.bruto,
          descontos: resultado.totalDescontos,
          inss: resultado.inss?.total ?? 0,
          irrf: resultado.irrf?.escolhida.irrf ?? 0,
          liquido: resultado.liquido,
          fgts: resultado.fgts.valor,
        },
        informados,
        tolerancia,
        'Total bruto',
      )
    : []

  const detalhe = resultado
    ? `${ROTULO_PARCELA[resultado.entrada.parcela]} · ${resultado.entrada.avos}/12 avos` + (resultado.entrada.medias > 0 ? ' · com médias' : '')
    : '13º salário'

  return montarLinha(registro, dados, { ...form }, erros, itens, detalhe)
}

export function processarRegistros(
  registros: readonly RegistroPlanilha[],
  tolerancia: number,
  tabelas: Tabelas,
  instituicao: InstituicaoLote | null = null,
): LinhaLote[] {
  return registros.map((registro) => {
    if (registro.tipo === 'hora_aula') return processarHoraAula(registro, tolerancia, tabelas, instituicao)
    if (registro.tipo === 'ferias') return processarFerias(registro, tolerancia, tabelas)
    if (registro.tipo === 'decimo') return processarDecimo(registro, tolerancia, tabelas)

    return processarFolha(registro, tolerancia, tabelas)
  })
}
