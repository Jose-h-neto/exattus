/*
 * Gera o modelo de planilha da conferencia em lote, com o visual do sistema:
 * abas Instrucoes, Lote, Folha, Ferias e 13o salario; grupos de colunas por cor, notas nos
 * cabecalhos, validacao de dados e formatos de moeda, data e horas.
 */

import type { DataValidation, Worksheet } from 'exceljs'

import { formatarPercentual } from '@/domain/dinheiro'
import { formatarCnpj, type Empresa } from '@/domain/lote/tipos'
import { ANO_VIGENCIA } from '@/domain/parametros'

import {
  CAMPOS_ABA_LOTE,
  colunasHoraAula,
  COLUNAS_DECIMO,
  COLUNAS_FERIAS,
  COLUNAS_FOLHA,
  normalizarCabecalho,
  PREFIXO_AULA,
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
  aulas: { titulo: 'AULAS NO MÊS (QUANTIDADE)', fundo: COR.infoSoft, texto: COR.info, dado: COR.white, zebra: COR.infoTint },
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
  quantidade: 'Número de aulas',
  parcela: 'Lista',
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
      if (coluna.aceitaSoma) return null

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
    case 'parcela':
      return { type: 'list', formulae: ['"1ª parcela,2ª parcela"'], ...erroValidacao('Parcela inválida', 'Escolha 1ª parcela ou 2ª parcela na lista.') }
    case 'quantidade':
      return { type: 'decimal', operator: 'between', formulae: [0, 9999], ...erroValidacao('Quantidade inválida', 'Informe o número de aulas no mês, ex.: 40.') }
    default:
      return null
  }
}

function formatoNumerico(coluna: ColunaLote): string | undefined {
  if (coluna.tipo === 'moeda') return FORMATO.moeda
  if (coluna.tipo === 'data') return FORMATO.data
  if (coluna.tipo === 'horas') return FORMATO.horas
  if (coluna.tipo === 'inteiro') return '0'
  if (coluna.tipo === 'quantidade') return 'General'
  if (coluna.campo === 'matricula' || coluna.campo === 'cpf') return '@'

  return undefined
}

function alinhamentoHorizontal(coluna: ColunaLote): 'left' | 'center' | 'right' {
  if (coluna.tipo === 'moeda') return 'right'
  if (coluna.tipo === 'texto') return 'left'

  return 'center'
}

