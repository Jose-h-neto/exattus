/*
 * Leitura do "Resumo de eventos" do Instituto Terra: uma aba por centro de
 * custo, com a linha de cabecalho que tem "COLABORADOR", a matricula na coluna
 * antes do nome e uma coluna por evento. Abas ocultas (calculos auxiliares) e
 * abas sem a linha de cabecalho sao ignoradas; linhas sem matricula (totais,
 * anotacoes) tambem.
 */

import type { Cell, CellValue, Worksheet } from 'exceljs'

import { carregarExcel } from '@/features/lote/excel'

import { normalizarCabecalho } from './regras'

/** Valor de uma celula do resumo, ja classificado. */
export type ValorEvento =
  | { tipo: 'numero'; numero: number }
  | { tipo: 'tempo'; minutos: number }
  | { tipo: 'data'; data: string }
  | { tipo: 'texto'; texto: string }

export interface ColunaResumo {
  /** Cabecalho normalizado (chave do mapeamento). */
  chave: string
  cabecalho: string
  coluna: number
}

export interface ColaboradorResumo {
  linha: number
  matricula: string
  nome: string
  /** Por chave de coluna; celulas vazias nao aparecem. */
  valores: Record<string, ValorEvento>
  /** Textos soltos na linha, fora das colunas de eventos (ex.: "LICENÇA INSS"). */
  notas: string[]
}

export interface AbaResumo {
  nome: string
  colunas: ColunaResumo[]
  colaboradores: ColaboradorResumo[]
  /** Textos da aba fora das linhas de colaboradores (ex.: "ATENÇÃO: a gratificação tem que sair líquida…"). */
  anotacoes: string[]
}

export interface ResumoEventos {
  abas: AbaResumo[]
  /** Abas visiveis sem a linha "COLABORADOR" (ex.: Resumo). */
  ignoradas: string[]
}

const EPOCA_EXCEL = Date.UTC(1899, 11, 30)
const MS_MINUTO = 60_000
/** Datas antes de marco/1900 sao horas (o Excel guarda tempo como fracao de dia a partir de 30/12/1899). */
const LIMITE_TEMPO = Date.UTC(1900, 2, 1)

function resultado(valor: CellValue): CellValue {
  if (valor && typeof valor === 'object' && !(valor instanceof Date)) {
    if ('formula' in valor || 'sharedFormula' in valor) return (valor.result ?? null) as CellValue
    if ('richText' in valor) return valor.richText.map((parte) => parte.text).join('')
    if ('text' in valor) return String(valor.text)
    if ('error' in valor) return null
  }

  return valor
}

function texto(celula: Cell): string {
  const valor = resultado(celula.value)

  if (valor === null || valor === undefined) return ''
  if (valor instanceof Date) return ''
  if (typeof valor === 'object') return ''

  return String(valor).replace(/\s+/g, ' ').trim()
}

/** Formato de hora no Excel ("h:mm", "[h]:mm:ss"), sem dia/mes/ano. */
function formatoDeHora(formato: string | undefined): boolean {
  return Boolean(formato && /h/i.test(formato) && !/[dy]/i.test(formato.replace(/\[[^\]]*\]/g, '')))
}

function paraData(data: Date): string {
  return `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, '0')}-${String(data.getUTCDate()).padStart(2, '0')}`
}

/** "2:20", "02:20:00" -> minutos */
function tempoDeTexto(valor: string): number | null {
  const achado = /^(\d{1,3}):([0-5]\d)(?::[0-5]\d)?$/.exec(valor)

  return achado ? Number(achado[1]) * 60 + Number(achado[2]) : null
}

/** "383,34", "1.059,86", "R$ 700" -> numero */
function numeroDeTexto(valor: string): number | null {
  const limpo = valor.replace(/^r\$\s*/i, '').trim()

  if (!/^-?[\d.]*\d(,\d+)?$/.test(limpo) && !/^-?\d+(\.\d+)?$/.test(limpo)) return null

  const numero = /,/.test(limpo) ? Number(limpo.replace(/\./g, '').replace(',', '.')) : Number(limpo)

  return Number.isFinite(numero) ? numero : null
}

export function lerValor(celula: Cell): ValorEvento | null {
  const valor = resultado(celula.value)

  if (valor === null || valor === undefined) return null

  if (valor instanceof Date) {
    if (Number.isNaN(valor.getTime())) return null
    if (valor.getTime() < LIMITE_TEMPO) return { tipo: 'tempo', minutos: Math.round((valor.getTime() - EPOCA_EXCEL) / MS_MINUTO) }

    return { tipo: 'data', data: paraData(valor) }
  }

  if (typeof valor === 'number') {
    // Hora digitada numa celula formatada como hora, mas lida como numero (fracao do dia).
    if (formatoDeHora(celula.numFmt)) return { tipo: 'tempo', minutos: Math.round(valor * 1440) }

    return { tipo: 'numero', numero: valor }
  }

  if (typeof valor === 'boolean' || typeof valor === 'object') return null

  const conteudo = String(valor).replace(/\s+/g, ' ').trim()

  if (!conteudo || /^[-–—]+$/.test(conteudo)) return null

  const minutos = tempoDeTexto(conteudo)

  if (minutos !== null) return { tipo: 'tempo', minutos }

  const numero = numeroDeTexto(conteudo)

  if (numero !== null) return { tipo: 'numero', numero }

  return { tipo: 'texto', texto: conteudo }
}

