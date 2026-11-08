/*
 * Planilha de lancamentos para o sistema da folha da empresa (upload).
 * Layout fixo, igual ao modelo da empresa ("Planilha1", 12 colunas):
 *   Codigo empresa | Matricula | Codigo da Rubrica | Quantidade/Valor | Data do movimento |
 *   Fixar valor? | Observacao | CPF do pensionista | Codigo da administradora de beneficios |
 *   Codigo do produto do beneficios | Item do produto do beneficio | Data demissao
 * Uma linha por professor e rubrica com aulas; a data e o 1o dia da competencia.
 */

import type { TabelaHoraAula } from '@/domain/horaAula'

import { carregarExcel, paraBlob } from './excel'

export const CABECALHOS_LANCAMENTOS = [
  'Código empresa',
  'Matricula',
  'Código da Rubrica',
  'Quantidade/Valor',
  'Data do movimento',
  'Fixar valor?',
  'Observação',
  'CPF do pensionista',
  'Código da administradora de benefícios',
  'Código do produto do benefícios',
  'Item do produto do benefício',
  'Data demissão',
] as const

/** Larguras do modelo da empresa. */
const LARGURAS = [15, 9.140625, 16.28515625, 16.7109375, 18.28515625, 10.7109375, 11, 17.42578125, 35.7109375, 29.7109375, 26.7109375, 13.5703125]

/** Professor e as aulas do mes por tipo de aula (centesimos). */
export interface OrigemLancamento {
  nome: string
  matricula: string
  aulas: Record<string, number>
}

export interface LinhaLancamento {
  nome: string
  rubrica: string
  descricao: string
  matricula: string
  /** Aulas (ex.: 31,5). */
  quantidade: number
}

export interface ResultadoLancamentos {
  linhas: LinhaLancamento[]
  /** Professores com aulas mas sem matricula: ficam de fora. */
  semMatricula: string[]
  /** Rubricas com aulas mas sem codigo: ficam de fora. */
  semCodigo: { descricao: string; professores: string[] }[]
}

export function montarLancamentos(origens: readonly OrigemLancamento[], tabela: TabelaHoraAula): ResultadoLancamentos {
  const linhas: LinhaLancamento[] = []
  const semMatricula: string[] = []
  const semCodigo = new Map<string, string[]>()

  const ordenadas = [...origens].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

  for (const origem of ordenadas) {
    const tipos = tabela.tipos.filter((tipo) => (origem.aulas[tipo.id] ?? 0) > 0)

    if (!tipos.length) continue

    if (!origem.matricula.trim()) {
      semMatricula.push(origem.nome)
      continue
    }

    for (const tipo of tipos) {
      if (!tipo.codigo) {
        semCodigo.set(tipo.descricao, [...(semCodigo.get(tipo.descricao) ?? []), origem.nome])
        continue
      }

      linhas.push({
        nome: origem.nome,
        rubrica: tipo.codigo,
        descricao: tipo.descricao,
        matricula: origem.matricula.trim(),
        quantidade: (origem.aulas[tipo.id] ?? 0) / 100,
      })
    }
  }

  return {
    linhas,
    semMatricula,
    semCodigo: [...semCodigo].map(([descricao, professores]) => ({ descricao, professores })),
  }
}

/** Codigos so com digitos (sem zero a esquerda) vao como numero, como no modelo; o resto como texto. */
function numeroOuTexto(valor: string): number | string {
  return /^[1-9]\d*$/.test(valor) ? Number(valor) : valor
}

/** competencia "AAAA-MM" -> 1o dia do mes (UTC). */
export function primeiroDia(competencia: string): Date {
  const [ano = 0, mes = 1] = competencia.split('-').map(Number)

  return new Date(Date.UTC(ano, mes - 1, 1))
}

export async function gerarPlanilhaLancamentos(linhas: readonly LinhaLancamento[], codigoEmpresa: string, competencia: string): Promise<Blob> {
  const ExcelJS = await carregarExcel()
  const pasta = new ExcelJS.Workbook()
  const aba = pasta.addWorksheet('Planilha1')

  aba.columns = CABECALHOS_LANCAMENTOS.map((cabecalho, indice) => ({ header: cabecalho, width: LARGURAS[indice] }))
  aba.getRow(1).eachCell((celula) => {
    celula.font = { name: 'Calibri', size: 11, bold: true, family: 2, scheme: 'minor', color: { theme: 1 } }
  })

  const data = primeiroDia(competencia)
  const empresa = numeroOuTexto(codigoEmpresa.trim())

  for (const lancamento of linhas) {
    const linha = aba.addRow([empresa, numeroOuTexto(lancamento.matricula), numeroOuTexto(lancamento.rubrica), lancamento.quantidade, data])

    // Formatos do modelo da empresa.
    linha.getCell(1).font = { name: 'Arial', size: 10, family: 2 }
    linha.getCell(4).numFmt = '0.00'
    linha.getCell(5).numFmt = 'mm-dd-yy'
  }

  aba.views = [{ state: 'normal', activeCell: 'A2' }]

  return paraBlob(pasta)
}
