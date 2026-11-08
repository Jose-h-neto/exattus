import type { TabelaHoraAula } from '../horaAula'
import type { ItemConferenciaLote } from './conferencia'

export type TipoLinhaLote = 'folha' | 'ferias'

export type StatusLinhaLote = 'confere' | 'divergente' | 'sem_informado' | 'erro'

/** Um funcionario do lote: os dados lidos da planilha e o resultado da conferencia. */
export interface LinhaLote {
  /** `${tipo}-${linha}`: unico dentro do lote. */
  id: string
  tipo: TipoLinhaLote
  /** Numero da linha na planilha, para o usuario localizar o funcionario. */
  linha: number
  matricula: string
  nome: string
  cpf: string
  /** Veio da aba Hora-aula (e uma folha mensal de professor por hora-aula). */
  horaAula?: boolean
  /** Formulario do calculo (FormularioFolha ou FormularioFerias), para reabrir na tela do calculo. */
  formulario: Record<string, unknown>
  status: StatusLinhaLote
  erros: string[]
  itens: ItemConferenciaLote[]
  /** Texto curto com o contexto do calculo (dias, modalidade, periodo). */
  detalhe: string
}

export interface ResumoLote {
  total: number
  confere: number
  divergente: number
  semInformado: number
  erro: number
  folha: number
  ferias: number
}

export interface Empresa {
  id: string
  nome: string
  /** Somente digitos; vazio quando nao informado. */
  cnpj: string
  criadaEm: string
  /** Instituicao de ensino: valores da hora-aula, hora-atividade e DSR. */
  horaAula?: TabelaHoraAula
}

export interface Lote {
  id: string
  empresaId: string
  /** "AAAA-MM" */
  competencia: string
  descricao: string
  /** Tolerancia em centavos. */
  tolerancia: number
  criadoEm: string
  /** Nome do arquivo importado. */
  arquivo: string
  resumo: ResumoLote
  linhas: LinhaLote[]
}

/** Lote sem as linhas: o que a lista de uma pasta precisa. */
export type CabecalhoLote = Omit<Lote, 'linhas'>

export function resumirLinhas(linhas: readonly LinhaLote[]): ResumoLote {
  const contar = (filtro: (linha: LinhaLote) => boolean) => linhas.filter(filtro).length

  return {
    total: linhas.length,
    confere: contar((linha) => linha.status === 'confere'),
    divergente: contar((linha) => linha.status === 'divergente'),
    semInformado: contar((linha) => linha.status === 'sem_informado'),
    erro: contar((linha) => linha.status === 'erro'),
    folha: contar((linha) => linha.tipo === 'folha'),
    ferias: contar((linha) => linha.tipo === 'ferias'),
  }
}

/** Mantem so os digitos do CNPJ. */
export function normalizarCnpj(texto: string): string {
  return String(texto ?? '').replace(/\D/g, '')
}

export function formatarCnpj(digitos: string): string {
  if (digitos.length !== 14) return digitos

  return digitos.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}

/** "06/2026", "2026-06" ou uma data "2026-06-01" (celula de data no Excel) -> "2026-06"; null quando invalida. */
export function lerCompetencia(texto: string): string | null {
  const limpo = String(texto ?? '').trim()
  const br = /^(\d{1,2})[/-](\d{4})$/.exec(limpo)
  const iso = /^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/.exec(limpo)
  const [ano, mes] = br ? [Number(br[2]), Number(br[1])] : iso ? [Number(iso[1]), Number(iso[2])] : [0, 0]

  if (!ano || mes < 1 || mes > 12) return null

  return `${ano}-${String(mes).padStart(2, '0')}`
}

/** "2026-06" -> "06/2026" */
export function formatarCompetencia(chave: string): string {
  const [ano = '', mes = ''] = chave.split('-')

  return mes && ano ? `${mes}/${ano}` : chave
}
