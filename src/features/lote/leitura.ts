/*
 * Leitura da planilha de conferencia em lote. As colunas sao localizadas pelo
 * texto do cabecalho; cada celula vira o texto que os formularios dos calculos
 * ja sabem interpretar ("5500,00", "AAAA-MM-DD", "hh:mm").
 */

import type { Cell, CellValue, Worksheet } from 'exceljs'

import { brParaIso, paraInputData } from '@/domain/datas'
import {
  CAMPOS_ABA_LOTE,
  COLUNAS,
  COLUNAS_HORA_AULA_FIXAS,
  NOME_ABA,
  normalizarCabecalho,
  PREFIXO_AULA,
  type CampoAbaLote,
  type ColunaLote,
  type TipoAbaLote,
} from './colunas'
import { carregarExcel } from './excel'

export interface RegistroPlanilha {
  /** Aba de origem. */
  tipo: TipoAbaLote
  /** Numero da linha na planilha. */
  linha: number
  /** Valores por campo (ColunaLote.campo), ja convertidos para texto. */
  valores: Record<string, string>
}

export type DadosAbaLote = Record<CampoAbaLote['campo'], string>

export interface PlanilhaLida {
  lote: DadosAbaLote
  registros: RegistroPlanilha[]
  /** Problemas de estrutura (abas ou colunas nao encontradas). */
  avisos: string[]
}

/** Dia zero das datas seriais do Excel (sistema 1900). */
const EPOCA_EXCEL = Date.UTC(1899, 11, 30)
const MS_DIA = 86_400_000

/** Valor "cru" da celula: resolve formulas, rich text, hyperlinks e erros. */
function valorBruto(valor: CellValue): string | number | boolean | Date | null {
  if (valor === null || valor === undefined) return null
  if (valor instanceof Date || typeof valor !== 'object') return valor

  if ('result' in valor) return valorBruto((valor.result ?? null) as CellValue)
  if ('richText' in valor) return valor.richText.map((parte) => parte.text).join('')
  if ('text' in valor) return String(valor.text)
  if ('error' in valor) return null

  return null
}

function texto(valor: ReturnType<typeof valorBruto>): string {
  if (valor === null) return ''
  if (valor instanceof Date) return paraInputData(valor)

  return String(valor).trim()
}

/** Dinheiro: numero vira "1234,56" (sem ambiguidade de milhar); texto segue como digitado. */
function moeda(valor: ReturnType<typeof valorBruto>): string {
  if (typeof valor === 'number') return valor.toFixed(2).replace('.', ',')

  return texto(valor)
}

function inteiro(valor: ReturnType<typeof valorBruto>): string {
  if (typeof valor === 'number') return Number.isInteger(valor) ? String(valor) : String(valor).replace('.', ',')

  return texto(valor)
}

