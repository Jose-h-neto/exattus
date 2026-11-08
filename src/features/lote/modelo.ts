/*
 * Gera o modelo de planilha da conferencia em lote, com o visual do sistema:
 * abas Instrucoes, Lote, Folha e Ferias; grupos de colunas por cor, notas nos
 * cabecalhos, validacao de dados e formatos de moeda, data e horas.
 */

import type { DataValidation, Worksheet } from 'exceljs'

import { ANO_VIGENCIA } from '@/domain/parametros'

import {
  CAMPOS_ABA_LOTE,
  COLUNAS_FERIAS,
  COLUNAS_FOLHA,
  type ColunaLote,
  type GrupoColuna,
  type TipoColuna,
} from './colunas'
import {
  BORDA_CELULA,
  COR,
  faixaTitulo,
  fonte,
  FORMATO,
  linhaFina,
  novaPasta,
  paraBlob,
  preenchimento,
  rotuloObrigatorio,
} from './excel'

/** Linhas ja formatadas para preenchimento em cada aba de dados. */
const LINHAS_MODELO = 300
/** Linha 1 titulo, 2 subtitulo, 3 grupos, 4 cabecalhos. */
export const LINHA_CABECALHO = 4

const GRUPOS: Record<GrupoColuna, { titulo: string; fundo: string; texto: string; dado: string; zebra: string }> = {
  id: { titulo: 'IDENTIFICAÇÃO', fundo: COR.violet100, texto: COR.primaryHover, dado: COR.white, zebra: COR.hover },
  calc: { titulo: 'DADOS DO CÁLCULO', fundo: COR.sunken, texto: COR.ink, dado: COR.white, zebra: COR.hover },
  conf: { titulo: 'VALORES DA FOLHA PARA CONFERIR', fundo: COR.accentSoft, texto: COR.accentInk, dado: COR.accentTint, zebra: COR.accentSoft },
}

const FORMATO_DESCRITO: Record<TipoColuna, string> = {
  texto: 'Texto',
  moeda: 'R$',
  inteiro: 'Inteiro',
  horas: 'hh:mm',
  data: 'dd/mm/aaaa',
  modalidade: 'Lista',
}

function descreverFormato(coluna: ColunaLote): string {
  if (coluna.tipo === 'inteiro' && coluna.minimo !== undefined && coluna.maximo !== undefined) {
    return `Inteiro ${coluna.minimo}–${coluna.maximo}`
  }

  return FORMATO_DESCRITO[coluna.tipo]
}

function erroValidacao(titulo: string, mensagem: string): Pick<DataValidation, 'allowBlank' | 'showErrorMessage' | 'errorStyle' | 'errorTitle' | 'error'> {
  return { allowBlank: true, showErrorMessage: true, errorStyle: 'stop', errorTitle: titulo, error: mensagem }
}

function validacao(coluna: ColunaLote): DataValidation | null {
  switch (coluna.tipo) {
    case 'moeda':
      return coluna.positivo
        ? { type: 'decimal', operator: 'greaterThan', formulae: [0], ...erroValidacao('Valor inválido', 'Este valor precisa ser maior que zero. Ex.: 3200,00') }
        : { type: 'decimal', operator: 'greaterThanOrEqual', formulae: [0], ...erroValidacao('Valor inválido', 'Informe um valor em reais maior ou igual a zero. Ex.: 5500,00') }
    case 'inteiro':
      return {
        type: 'whole',
        operator: 'between',
        formulae: [coluna.minimo ?? 0, coluna.maximo ?? 99],
        ...erroValidacao(`${coluna.cabecalho} inválido`, `Use um número inteiro entre ${coluna.minimo ?? 0} e ${coluna.maximo ?? 99}.`),
      }
    case 'horas':
      // Horas sao fracoes de dia no Excel: 300:00 = 12,5 dias.
      return { type: 'decimal', operator: 'between', formulae: [0, 12.5], ...erroValidacao('Horas inválidas', 'Digite no formato hh:mm, ex.: 10:30. Máximo 300:00.') }
    case 'data':
      return {
        type: 'date',
        operator: 'between',
        formulae: [new Date(Date.UTC(ANO_VIGENCIA, 0, 1)), new Date(Date.UTC(ANO_VIGENCIA, 11, 31))],
        ...erroValidacao('Data inválida', `Informe uma data de ${ANO_VIGENCIA} no formato dd/mm/aaaa.`),
      }
    case 'modalidade':
      return { type: 'list', formulae: ['"Empregado,Pró-labore"'], ...erroValidacao('Modalidade inválida', 'Escolha Empregado ou Pró-labore na lista.') }
    default:
      return null
  }
}