function ehNomeDaColuna(chave: string): boolean {
  return /^(colaborador(es)?|funcionario(s)?|nome|empregado)$/.test(chave)
}

function matriculaDe(celula: Cell): string {
  const valor = resultado(celula.value)

  if (typeof valor === 'number' && Number.isInteger(valor) && valor >= 0) return String(valor)
  if (typeof valor === 'string' && /^\d+$/.test(valor.trim())) return valor.trim()

  return ''
}

function lerAba(aba: Worksheet): AbaResumo | null {
  // Cabecalho: primeira linha (ate a 20a) com a coluna "COLABORADOR".
  let linhaCabecalho = 0
  let colunaNome = 0

  for (let numero = 1; numero <= Math.min(aba.rowCount, 20) && !linhaCabecalho; numero++) {
    aba.getRow(numero).eachCell((celula, coluna) => {
      if (!linhaCabecalho && ehNomeDaColuna(normalizarCabecalho(texto(celula)))) {
        linhaCabecalho = numero
        colunaNome = coluna
      }
    })
  }

  if (!linhaCabecalho) return null

  const cabecalho = aba.getRow(linhaCabecalho)
  let colunaMatricula = colunaNome > 1 ? colunaNome - 1 : 0
  const colunas: ColunaResumo[] = []

  cabecalho.eachCell((celula, coluna) => {
    const rotulo = texto(celula)
    const chave = normalizarCabecalho(rotulo)

    if (!chave || coluna === colunaNome) return
    if (/^(matricula|mat|registro|cod\w*)$/.test(chave)) {
      colunaMatricula = coluna
      return
    }

    colunas.push({ chave, cabecalho: rotulo, coluna })
  })

  const porColuna = new Map(colunas.map((coluna) => [coluna.coluna, coluna]))
  const colaboradores: ColaboradorResumo[] = []
  const anotacoes: string[] = []

  for (let numero = linhaCabecalho + 1; numero <= aba.rowCount; numero++) {
    const linha = aba.getRow(numero)
    const matricula = colunaMatricula ? matriculaDe(linha.getCell(colunaMatricula)) : ''
    const nome = texto(linha.getCell(colunaNome))

    // Total da aba, anotacoes e linhas em branco nao tem matricula.
    if (!matricula || !nome) {
      linha.eachCell((celula) => {
        const solto = texto(celula)

        if (solto.length >= 12 && /[a-z]{3}/i.test(solto) && !anotacoes.includes(solto)) anotacoes.push(solto)
      })
      continue
    }

    const valores: Record<string, ValorEvento> = {}
    const notas: string[] = []

    linha.eachCell((celula, coluna) => {
      if (coluna === colunaNome || coluna === colunaMatricula) return

      const destino = porColuna.get(coluna)

      if (!destino) {
        const solto = texto(celula)

        if (solto && !/^[\d.,\s:/-]+$/.test(solto)) notas.push(solto)
        return
      }

      const valor = lerValor(celula)

      if (!valor) return
      // Coluna OBS e afins: texto vira nota.
      if (valor.tipo === 'texto' && /^obs/.test(destino.chave)) {
        notas.push(valor.texto)
        return
      }

      valores[destino.chave] = valor
    })

    colaboradores.push({ linha: numero, matricula, nome, valores, notas })
  }

  return { nome: aba.name.trim(), colunas, colaboradores, anotacoes }
}

export async function lerResumoEventos(arquivo: File | ArrayBuffer): Promise<ResumoEventos> {
  const ExcelJS = await carregarExcel()
  const pasta = new ExcelJS.Workbook()

  try {
    await pasta.xlsx.load(arquivo instanceof ArrayBuffer ? arquivo : await arquivo.arrayBuffer())
  } catch {
    throw new Error('Não foi possível abrir o arquivo. Envie a planilha de resumo de eventos em .xlsx.')
  }

  const abas: AbaResumo[] = []
  const ignoradas: string[] = []

  for (const aba of pasta.worksheets) {
    if (aba.state !== 'visible') continue

    const lida = lerAba(aba)

    if (lida?.colaboradores.length) abas.push(lida)
    else if (aba.rowCount > 0) ignoradas.push(aba.name.trim())
  }

  if (!abas.length) {
    throw new Error('Nenhuma aba com a coluna “COLABORADOR” e matrículas foi encontrada. Confira se é o resumo de eventos.')
  }

  return { abas, ignoradas }
}