/** linhasIniciais: valores ja preenchidos por campo (ex.: professores e aulas padrao). */
function abaDados(aba: Worksheet, titulo: string, colunas: ColunaLote[], linhasIniciais: Record<string, string | number>[] = []) {
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
    else if (coluna.subcabecalho) {
      celula.value = {
        richText: [
          { text: coluna.cabecalho, font: fonte({ size: 9, bold: true, cor: grupo.texto }) },
          { text: `\n${coluna.subcabecalho}`, font: fonte({ size: 8, cor: COR.muted }) },
        ],
      }
    } else celula.value = coluna.cabecalho

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

  aba.getRow(LINHA_CABECALHO).height = colunas.some((coluna) => coluna.subcabecalho) ? 48 : 40

  // Area de dados: zebrado, bordas, formatos e validacao.
  const validacoes = colunas.map(validacao)

  const totalLinhas = Math.max(LINHAS_MODELO, linhasIniciais.length + 50)

  for (let numero = LINHA_CABECALHO + 1; numero <= LINHA_CABECALHO + totalLinhas; numero++) {
    const zebra = (numero - LINHA_CABECALHO) % 2 === 0
    const linha = aba.getRow(numero)
    const inicial = linhasIniciais[numero - LINHA_CABECALHO - 1]

    linha.height = 18

    colunas.forEach((coluna, indice) => {
      const celula = linha.getCell(indice + 1)
      const grupo = GRUPOS[coluna.grupo]
      const formato = formatoNumerico(coluna)
      const regra = validacoes[indice]
      const valor = inicial?.[coluna.campo]

      if (valor !== undefined && valor !== '') celula.value = valor

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

interface ContextoModelo {
  empresa?: Empresa
  /** Colunas da aba Hora-aula, quando a empresa tem tabela de hora-aula. */
  colunasHoraAula: ColunaLote[] | null
}

function abaInstrucoes(aba: Worksheet, contexto: ContextoModelo) {
  const tabelaHoraAula = contexto.colunasHoraAula ? contexto.empresa?.horaAula : undefined

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
    tabelaHoraAula
      ? ['2', 'Abas Folha, Hora-aula, Férias e 13º', 'Uma linha por funcionário. Professores por hora-aula vão na aba Hora-aula. Abas vazias são ignoradas.']
      : ['2', 'Abas Folha, Férias e 13º', 'Uma linha por funcionário. Pode usar só as abas que precisar; abas vazias são ignoradas.'],
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
    ...(tabelaHoraAula
      ? [['aulas', 'Aulas no mês', 'Aba Hora-aula: quantidade de aulas no mês de cada tipo. O valor vem da tabela da instituição.'] as [GrupoColuna, string, string]]
      : []),
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

  if (tabelaHoraAula && contexto.colunasHoraAula) {
    dicionario('Hora-aula', contexto.colunasHoraAula)
    linha--
    aba.mergeCells(linha, 2, linha, 6)
    textoLivre(
      2,
      `Regras de ${contexto.empresa?.nome}: hora-atividade de ${formatarPercentual(tabelaHoraAula.horaAtividade)} sobre o total das aulas; ` +
        `DSR = (total das aulas + hora-atividade) ÷ ${tabelaHoraAula.divisorDsr}. O total entra nos proventos (base do INSS e do IRRF).`,
      { cor: COR.info, bold: true, size: 9 },
    ).fill = preenchimento(COR.infoSoft)
    aba.getRow(linha).height = 30
    linha += 2
  }

  dicionario('Férias', COLUNAS_FERIAS)
  dicionario('13º salário', COLUNAS_DECIMO)

  titulo('Dicas')

  const dicas = [
    tabelaHoraAula
      ? 'A aba Hora-aula já vem com os professores cadastrados e as aulas padrão do mês: altere só o que mudou, inclua quem faltar e preencha as colunas rosa. Para mudar valores ou tipos de aula, edite a tabela no Exattus e baixe o modelo de novo.'
      : 'Para professores por hora-aula, baixe o modelo de dentro da pasta da instituição (Cofre de lotes): ele traz a aba Hora-aula com os tipos de aula.',
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

function abaLote(aba: Worksheet, empresa?: Empresa) {
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

    // Modelo baixado de dentro de uma pasta: ja vem com a empresa preenchida.
    if (empresa && campo.campo === 'empresa') valor.value = empresa.nome
    if (empresa?.cnpj && campo.campo === 'cnpj') valor.value = formatarCnpj(empresa.cnpj)

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

/**
 * empresa: modelo baixado de dentro de uma pasta do cofre. Preenche a aba Lote
 * e, se a empresa tem tabela de hora-aula, inclui a aba Hora-aula com uma
 * coluna por tipo de aula.
 */
export async function gerarModelo(empresa?: Empresa): Promise<Blob> {
  const pasta = await novaPasta()
  const colunasAula = empresa?.horaAula?.tipos.length ? colunasHoraAula(empresa.horaAula) : null

  pasta.title = 'Modelo de conferência em lote'

  abaInstrucoes(pasta.addWorksheet('Instruções', { properties: { tabColor: { argb: COR.primary } }, views: [{ showGridLines: false }] }), {
    empresa,
    colunasHoraAula: colunasAula,
  })
  abaLote(pasta.addWorksheet('Lote', { properties: { tabColor: { argb: COR.primaryHover } }, views: [{ showGridLines: false }] }), empresa)

  const opcoesDados = (cor: string) => ({
    properties: { tabColor: { argb: cor } },
    views: [{ state: 'frozen' as const, xSplit: 2, ySplit: LINHA_CABECALHO, showGridLines: false }],
    pageSetup: { orientation: 'landscape' as const, fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
  })

  abaDados(pasta.addWorksheet('Folha', opcoesDados(COR.primary)), 'Conferência em lote  ·  Folha mensal', COLUNAS_FOLHA)

  if (colunasAula && empresa?.horaAula) {
    const regra = `hora-atividade ${formatarPercentual(empresa.horaAula.horaAtividade)} · DSR (aulas + hora-atividade) ÷ ${empresa.horaAula.divisorDsr}`

    // Professores cadastrados entram ja preenchidos com as aulas padrao do mes.
    const tipos = empresa.horaAula.tipos
    const professores = [...(empresa.professores ?? [])]
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      .map((professor) => ({
        matricula: professor.matricula,
        nome: professor.nome,
        ...Object.fromEntries(
          tipos
            .filter((tipo) => professor.aulas[tipo.id])
            .map((tipo) => [`${PREFIXO_AULA}${normalizarCabecalho(tipo.descricao)}`, (professor.aulas[tipo.id] ?? 0) / 100]),
        ),
      }))

    abaDados(pasta.addWorksheet('Hora-aula', opcoesDados(COR.info)), `Hora-aula  ·  ${empresa.nome}  ·  ${regra}`, colunasAula, professores)
  }

  abaDados(pasta.addWorksheet('Férias', opcoesDados(COR.accent)), 'Conferência em lote  ·  Férias', COLUNAS_FERIAS)
  abaDados(pasta.addWorksheet('13º salário', opcoesDados(COR.success)), 'Conferência em lote  ·  13º salário (1ª ou 2ª parcela)', COLUNAS_DECIMO)

  pasta.views = [{ x: 0, y: 0, width: 20000, height: 12000, firstSheet: 0, activeTab: 0, visibility: 'visible' }]

  return paraBlob(pasta)
}