function formatoNumerico(coluna: ColunaLote): string | undefined {
  if (coluna.tipo === 'moeda') return FORMATO.moeda
  if (coluna.tipo === 'data') return FORMATO.data
  if (coluna.tipo === 'horas') return FORMATO.horas
  if (coluna.tipo === 'inteiro') return '0'
  if (coluna.campo === 'matricula' || coluna.campo === 'cpf') return '@'

  return undefined
}

function alinhamentoHorizontal(coluna: ColunaLote): 'left' | 'center' | 'right' {
  if (coluna.tipo === 'moeda') return 'right'
  if (coluna.tipo === 'texto') return 'left'

  return 'center'
}

function abaDados(aba: Worksheet, titulo: string, colunas: ColunaLote[]) {
  const total = colunas.length

  faixaTitulo(
    aba,
    total,
    titulo,
    'Uma linha por funcionário  ·  Campos com * são obrigatórios  ·  Passe o mouse sobre o cabeçalho para ver a explicação de cada campo  ·  Veja a aba Instruções',
  )

  // Linha 3: grupos de colunas mesclados.
  let inicio = 0

  while (inicio < total) {
    const grupo = colunas[inicio]!.grupo
    let fim = inicio

    while (fim + 1 < total && colunas[fim + 1]!.grupo === grupo) fim++

    aba.mergeCells(3, inicio + 1, 3, fim + 1)

    const celula = aba.getCell(3, inicio + 1)

    celula.value = GRUPOS[grupo].titulo
    celula.font = fonte({ size: 9, bold: true, cor: GRUPOS[grupo].texto })
    celula.fill = preenchimento(GRUPOS[grupo].fundo)
    celula.alignment = { horizontal: 'center', vertical: 'middle' }
    celula.border = { left: { style: 'medium', color: { argb: COR.white } } }
    inicio = fim + 1
  }

  aba.getRow(3).height = 20

  // Linha 4: cabecalhos com nota explicativa.
  colunas.forEach((coluna, indice) => {
    const celula = aba.getCell(LINHA_CABECALHO, indice + 1)
    const grupo = GRUPOS[coluna.grupo]

    if (coluna.obrigatorio) rotuloObrigatorio(celula, coluna.cabecalho, grupo.texto)
    else celula.value = coluna.cabecalho

    celula.font = fonte({ size: 9, bold: true, cor: grupo.texto })
    celula.fill = preenchimento(grupo.fundo)
    celula.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    celula.border = {
      top: linhaFina(COR.white),
      left: linhaFina(COR.white),
      right: linhaFina(COR.white),
      bottom: coluna.obrigatorio ? { style: 'medium', color: { argb: COR.primary } } : linhaFina(COR.lineStrong),
    }
    celula.note = { texts: [{ text: coluna.nota, font: fonte({ size: 9 }) }] }
    aba.getColumn(indice + 1).width = coluna.largura
  })

  aba.getRow(LINHA_CABECALHO).height = 40

  // Area de dados: zebrado, bordas, formatos e validacao.
  const validacoes = colunas.map(validacao)

  for (let numero = LINHA_CABECALHO + 1; numero <= LINHA_CABECALHO + LINHAS_MODELO; numero++) {
    const zebra = (numero - LINHA_CABECALHO) % 2 === 0
    const linha = aba.getRow(numero)

    linha.height = 18

    colunas.forEach((coluna, indice) => {
      const celula = linha.getCell(indice + 1)
      const grupo = GRUPOS[coluna.grupo]
      const formato = formatoNumerico(coluna)
      const regra = validacoes[indice]

      celula.fill = preenchimento(zebra ? grupo.zebra : grupo.dado)
      celula.border = BORDA_CELULA
      celula.font = fonte({ bold: coluna.campo === 'nome' })
      celula.alignment = { vertical: 'middle', horizontal: alinhamentoHorizontal(coluna) }
      if (formato) celula.numFmt = formato
      if (regra) celula.dataValidation = regra
    })
  }

  aba.autoFilter = { from: { row: LINHA_CABECALHO, column: 1 }, to: { row: LINHA_CABECALHO, column: total } }
}

