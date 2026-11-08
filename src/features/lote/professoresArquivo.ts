/*
 * Arquivo de professores da instituicao (.xlsx): aba "Professores" (uma linha
 * por professor, uma coluna por tipo de aula) e aba "Tabela" (valor de cada
 * rubrica, hora-atividade e divisor do DSR). Exportado pelo sistema e
 * importado de volta sem nenhuma escolha manual: as colunas tem o nome exato
 * das rubricas e as que faltarem na instituicao sao criadas com o valor do arquivo.
 */

import type { CellValue } from 'exceljs'

import { formatarPercentual, paraCentavos } from '@/domain/dinheiro'
import { mesmaRubrica, type TabelaHoraAula, type TipoAula } from '@/domain/horaAula'
import type { Empresa } from '@/domain/lote/tipos'

import { BORDA_CELULA, carregarExcel, COR, fonte, FORMATO, novaPasta, paraBlob, preenchimento } from './excel'

const ABA_PROFESSORES = 'Professores'
const ABA_TABELA = 'Tabela'
const ROTULO_HORA_ATIVIDADE = 'Hora-atividade (%)'
const ROTULO_DIVISOR = 'Divisor do DSR'

export async function exportarProfessores(empresa: Empresa): Promise<Blob> {
  const tabela = empresa.horaAula
  const professores = [...(empresa.professores ?? [])].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  const tipos = (tabela?.tipos ?? []).filter((tipo) => professores.some((professor) => professor.aulas[tipo.id]))
  const pasta = await novaPasta()

  pasta.title = `Professores · ${empresa.nome}`

  // Aba Professores: cabecalho na linha 1 (tambem serve para copiar e colar).
  const aba = pasta.addWorksheet(ABA_PROFESSORES, {
    properties: { tabColor: { argb: COR.info } },
    views: [{ state: 'frozen', xSplit: 1, ySplit: 1 }],
  })
  // Colunas fixas: Professor, Turma, Cod. da empresa, Matricula; depois uma por tipo de aula e o total.
  const FIXAS = 4
  const cabecalhos = ['Professor', 'Turma', 'Cód. da empresa', 'Matrícula', ...tipos.map((tipo) => tipo.descricao), 'Total de aulas']
  const larguras = [34, 24, 14, 12]

  aba.columns = cabecalhos.map((cabecalho, indice) => ({ header: cabecalho, width: larguras[indice] ?? 14 }))

  const cabecalho = aba.getRow(1)

  cabecalho.height = 36
  cabecalho.eachCell((celula, indice) => {
    const aulas = indice > FIXAS && indice < cabecalhos.length

    celula.font = fonte({ size: 9, bold: true, cor: aulas ? COR.info : COR.primaryHover })
    celula.fill = preenchimento(aulas ? COR.infoSoft : COR.violet100)
    celula.alignment = { horizontal: indice > 2 ? 'center' : 'left', vertical: 'middle', wrapText: true, indent: indice > 2 ? 0 : 1 }
    celula.border = { bottom: { style: 'medium', color: { argb: COR.primary } } }
  })

  professores.forEach((professor, posicao) => {
    const quantidades = tipos.map((tipo) => (professor.aulas[tipo.id] ? (professor.aulas[tipo.id] ?? 0) / 100 : null))
    const total = Object.values(professor.aulas).reduce((soma, valor) => soma + valor, 0) / 100
    const linha = aba.addRow([professor.nome, professor.turma, empresa.codigoFolha ?? '', professor.matricula, ...quantidades, total])

    linha.eachCell({ includeEmpty: true }, (celula, indice) => {
      celula.fill = preenchimento(posicao % 2 ? COR.hover : COR.white)
      celula.border = BORDA_CELULA
      celula.font = fonte({ bold: indice === 1 || indice === FIXAS || indice === cabecalhos.length })
      celula.alignment = { vertical: 'middle', horizontal: indice > 2 ? 'right' : 'left', indent: indice > 2 ? 0 : 1 }
      if (indice === 3 || indice === FIXAS) celula.numFmt = '@'
      if (indice > FIXAS) celula.numFmt = '#,##0.##'
    })
  })

  // Aba Tabela: valores da instituicao, para recriar as rubricas ao importar.
  const abaTabela = pasta.addWorksheet(ABA_TABELA, { properties: { tabColor: { argb: COR.primary } } })

  abaTabela.columns = [{ header: 'Rubrica', width: 34 }, { header: 'Valor da hora-aula', width: 20 }, { header: 'Código da rubrica', width: 18 }]
  abaTabela.getRow(1).eachCell((celula) => {
    celula.font = fonte({ size: 9, bold: true, cor: COR.white })
    celula.fill = preenchimento(COR.primaryHover)
  })

  for (const tipo of tabela?.tipos ?? []) {
    const linha = abaTabela.addRow([tipo.descricao, tipo.valor / 100, tipo.codigo ?? ''])

    linha.getCell(2).numFmt = FORMATO.moeda
  }

  abaTabela.addRow([])
  abaTabela.addRow([ROTULO_HORA_ATIVIDADE, (tabela?.horaAtividade ?? 0) / 100])
  abaTabela.addRow([ROTULO_DIVISOR, tabela?.divisorDsr ?? 6])
  abaTabela.addRow([])
  abaTabela.addRow([
    `Regras: hora-atividade de ${formatarPercentual(tabela?.horaAtividade ?? 0)} sobre o total das aulas; DSR = (aulas + hora-atividade) ÷ ${tabela?.divisorDsr ?? 6}.`,
  ])

  return paraBlob(pasta)
}

