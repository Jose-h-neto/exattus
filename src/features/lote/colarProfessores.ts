/*
 * Importa professores e aulas padrao a partir de uma tabela copiada do Excel
 * (celulas separadas por tabulacao). Cada coluna de aulas e ligada a uma
 * rubrica da tabela de hora-aula; colunas ligadas a mesma rubrica sao somadas
 * (ex.: "Fund. I" e "Fund. II" -> "Ensino Fundamental I e II").
 */

import { paraCentavos } from '@/domain/dinheiro'
import { mesmaRubrica, RUBRICAS_HORA_AULA_PADRAO, type TabelaHoraAula, type TipoAula } from '@/domain/horaAula'

/** Destino de uma coluna: id de um tipo da tabela, `novo:<id>` (rubrica padrao a criar) ou '' (ignorar). */
export type DestinoColuna = string

export const PREFIXO_NOVA_RUBRICA = 'novo:'

export interface ColunaAulas {
  indice: number
  cabecalho: string
  sugestao: DestinoColuna
}

export interface LinhaColada {
  nome: string
  turma: string
  /** Quantidade por coluna de aulas (mesma ordem de `colunas`), em centesimos; null quando vazia. */
  valores: (number | null)[]
}

export interface TabelaColada {
  colunas: ColunaAulas[]
  linhas: LinhaColada[]
  /** Celulas de aulas que nao sao numero (ignoradas). */
  invalidas: number
  avisos: string[]
}

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Palavras do cabecalho -> trecho que identifica a rubrica. */
const REGRAS: { cabecalho: RegExp; rubrica: (descricao: string) => boolean }[] = [
  { cabecalho: /\bsubs/, rubrica: () => false },
  { cabecalho: /infantil/, rubrica: (d) => d.includes('infantil') },
  { cabecalho: /\bfund/, rubrica: (d) => d.includes('fundamental') && !d.includes('subs') },
  { cabecalho: /\bmedio\b/, rubrica: (d) => d.includes('medio') && !d.includes('subs') },
  { cabecalho: /contraturno/, rubrica: (d) => d.includes('contraturno') },
  { cabecalho: /olimp/, rubrica: (d) => d.includes('olimp') },
  { cabecalho: /\bppe\b/, rubrica: (d) => d.includes('ppe') },
  { cabecalho: /reuni/, rubrica: (d) => d.includes('reuni') },
  { cabecalho: /reforco|plantao/, rubrica: (d) => d.includes('reforco') || d.includes('plantao') },
  { cabecalho: /vestib/, rubrica: (d) => d.includes('vestib') },
]

function procurar(cabecalho: string, tipos: readonly TipoAula[]): TipoAula | undefined {
  const exato = tipos.find((tipo) => mesmaRubrica(tipo.descricao, cabecalho))

  if (exato) return exato

  const texto = normalizar(cabecalho)

  for (const regra of REGRAS) {
    if (regra.cabecalho.test(texto)) return tipos.find((tipo) => regra.rubrica(normalizar(tipo.descricao)))
  }

  return undefined
}

/** Rubrica sugerida para um cabecalho: da tabela, senao uma padrao que a tabela ainda nao tem. */
export function sugerirDestino(cabecalho: string, tabela: TabelaHoraAula): DestinoColuna {
  const daTabela = procurar(cabecalho, tabela.tipos)

  if (daTabela) return daTabela.id

  const faltantes = RUBRICAS_HORA_AULA_PADRAO.filter((padrao) => !tabela.tipos.some((tipo) => mesmaRubrica(tipo.descricao, padrao.descricao)))
  const padrao = procurar(cabecalho, faltantes)

  return padrao ? `${PREFIXO_NOVA_RUBRICA}${padrao.id}` : ''
}

/** Celula numerica ("4,5", "36"): nunca e cabecalho. */
function ehNumero(celula: string): boolean {
  const valor = paraCentavos(celula)

  return valor !== null && !Number.isNaN(valor)
}

const CABECALHO_NOME = /\b(nome|professor|professora|docente|colaborador)\b/
const CABECALHO_TURMA = /\b(turma|disciplina|materia|cargo)\b/