function abaInstrucoes(aba: Worksheet) {
  aba.columns = [{ width: 3 }, { width: 28 }, { width: 13 }, { width: 15 }, { width: 18 }, { width: 70 }]
  faixaTitulo(aba, 6, 'Conferência em lote  ·  Como preencher', 'Preencha a planilha, salve e importe no Exattus em Registros › Cofre de lotes › Importar planilha')

  let linha = 4

  const titulo = (texto: string) => {
    aba.mergeCells(linha, 2, linha, 6)

    const celula = aba.getCell(linha, 2)

    celula.value = texto
    celula.font = fonte({ size: 12, bold: true, cor: COR.primary })
    celula.border = { bottom: { style: 'medium', color: { argb: COR.violet300 } } }
    aba.getRow(linha).height = 24
    linha++
    aba.getRow(linha).height = 6
    linha++
  }

  const textoLivre = (coluna: number, texto: string, opcoes: Parameters<typeof fonte>[0] = {}) => {
    const celula = aba.getCell(linha, coluna)

    celula.value = texto
    celula.font = fonte({ cor: COR.muted, ...opcoes })
    celula.alignment = { vertical: 'middle', wrapText: true, indent: 1 }

    return celula
  }

  titulo('Passo a passo')

  const passos: [string, string, string][] = [
    ['1', 'Aba Lote', 'Informe a empresa, o CNPJ e a competência. O CNPJ coloca o lote na pasta certa do cofre.'],
    ['2', 'Aba Folha e/ou Férias', 'Uma linha por funcionário. Pode usar só uma das abas; a aba vazia é ignorada.'],
    ['3', 'Valores para conferir', 'Nas colunas rosa, copie o que está na folha do cliente. O sistema compara com o próprio cálculo.'],
    ['4', 'Importe no Exattus', 'Salve o arquivo (.xlsx) e importe. Você vê os erros por linha antes de confirmar.'],
  ]

  for (const [numero, nome, texto] of passos) {
    const celulaNome = aba.getCell(linha, 2)

    celulaNome.value = {
      richText: [
        { text: `${numero}  `, font: fonte({ size: 11, bold: true, cor: COR.primary }) },
        { text: nome, font: fonte({ bold: true }) },
      ],
    }
    celulaNome.fill = preenchimento(COR.violet50)
    celulaNome.alignment = { vertical: 'middle', indent: 1 }
    aba.mergeCells(linha, 3, linha, 6)
    textoLivre(3, texto).fill = preenchimento(COR.violet50)
    aba.getRow(linha).height = 26
    linha++
  }

  linha++
  titulo('Legenda das cores')

  const legenda: [GrupoColuna, string, string][] = [
    ['id', 'Identificação', 'Quem é o funcionário. Só o Nome é obrigatório.'],
    ['calc', 'Dados do cálculo', 'O que o Exattus usa para calcular. As tabelas de INSS e IRRF já estão no sistema.'],
    ['conf', 'Valores da folha para conferir', 'O que veio da folha do cliente. Cada valor fica como Confere ou Divergente.'],
  ]

  for (const [grupo, nome, texto] of legenda) {
    const celula = aba.getCell(linha, 2)

    celula.value = nome
    celula.font = fonte({ bold: true, cor: GRUPOS[grupo].texto })
    celula.fill = preenchimento(GRUPOS[grupo].fundo)
    celula.alignment = { vertical: 'middle', indent: 1 }
    aba.mergeCells(linha, 3, linha, 6)
    textoLivre(3, texto)
    aba.getRow(linha).height = 22
    linha++
  }

  const obrigatorio = aba.getCell(linha, 2)

  rotuloObrigatorio(obrigatorio, 'Nome', COR.ink, 10)
  obrigatorio.alignment = { indent: 1 }
  aba.mergeCells(linha, 3, linha, 6)
  textoLivre(3, 'O asterisco vermelho marca os campos obrigatórios. Campos em branco usam o padrão indicado.')
  linha += 2

  const dicionario = (nomeAba: string, colunas: ColunaLote[]) => {
    titulo(`Campos da aba ${nomeAba}`)

    const cabecalhos = ['Campo', 'Obrigatório', 'Formato', 'Exemplo', 'O que é']

    cabecalhos.forEach((texto, indice) => {
      const celula = aba.getCell(linha, indice + 2)
      const aEsquerda = indice === 0 || indice === 4

      celula.value = texto
      celula.font = fonte({ size: 9, bold: true, cor: COR.white })
      celula.fill = preenchimento(COR.primaryHover)
      celula.alignment = { vertical: 'middle', horizontal: aEsquerda ? 'left' : 'center', indent: aEsquerda ? 1 : 0 }
    })

    aba.getRow(linha).height = 20
    linha++

    colunas.forEach((coluna, posicao) => {
      const grupo = GRUPOS[coluna.grupo]
      const valores = [coluna.cabecalho, coluna.obrigatorio ? 'Sim' : '', descreverFormato(coluna), coluna.exemplo || '—', coluna.nota]

      valores.forEach((valor, indice) => {
        const celula = aba.getCell(linha, indice + 2)
        const aEsquerda = indice === 0 || indice === 4
        const cor = indice === 0 ? grupo.texto : indice === 1 ? COR.danger : indice === 3 ? COR.ink : COR.muted

        celula.value = valor
        celula.font = fonte({ size: 9, bold: indice === 0 || (indice === 1 && valor === 'Sim'), cor })
        celula.fill = preenchimento(indice === 0 ? grupo.fundo : posicao % 2 ? COR.hover : COR.white)
        celula.border = { bottom: linhaFina() }
        celula.alignment = { vertical: 'middle', wrapText: indice === 4, horizontal: aEsquerda ? 'left' : 'center', indent: aEsquerda ? 1 : 0 }
      })

      aba.getRow(linha).height = coluna.nota.length > 80 ? 30 : 20
      linha++
    })

    linha++
  }

  dicionario('Folha', COLUNAS_FOLHA)
  dicionario('Férias', COLUNAS_FERIAS)

  titulo('Dicas')

  const dicas = [
    'Valores em reais podem ser digitados como 5500 ou 5500,00. Datas como 06/07/2026. Horas como 10:30.',
    'Não mude o nome dos cabeçalhos: o Exattus encontra as colunas pelo nome. A ordem e colunas extras não atrapalham.',
    'Linhas totalmente em branco são ignoradas. Você pode deixar linhas vazias no meio.',
    'Uma diferença até a tolerância da aba Lote conta como "Confere" (útil para arredondamentos de centavos).',
  ]

  for (const dica of dicas) {
    aba.mergeCells(linha, 2, linha, 6)
    textoLivre(2, `•  ${dica}`)
    aba.getRow(linha).height = 20
    linha++
  }
}

