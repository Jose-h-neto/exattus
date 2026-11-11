/*
 * Exporta o resultado de um lote: um funcionario por linha, com calculado,
 * valor da folha e diferenca de cada item, destacando as divergencias.
 */

import { formatarDataHora } from '@/domain/datas'
import { formatarMoeda } from '@/domain/dinheiro'
import { CHAVES_ITENS_LOTE, type ChaveItemLote } from '@/domain/lote/conferencia'
import { formatarCompetencia, type Empresa, type Lote, type StatusLinhaLote } from '@/domain/lote/tipos'

import { NOME_ABA } from './colunas'
import { BORDA_CELULA, COR, faixaTitulo, fonte, FORMATO, linhaFina, novaPasta, paraBlob, preenchimento } from './excel'

const ROTULO_ITEM: Record<ChaveItemLote, string> = {
  proventos: 'Proventos (bruto)',
  descontos: 'Total descontos',
  inss: 'INSS',
  irrf: 'IRRF',
  liquido: 'Líquido',
  fgts: 'FGTS (empregador)',
}

export const ROTULO_STATUS: Record<StatusLinhaLote, string> = {
  confere: 'Confere',
  divergente: 'Divergente',
  sem_informado: 'Sem valores da folha',
  erro: 'Com erro',
}

const COR_STATUS: Record<StatusLinhaLote, { fundo: string; texto: string }> = {
  confere: { fundo: COR.successSoft, texto: COR.success },
  divergente: { fundo: COR.dangerSoft, texto: COR.danger },
  sem_informado: { fundo: COR.sunken, texto: COR.muted },
  erro: { fundo: COR.warningSoft, texto: COR.warning },
}

const IDENTIFICACAO = [
  { cabecalho: 'Linha', largura: 7 },
  { cabecalho: 'Tipo', largura: 10 },
  { cabecalho: 'Matrícula', largura: 11 },
  { cabecalho: 'Nome', largura: 30 },
  { cabecalho: 'CPF', largura: 15 },
  { cabecalho: 'Situação', largura: 18 },
  { cabecalho: 'Detalhe', largura: 30 },
]