export interface ArquivoProfessores {
  /** Tabela de professores como texto separado por tabulacao (mesmo formato do "Colar do Excel"). */
  texto: string
  /** Rubricas e valores da aba Tabela, quando o arquivo veio do Exattus. */
  rubricas: TipoAula[]
}

function textoCelula(valor: CellValue): string {
  if (valor === null || valor === undefined) return ''
  if (typeof valor === 'number') return String(valor).replace('.', ',')
  if (valor instanceof Date) return valor.toISOString().slice(0, 10)
  if (typeof valor === 'object') {
    if ('result' in valor) return textoCelula((valor.result ?? null) as CellValue)
    if ('richText' in valor) return valor.richText.map((parte) => parte.text).join('')
    if ('text' in valor) return String(valor.text)

    return ''
  }

  return String(valor).trim()
}

/** Le .xlsx (exportado pelo Exattus ou planilha da escola) ou texto (.tsv, .txt, .csv). */
export async function lerArquivoProfessores(arquivo: File): Promise<ArquivoProfessores> {
  if (!/\.xlsx$/i.test(arquivo.name)) {
    const texto = await arquivo.text()

    // CSV do Excel em portugues usa ";".
    return { texto: /\.csv$/i.test(arquivo.name) ? texto.replace(/;/g, '\t') : texto, rubricas: [] }
  }

  const ExcelJS = await carregarExcel()
  const pasta = new ExcelJS.Workbook()

  try {
    await pasta.xlsx.load(await arquivo.arrayBuffer())
  } catch {
    throw new Error('Não foi possível abrir o arquivo. Envie uma planilha .xlsx.')
  }

  const aba = pasta.worksheets.find((item) => item.name.trim().toLowerCase() === ABA_PROFESSORES.toLowerCase()) ?? pasta.worksheets[0]

  if (!aba) throw new Error('A planilha está vazia.')

  const linhas: string[] = []

  aba.eachRow({ includeEmpty: false }, (linha) => {
    const celulas: string[] = []

    for (let coluna = 1; coluna <= aba.columnCount; coluna++) celulas.push(textoCelula(linha.getCell(coluna).value))

    linhas.push(celulas.join('\t'))
  })

  const rubricas: TipoAula[] = []
  const abaTabela = pasta.getWorksheet(ABA_TABELA)

  abaTabela?.eachRow((linha, numero) => {
    if (numero === 1) return

    const descricao = textoCelula(linha.getCell(1).value)
    const valor = paraCentavos(textoCelula(linha.getCell(2).value))

    if (!descricao || valor === null || Number.isNaN(valor) || valor <= 0) return
    if (descricao === ROTULO_HORA_ATIVIDADE || descricao === ROTULO_DIVISOR) return

    const codigo = textoCelula(linha.getCell(3).value)

    rubricas.push({ id: '', descricao, valor, ...(codigo ? { codigo } : {}) })
  })

  return { texto: linhas.join('\n'), rubricas }
}

function novoId(base: string, tipos: readonly TipoAula[]): string {
  const raiz =
    base
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'rubrica'

  let id = raiz
  let contador = 2

  while (tipos.some((tipo) => tipo.id === id)) id = `${raiz}-${contador++}`

  return id
}

/** Acrescenta a tabela as rubricas do arquivo que a instituicao ainda nao tem. */
export function completarTabela(tabela: TabelaHoraAula, rubricas: readonly TipoAula[]): { tabela: TabelaHoraAula; criadas: TipoAula[] } {
  const tipos = [...tabela.tipos]
  const criadas: TipoAula[] = []

  for (const rubrica of rubricas) {
    const existente = tipos.findIndex((tipo) => mesmaRubrica(tipo.descricao, rubrica.descricao))

    // Ja existe: so completa o codigo da rubrica, se faltar.
    if (existente >= 0) {
      const tipo = tipos[existente]!

      if (!tipo.codigo && rubrica.codigo) tipos[existente] = { ...tipo, codigo: rubrica.codigo }

      continue
    }

    const nova = { ...rubrica, id: novoId(rubrica.descricao, tipos) }

    tipos.push(nova)
    criadas.push(nova)
  }

  return { tabela: { ...tabela, tipos }, criadas }
}