function abaLote(aba: Worksheet) {
  aba.columns = [{ width: 3 }, { width: 24 }, { width: 38 }, { width: 3 }, { width: 62 }]
  faixaTitulo(aba, 5, 'Dados do lote', 'Uma conferência em lote por empresa e competência. Preencha só a coluna branca.')

  let linha = 4

  for (const campo of CAMPOS_ABA_LOTE) {
    const rotulo = aba.getCell(linha, 2)

    if (campo.obrigatorio) rotuloObrigatorio(rotulo, campo.rotulo, COR.primaryHover, 10)
    else rotulo.value = campo.rotulo

    rotulo.font = fonte({ bold: true, cor: COR.primaryHover })
    rotulo.fill = preenchimento(COR.violet100)
    rotulo.alignment = { vertical: 'middle', indent: 1 }
    rotulo.border = { top: linhaFina(COR.white), bottom: linhaFina(COR.white) }

    const valor = aba.getCell(linha, 3)

    valor.fill = preenchimento(COR.white)
    valor.border = {
      top: linhaFina(COR.violet300),
      left: linhaFina(COR.violet300),
      right: linhaFina(COR.violet300),
      bottom: { style: 'medium', color: { argb: campo.obrigatorio ? COR.primary : COR.violet300 } },
    }
    valor.font = fonte({ size: 11 })
    valor.alignment = { vertical: 'middle', indent: 1 }
    valor.numFmt = campo.tipo === 'moeda' ? FORMATO.moeda : '@'

    if (campo.tipo === 'moeda') {
      valor.dataValidation = { type: 'decimal', operator: 'greaterThanOrEqual', formulae: [0], ...erroValidacao('Valor inválido', 'Informe um valor em reais maior ou igual a zero.') }
    } else if (campo.tipo === 'competencia') {
      valor.dataValidation = { type: 'textLength', operator: 'equal', formulae: [7], ...erroValidacao('Competência inválida', 'Use o formato MM/AAAA, ex.: 06/2026.') }
    }

    const ajuda = aba.getCell(linha, 5)

    ajuda.value = campo.ajuda
    ajuda.font = fonte({ size: 9, italic: true, cor: COR.muted })
    ajuda.alignment = { vertical: 'middle', wrapText: true }
    aba.getRow(linha).height = 28
    linha++
    aba.getRow(linha).height = 6
    linha++
  }

  linha++
  aba.mergeCells(linha, 2, linha, 5)

  const nota = aba.getCell(linha, 2)

  nota.value = 'As tabelas de INSS e IRRF, a dedução por dependente, o desconto simplificado e a redução da Lei 15.270/2025 vêm de Parâmetros, no Exattus. Não precisam estar na planilha.'
  nota.font = fonte({ size: 9, cor: COR.success })
  nota.fill = preenchimento(COR.successSoft)
  nota.alignment = { vertical: 'middle', wrapText: true, indent: 1 }
  aba.getRow(linha).height = 34
}