export function lerTabelaColada(texto: string, tabela: TabelaHoraAula): TabelaColada {
  const avisos: string[] = []
  const linhasBrutas = texto
    .replace(/\r/g, '')
    .split('\n')
    .map((linha) => linha.split('\t').map((celula) => celula.trim()))
    .filter((linha) => linha.some(Boolean))

  if (!linhasBrutas.length) return { colunas: [], linhas: [], invalidas: 0, avisos }

  // Cabecalho: entre as primeiras linhas, a que mais tem nomes de rubrica, nome ou turma.
  const pontuar = (linha: string[]) =>
    linha.filter((celula) => {
      const normal = normalizar(celula)

      return Boolean(celula) && !ehNumero(celula) && (CABECALHO_NOME.test(normal) || CABECALHO_TURMA.test(normal) || Boolean(sugerirDestino(celula, tabela)))
    }).length

  let indiceCabecalho = -1
  let melhor = 0

  linhasBrutas.slice(0, 6).forEach((linha, indice) => {
    const pontos = pontuar(linha)

    if (pontos > melhor) {
      melhor = pontos
      indiceCabecalho = indice
    }
  })

  if (indiceCabecalho < 0) {
    avisos.push('Não encontrei a linha de cabeçalho. Copie a tabela incluindo a linha com os nomes das colunas (ex.: Ed Infantil, Fund. I, Médio).')
    return { colunas: [], linhas: [], invalidas: 0, avisos }
  }

  const largura = Math.max(...linhasBrutas.map((linha) => linha.length))

  // Cabecalho de cada coluna; celula vazia herda o texto de uma linha acima (ex.: "TURMA" mesclado).
  const cabecalhos = Array.from({ length: largura }, (_, coluna) => {
    for (let linha = indiceCabecalho; linha >= 0; linha--) {
      const celula = linhasBrutas[linha]?.[coluna] ?? ''

      if (celula && !ehNumero(celula)) return celula
    }

    return ''
  })

  const normalizados = cabecalhos.map(normalizar)
  const colunaNome = Math.max(normalizados.findIndex((cabecalho) => CABECALHO_NOME.test(cabecalho)), 0)
  const colunaTurma = normalizados.findIndex((cabecalho, indice) => indice !== colunaNome && CABECALHO_TURMA.test(cabecalho))

  const colunas: ColunaAulas[] = cabecalhos
    .map((cabecalho, indice) => ({ indice, cabecalho, sugestao: sugerirDestino(cabecalho, tabela) }))
    .filter((coluna) => coluna.cabecalho && coluna.indice !== colunaNome && coluna.indice !== colunaTurma)

  let invalidas = 0

  const linhas = linhasBrutas
    .slice(indiceCabecalho + 1)
    .map((linha) => ({
      nome: linha[colunaNome] ?? '',
      turma: colunaTurma >= 0 ? (linha[colunaTurma] ?? '') : '',
      valores: colunas.map((coluna) => {
        const valor = paraCentavos(linha[coluna.indice] ?? '')

        if (valor !== null && Number.isNaN(valor)) {
          invalidas++
          return null
        }

        return valor
      }),
    }))
    // Sem nome ou linha de total: fora.
    .filter((linha) => linha.nome && !/^total\b/i.test(normalizar(linha.nome)))

  if (!colunas.length) avisos.push('Nenhuma coluna de aulas encontrada ao lado do nome.')

  return { colunas, linhas, invalidas, avisos }
}

export interface ProfessorColado {
  nome: string
  turma: string
  /** Centesimos por id de tipo da tabela resultante. */
  aulas: Record<string, number>
}

/**
 * Aplica os destinos escolhidos: cria as rubricas padrao marcadas como novas
 * e soma as colunas que vao para a mesma rubrica.
 */
export function montarProfessores(
  colada: TabelaColada,
  destinos: readonly DestinoColuna[],
  tabela: TabelaHoraAula,
): { professores: ProfessorColado[]; tabela: TabelaHoraAula; criadas: TipoAula[] } {
  const criadas: TipoAula[] = []
  const tipos = [...tabela.tipos]

  const destinoFinal = destinos.map((destino) => {
    if (!destino.startsWith(PREFIXO_NOVA_RUBRICA)) return destino

    const padrao = RUBRICAS_HORA_AULA_PADRAO.find((rubrica) => rubrica.id === destino.slice(PREFIXO_NOVA_RUBRICA.length))

    if (!padrao) return ''

    const existente = tipos.find((tipo) => mesmaRubrica(tipo.descricao, padrao.descricao))

    if (existente) return existente.id

    const nova = { ...padrao, id: tipos.some((tipo) => tipo.id === padrao.id) ? `${padrao.id}-${tipos.length}` : padrao.id }

    tipos.push(nova)
    criadas.push(nova)

    return nova.id
  })

  const professores = colada.linhas.map((linha) => {
    const aulas: Record<string, number> = {}

    linha.valores.forEach((valor, indice) => {
      const destino = destinoFinal[indice]

      if (destino && valor) aulas[destino] = (aulas[destino] ?? 0) + valor
    })

    return { nome: linha.nome, turma: linha.turma, aulas }
  })

  return { professores, tabela: { ...tabela, tipos }, criadas }
}