function minutosParaHoras(minutos: number): string {
  const total = Math.round(minutos)

  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/** Horas: o Excel guarda fracao de dia (10:30 = 0,4375) ou uma data a partir de 30/12/1899. */
function horas(valor: ReturnType<typeof valorBruto>): string {
  if (valor instanceof Date) return minutosParaHoras((valor.getTime() - EPOCA_EXCEL) / 60_000)
  if (typeof valor === 'number') return minutosParaHoras(valor * 24 * 60)

  return texto(valor)
}

/** Datas: celula de data, numero serial, "dd/mm/aaaa" ou "aaaa-mm-dd". Invalida segue como texto (gera erro). */
function data(valor: ReturnType<typeof valorBruto>): string {
  if (valor instanceof Date) {
    return paraInputData(new Date(Date.UTC(valor.getUTCFullYear(), valor.getUTCMonth(), valor.getUTCDate())))
  }

  if (typeof valor === 'number') return paraInputData(new Date(EPOCA_EXCEL + Math.round(valor) * MS_DIA))

  const bruto = texto(valor)

  if (!bruto) return ''

  const [dia = '', mes = '', ano = ''] = bruto.split('/')
  const completo = ano ? `${dia.padStart(2, '0')}/${mes.padStart(2, '0')}/${ano}` : bruto

  return brParaIso(completo) ?? bruto
}

function modalidade(valor: ReturnType<typeof valorBruto>): string {
  const normalizado = normalizarCabecalho(texto(valor)).replace(/[\s-]/g, '')

  if (!normalizado || normalizado === 'empregado') return 'empregado'
  if (normalizado === 'prolabore') return 'prolabore'

  return texto(valor)
}

/** "1ª parcela", "1", "primeira", "adiantamento" -> primeira; "2ª parcela", "2", "segunda", "final" -> segunda. */
function parcela(valor: ReturnType<typeof valorBruto>): string {
  const normalizado = normalizarCabecalho(texto(valor))

  if (!normalizado) return ''
  if (/^1|primeira|adiantamento/.test(normalizado)) return 'primeira'
  if (/^2|segunda|final/.test(normalizado)) return 'segunda'

  return texto(valor)
}

function converter(coluna: ColunaLote, celula: Cell): string {
  const valor = valorBruto(celula.value)

  switch (coluna.tipo) {
    case 'moeda':
    case 'quantidade':
      return moeda(valor)
    case 'inteiro':
      return inteiro(valor)
    case 'horas':
      return horas(valor)
    case 'data':
      return data(valor)
    case 'modalidade':
      return modalidade(valor)
    case 'parcela':
      return parcela(valor)
    default:
      return texto(valor)
  }
}

function localizarAba(abas: Worksheet[], nome: string): Worksheet | undefined {
  const alvo = normalizarCabecalho(nome)

  return abas.find((aba) => normalizarCabecalho(aba.name) === alvo)
}

/** So a primeira linha do cabecalho conta: a segunda e informativa (ex.: "R$ 64,25 / aula"). */
function textoCabecalho(celula: Cell): string {
  return normalizarCabecalho(texto(valorBruto(celula.value)).split('\n')[0] ?? '')
}

/**
 * Procura, nas primeiras linhas, a linha de cabecalho que contem a coluna Nome.
 * extrasComoAulas: na aba Hora-aula, toda coluna desconhecida e um tipo de aula.
 */
function lerCabecalho(aba: Worksheet, colunas: ColunaLote[], extrasComoAulas = false) {
  const porCabecalho = new Map(colunas.map((coluna) => [normalizarCabecalho(coluna.cabecalho), coluna]))
  const limite = Math.min(aba.rowCount, 15)

  for (let numero = 1; numero <= limite; numero++) {
    const mapa = new Map<number, ColunaLote>()

    aba.getRow(numero).eachCell((celula, indice) => {
      const cabecalho = textoCabecalho(celula)
      const coluna = porCabecalho.get(cabecalho)

      if (coluna) {
        mapa.set(indice, coluna)
      } else if (extrasComoAulas && cabecalho) {
        mapa.set(indice, { campo: `${PREFIXO_AULA}${cabecalho}`, cabecalho, grupo: 'aulas', tipo: 'quantidade', largura: 12, nota: '' })
      }
    })

    if ([...mapa.values()].some((coluna) => coluna.campo === 'nome')) {
      return { linha: numero, mapa }
    }
  }

  return null
}

function lerAbaDados(aba: Worksheet, tipo: TipoAbaLote, avisos: string[]): RegistroPlanilha[] {
  const colunas = tipo === 'hora_aula' ? COLUNAS_HORA_AULA_FIXAS : COLUNAS[tipo]
  const cabecalho = lerCabecalho(aba, colunas, tipo === 'hora_aula')

  if (!cabecalho) {
    avisos.push(`Aba ${NOME_ABA[tipo]}: não encontrei a linha de cabeçalho com a coluna "Nome".`)
    return []
  }

  const encontrados = new Set([...cabecalho.mapa.values()].map((coluna) => coluna.campo))
  const faltando = colunas.filter((coluna) => coluna.obrigatorio && !encontrados.has(coluna.campo))

  if (faltando.length) {
    avisos.push(`Aba ${NOME_ABA[tipo]}: faltam as colunas obrigatórias ${faltando.map((coluna) => `"${coluna.cabecalho}"`).join(', ')}.`)
  }

  const registros: RegistroPlanilha[] = []

  for (let numero = cabecalho.linha + 1; numero <= aba.rowCount; numero++) {
    const linha = aba.getRow(numero)
    const valores: Record<string, string> = {}

    for (const [indice, coluna] of cabecalho.mapa) {
      valores[coluna.campo] = converter(coluna, linha.getCell(indice))
    }

    // Linha totalmente em branco (as 300 linhas formatadas do modelo) e ignorada.
    const preenchida = Object.values(valores).some((valor) => valor !== '' && valor !== 'empregado')

    if (preenchida) registros.push({ tipo, linha: numero, valores })
  }

  return registros
}

function lerAbaLote(aba: Worksheet | undefined): DadosAbaLote {
  const dados: DadosAbaLote = { empresa: '', cnpj: '', competencia: '', descricao: '', tolerancia: '' }

  if (!aba) return dados

  const porRotulo = new Map(CAMPOS_ABA_LOTE.map((campo) => [normalizarCabecalho(campo.rotulo), campo]))

  aba.eachRow((linha) => {
    linha.eachCell((celula, indice) => {
      const campo = porRotulo.get(normalizarCabecalho(texto(valorBruto(celula.value))))

      if (!campo) return

      const valor = valorBruto(linha.getCell(indice + 1).value)

      dados[campo.campo] = campo.tipo === 'moeda' ? moeda(valor) : texto(valor)
    })
  })

  return dados
}

export async function lerPlanilha(arquivo: File): Promise<PlanilhaLida> {
  const ExcelJS = await carregarExcel()
  const pasta = new ExcelJS.Workbook()

  try {
    await pasta.xlsx.load(await arquivo.arrayBuffer())
  } catch {
    throw new Error('Não foi possível abrir o arquivo. Envie uma planilha do Excel (.xlsx).')
  }

  const abas = pasta.worksheets
  const avisos: string[] = []
  const registros: RegistroPlanilha[] = []

  const tipos = ['folha', 'hora_aula', 'ferias', 'decimo'] as const

  for (const tipo of tipos) {
    const aba = localizarAba(abas, NOME_ABA[tipo])

    if (aba) registros.push(...lerAbaDados(aba, tipo, avisos))
  }

  if (!tipos.some((tipo) => localizarAba(abas, NOME_ABA[tipo]))) {
    avisos.push('A planilha não tem as abas "Folha", "Hora-aula", "Férias" nem "13º salário". Use o modelo do Exattus.')
  }

  return { lote: lerAbaLote(localizarAba(abas, 'Lote')), registros, avisos }
}