export async function gerarModelo(): Promise<Blob> {
  const pasta = await novaPasta()

  pasta.title = 'Modelo de conferência em lote'

  abaInstrucoes(pasta.addWorksheet('Instruções', { properties: { tabColor: { argb: COR.primary } }, views: [{ showGridLines: false }] }))
  abaLote(pasta.addWorksheet('Lote', { properties: { tabColor: { argb: COR.primaryHover } }, views: [{ showGridLines: false }] }))

  const opcoesDados = (cor: string) => ({
    properties: { tabColor: { argb: cor } },
    views: [{ state: 'frozen' as const, xSplit: 2, ySplit: LINHA_CABECALHO, showGridLines: false }],
    pageSetup: { orientation: 'landscape' as const, fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
  })

  abaDados(pasta.addWorksheet('Folha', opcoesDados(COR.primary)), 'Conferência em lote  ·  Folha mensal', COLUNAS_FOLHA)
  abaDados(pasta.addWorksheet('Férias', opcoesDados(COR.accent)), 'Conferência em lote  ·  Férias', COLUNAS_FERIAS)

  pasta.views = [{ x: 0, y: 0, width: 20000, height: 12000, firstSheet: 0, activeTab: 0, visibility: 'visible' }]

  return paraBlob(pasta)
}