export async function exportarLote(lote: Lote, empresa: Empresa): Promise<Blob> {
  const pasta = await novaPasta()
  const aba = pasta.addWorksheet('Resultado', {
    properties: { tabColor: { argb: COR.primary } },
    views: [{ state: 'frozen', xSplit: 4, ySplit: 4, showGridLines: false }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  })

  const colunasItens = CHAVES_ITENS_LOTE.length * 3
  const total = IDENTIFICACAO.length + colunasItens + 1
  const { resumo } = lote

  faixaTitulo(
    aba,
    total,
    `Resultado da conferência  ·  ${empresa.nome}  ·  ${formatarCompetencia(lote.competencia)}`,
    [
      `${resumo.total} funcionários`,
      `${resumo.confere} conferem`,
      `${resumo.divergente} divergentes`,
      `${resumo.erro} com erro`,
      `Tolerância ${formatarMoeda(lote.tolerancia)}`,
      `Importado de ${lote.arquivo} em ${formatarDataHora(lote.criadoEm)}`,
    ].join('  ·  '),
  )

  // Linha 3: grupos.
  const grupo = (de: number, ate: number, texto: string, fundo: string, cor: string) => {
    aba.mergeCells(3, de, 3, ate)

    const celula = aba.getCell(3, de)

    celula.value = texto
    celula.font = fonte({ size: 9, bold: true, cor })
    celula.fill = preenchimento(fundo)
    celula.alignment = { horizontal: 'center', vertical: 'middle' }
    celula.border = { left: { style: 'medium', color: { argb: COR.white } } }
  }

  grupo(1, IDENTIFICACAO.length, 'FUNCIONÁRIO', COR.violet100, COR.primaryHover)

  CHAVES_ITENS_LOTE.forEach((chave, indice) => {
    const inicio = IDENTIFICACAO.length + 1 + indice * 3
    const par = indice % 2 === 0

    grupo(inicio, inicio + 2, ROTULO_ITEM[chave].toUpperCase(), par ? COR.sunken : COR.accentSoft, par ? COR.ink : COR.accentInk)
  })

  grupo(total, total, 'ERROS', COR.warningSoft, COR.warning)
  aba.getRow(3).height = 20

  // Linha 4: cabecalhos.
  const cabecalhos = [
    ...IDENTIFICACAO,
    ...CHAVES_ITENS_LOTE.flatMap(() => [
      { cabecalho: 'Calculado', largura: 14 },
      { cabecalho: 'Folha', largura: 14 },
      { cabecalho: 'Diferença', largura: 13 },
    ]),
    { cabecalho: 'Erros da linha', largura: 60 },
  ]

  cabecalhos.forEach((coluna, indice) => {
    const celula = aba.getCell(4, indice + 1)

    celula.value = coluna.cabecalho
    celula.font = fonte({ size: 9, bold: true })
    celula.fill = preenchimento(COR.violet50)
    celula.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    celula.border = { bottom: { style: 'medium', color: { argb: COR.primary } }, left: linhaFina(COR.white), right: linhaFina(COR.white) }
    aba.getColumn(indice + 1).width = coluna.largura
  })

  aba.getRow(4).height = 30

  // Dados.
  const ordem: Record<StatusLinhaLote, number> = { divergente: 0, erro: 1, sem_informado: 2, confere: 3 }
  const linhas = [...lote.linhas].sort((a, b) => ordem[a.status] - ordem[b.status] || a.tipo.localeCompare(b.tipo) || a.linha - b.linha)

  linhas.forEach((linha, posicao) => {
    const numero = 5 + posicao
    const fundo = posicao % 2 ? COR.hover : COR.white
    const itens = new Map(linha.itens.map((item) => [item.chave, item]))

    const valores: (string | number | null)[] = [
      linha.linha,
      linha.horaAula ? NOME_ABA.hora_aula : NOME_ABA[linha.tipo],
      linha.matricula,
      linha.nome,
      linha.cpf,
      ROTULO_STATUS[linha.status],
      linha.detalhe,
      ...CHAVES_ITENS_LOTE.flatMap((chave) => {
        const item = itens.get(chave)

        if (!item) return [null, null, null]

        return [item.calculado / 100, item.informado === null ? null : item.informado / 100, item.diferenca === null ? null : item.diferenca / 100]
      }),
      linha.erros.join(' | '),
    ]

    const registro = aba.getRow(numero)

    registro.values = valores
    registro.height = 18

    valores.forEach((_, indice) => {
      const celula = registro.getCell(indice + 1)
      const emItens = indice >= IDENTIFICACAO.length && indice < IDENTIFICACAO.length + colunasItens

      celula.fill = preenchimento(fundo)
      celula.border = BORDA_CELULA
      celula.font = fonte({ bold: indice === 3 })
      celula.alignment = { vertical: 'middle', horizontal: emItens ? 'right' : indice < 2 ? 'center' : 'left' }

      if (emItens) celula.numFmt = FORMATO.moeda
      if (indice === 2 || indice === 4) celula.numFmt = '@'
    })

    const situacao = registro.getCell(6)

    situacao.fill = preenchimento(COR_STATUS[linha.status].fundo)
    situacao.font = fonte({ bold: true, cor: COR_STATUS[linha.status].texto })

    CHAVES_ITENS_LOTE.forEach((chave, indice) => {
      if (itens.get(chave)?.situacao !== 'divergente') return

      const diferenca = registro.getCell(IDENTIFICACAO.length + indice * 3 + 3)

      diferenca.fill = preenchimento(COR.dangerSoft)
      diferenca.font = fonte({ bold: true, cor: COR.danger })
    })

    if (linha.erros.length) registro.getCell(total).font = fonte({ cor: COR.warning })
  })

  aba.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: total } }

  return paraBlob(pasta)
}
