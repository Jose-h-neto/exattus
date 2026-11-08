/*
 * Carregamento sob demanda do ExcelJS e estilos compartilhados das planilhas
 * geradas pelo sistema (cores do design system, em tokens.css).
 */

import type { Borders, Cell, Fill, Font, Workbook, Worksheet } from 'exceljs'

type ModuloExcel = typeof import('exceljs')

let carregando: Promise<ModuloExcel> | null = null

/** O ExcelJS (~1 MB) so e baixado quando o usuario gera ou importa uma planilha. */
export function carregarExcel(): Promise<ModuloExcel> {
  carregando ??= import('exceljs').then((modulo) => ((modulo as unknown as { default?: ModuloExcel }).default ?? modulo))

  return carregando
}

export async function novaPasta(): Promise<Workbook> {
  const ExcelJS = await carregarExcel()
  const pasta = new ExcelJS.Workbook()

  pasta.creator = 'Exattus'
  pasta.created = new Date()

  return pasta
}

export async function paraBlob(pasta: Workbook): Promise<Blob> {
  const buffer = await pasta.xlsx.writeBuffer()

  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

/* Tokens do design system (src/assets/exattus/tokens.css) em ARGB. */
export const COR = {
  primary: 'FF5A3FC0',
  primaryHover: 'FF4A33A3',
  violet50: 'FFF5F2FE',
  violet100: 'FFEEE9FD',
  violet300: 'FFBFAEFA',
  sunken: 'FFEFEDF6',
  hover: 'FFF7F5FD',
  line: 'FFE7E4F0',
  lineStrong: 'FF858099',
  ink: 'FF18152B',
  muted: 'FF5D5874',
  accent: 'FFA9679A',
  accentSoft: 'FFF7EDF4',
  accentTint: 'FFFCF7FA',
  accentInk: 'FF8A4778',
  white: 'FFFFFFFF',
  success: 'FF127356',
  successSoft: 'FFE2F3EB',
  warning: 'FF8F5300',
  warningSoft: 'FFFCF0DA',
  danger: 'FFBA2D43',
  dangerSoft: 'FFFBE8EB',
  info: 'FF2D6299',
  infoSoft: 'FFE7EFF8',
  infoTint: 'FFF4F8FC',
} as const

/** Manrope raramente esta instalada no Excel; Segoe UI e a mais proxima disponivel. */
export const FONTE = 'Segoe UI'

export const FORMATO = {
  moeda: '"R$" #,##0.00',
  data: 'dd/mm/yyyy',
  horas: '[h]:mm',
} as const

export function preenchimento(argb: string): Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } }
}

export function fonte(opcoes: Partial<Font> & { cor?: string } = {}): Partial<Font> {
  const { cor, ...resto } = opcoes

  return { name: FONTE, size: 10, color: { argb: cor ?? COR.ink }, ...resto }
}

export function linhaFina(argb: string = COR.line) {
  return { style: 'thin' as const, color: { argb } }
}

export const BORDA_CELULA: Partial<Borders> = {
  top: linhaFina(),
  left: linhaFina(),
  bottom: linhaFina(),
  right: linhaFina(),
}

/** Faixa de titulo (linha 1) e subtitulo (linha 2), mescladas ate a ultima coluna. */
export function faixaTitulo(aba: Worksheet, ultimaColuna: number, titulo: string, subtitulo: string) {
  aba.mergeCells(1, 1, 1, ultimaColuna)

  const celulaTitulo = aba.getCell(1, 1)

  celulaTitulo.value = {
    richText: [
      { text: 'EXATTUS', font: fonte({ bold: true, size: 14, cor: COR.white }) },
      { text: `   ·   ${titulo}`, font: fonte({ size: 13, cor: COR.violet100 }) },
    ],
  }
  celulaTitulo.fill = preenchimento(COR.primary)
  celulaTitulo.alignment = { vertical: 'middle', indent: 1 }
  aba.getRow(1).height = 34

  aba.mergeCells(2, 1, 2, ultimaColuna)

  const celulaSubtitulo = aba.getCell(2, 1)

  celulaSubtitulo.value = subtitulo
  celulaSubtitulo.font = fonte({ size: 9, italic: true, cor: COR.muted })
  celulaSubtitulo.fill = preenchimento(COR.violet50)
  celulaSubtitulo.alignment = { vertical: 'middle', indent: 1 }
  aba.getRow(2).height = 22
}

/** Texto com asterisco vermelho de campo obrigatorio. */
export function rotuloObrigatorio(celula: Cell, texto: string, cor: string, tamanho = 9) {
  celula.value = {
    richText: [
      { text: texto, font: fonte({ size: tamanho, bold: true, cor }) },
      { text: ' *', font: fonte({ size: tamanho, bold: true, cor: COR.danger }) },
    ],
  }
}
