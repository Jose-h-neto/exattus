import { dividirArredondando } from './dinheiro'

/*
 * Remuneracao por hora-aula (setor educacional).
 * 1. Cada tipo de aula: quantidade de aulas no mes x valor da hora-aula.
 * 2. Hora-atividade: percentual sobre o total das aulas.
 * 3. DSR: (total das aulas + hora-atividade) / divisor (padrao 6).
 * O total integra os proventos (base do INSS e do IRRF).
 */

export interface TipoAula {
  id: string
  descricao: string
  /** Valor de uma hora-aula, em centavos. */
  valor: number
  /** Codigo da rubrica no sistema da folha (planilha de lancamentos). */
  codigo?: string
}

export interface TabelaHoraAula {
  tipos: TipoAula[]
  /** Adicional de hora-atividade sobre o total das aulas, em pontos-base (5% = 500). */
  horaAtividade: number
  /** DSR = (aulas + hora-atividade) / divisor. */
  divisorDsr: number
}

export interface LinhaHoraAula {
  tipoId: string
  descricao: string
  valor: number
  /** Quantidade de aulas no mes, em centesimos (80 aulas = 8000). */
  quantidade: number
  total: number
}

export interface ResultadoHoraAula {
  linhas: LinhaHoraAula[]
  /** Soma das quantidades, em centesimos. */
  quantidade: number
  totalAulas: number
  percentualHoraAtividade: number
  horaAtividade: number
  divisorDsr: number
  dsr: number
  /** Aulas + hora-atividade + DSR. */
  total: number
}

export const LIMITE_AULAS = 9_999_99
export const LIMITE_DIVISOR_DSR = 31

/**
 * Rubricas de hora-aula padrao (tabela da Alvorada-Bianchi). Tambem sao
 * oferecidas como sugestao para cadastrar nas instituicoes que nao as tem.
 */
export const RUBRICAS_HORA_AULA_PADRAO: readonly TipoAula[] = [
  { id: 'ensino-medio', descricao: 'Ensino Médio', valor: 6425, codigo: '1002' },
  { id: 'fundamental-1', descricao: 'Ensino Fundamental I', valor: 5257, codigo: '1017' },
  { id: 'fundamental-2', descricao: 'Ensino Fundamental II', valor: 5257, codigo: '1018' },
  { id: 'infantil', descricao: 'Hora Aula Infantil', valor: 5257, codigo: '1019' },
  { id: 'subs-ensino-medio', descricao: 'Hora Aula Subs Ensino Médio', valor: 6425 },
  { id: 'subs-fundamental', descricao: 'Hora Subs Fundamental', valor: 5257 },
  { id: 'reuniao', descricao: 'Hora Aula Reunião', valor: 6425 },
  { id: 'ppe', descricao: 'Hora Aula PPE', valor: 4291, codigo: '1005' },
  { id: 'reforco-plantao', descricao: 'Hora Aula Reforço/Plantão', valor: 6425, codigo: '1003' },
  { id: 'vestibulinho', descricao: 'Hora Aula Vestibulinho', valor: 6425 },
  { id: 'aula-subs-fundamental', descricao: 'Hora Aula Subs Fundamental', valor: 5257 },
  { id: 'olimpiada', descricao: 'Hora Aula Olimpíada', valor: 6425, codigo: '1020' },
  { id: 'contraturno', descricao: 'Hora Aula Contraturno', valor: 5257, codigo: '1021' },
]

/** Rubrica da primeira versao (Fund. I e II somados): substituida por Fundamental I (1017) e II (1018). */
export const RUBRICA_FUNDAMENTAL_ANTIGA = 'Ensino Fundamental I e II'

/**
 * Completa a tabela da instituicao com o padrao: preenche o codigo das rubricas
 * conhecidas que estao sem codigo. Nao muda valores nem descricoes.
 */
export function preencherCodigos(tabela: TabelaHoraAula): TabelaHoraAula {
  return {
    ...tabela,
    tipos: tabela.tipos.map((tipo) => {
      if (tipo.codigo) return tipo

      const padrao = RUBRICAS_HORA_AULA_PADRAO.find((rubrica) => mesmaRubrica(rubrica.descricao, tipo.descricao))

      return padrao?.codigo ? { ...tipo, codigo: padrao.codigo } : tipo
    }),
  }
}

/** Professor da instituicao com as aulas padrao do mes (base para a conferencia). */
export interface ProfessorHoraAula {
  id: string
  nome: string
  /** Turma ou disciplina, so para identificacao. */
  turma: string
  matricula: string
  /** Aulas padrao do mes por tipo de aula (id do tipo -> centesimos; 36 aulas = 3600). */
  aulas: Record<string, number>
}

/** Soma das aulas padrao do professor, em centesimos (so tipos que ainda existem na tabela). */
export function totalAulasProfessor(professor: ProfessorHoraAula, tabela?: TabelaHoraAula): number {
  return Object.entries(professor.aulas)
    .filter(([tipoId]) => !tabela || tabela.tipos.some((tipo) => tipo.id === tipoId))
    .reduce((soma, [, quantidade]) => soma + quantidade, 0)
}

/** Centesimos para o texto dos campos: 3600 -> "36"; 3150 -> "31,5"; 0 -> "". */
export function aulasParaTexto(centesimos: number | undefined): string {
  return centesimos ? formatarAulas(centesimos) : ''
}

/** Tabela pre-cadastrada da instituicao Alvorada-Bianchi. */
export function tabelaHoraAulaPadrao(): TabelaHoraAula {
  return {
    tipos: RUBRICAS_HORA_AULA_PADRAO.map((tipo) => ({ ...tipo })),
    horaAtividade: 500,
    divisorDsr: 6,
  }
}

/** Compara descricoes de tipos de aula ignorando caixa, acentos e espacos. */
export function mesmaRubrica(a: string, b: string): boolean {
  const normalizar = (texto: string) =>
    texto.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[\s-]+/g, ' ').trim().toLowerCase()

  return normalizar(a) === normalizar(b)
}

export function calcularHoraAula(tabela: TabelaHoraAula, quantidades: Readonly<Record<string, number>>): ResultadoHoraAula {
  const linhas = tabela.tipos
    .map((tipo) => {
      const quantidade = quantidades[tipo.id] ?? 0

      return {
        tipoId: tipo.id,
        descricao: tipo.descricao,
        valor: tipo.valor,
        quantidade,
        total: dividirArredondando(tipo.valor * quantidade, 100),
      }
    })
    .filter((linha) => linha.quantidade > 0)

  const totalAulas = linhas.reduce((soma, linha) => soma + linha.total, 0)
  const horaAtividade = dividirArredondando(totalAulas * tabela.horaAtividade, 10000)
  const dsr = tabela.divisorDsr > 0 ? dividirArredondando(totalAulas + horaAtividade, tabela.divisorDsr) : 0

  return {
    linhas,
    quantidade: linhas.reduce((soma, linha) => soma + linha.quantidade, 0),
    totalAulas,
    percentualHoraAtividade: tabela.horaAtividade,
    horaAtividade,
    divisorDsr: tabela.divisorDsr,
    dsr,
    total: totalAulas + horaAtividade + dsr,
  }
}

/** Quantidade de aulas em centesimos para exibicao: 8000 -> "80"; 8050 -> "80,5". */
export function formatarAulas(centesimos: number): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(centesimos / 100)
}

export function validarTabelaHoraAula(tabela: TabelaHoraAula): string[] {
  const erros: string[] = []
  const nomes = new Set<string>()

  if (!tabela.tipos.length) erros.push('Cadastre ao menos um tipo de aula.')

  for (const tipo of tabela.tipos) {
    const nome = tipo.descricao.trim().toLocaleLowerCase('pt-BR')

    if (!nome) erros.push('Todo tipo de aula precisa de uma descrição.')
    else if (nomes.has(nome)) erros.push(`“${tipo.descricao.trim()}” aparece duas vezes.`)
    if (!Number.isSafeInteger(tipo.valor) || tipo.valor <= 0) erros.push(`Informe o valor de “${tipo.descricao.trim() || 'sem descrição'}”.`)

    nomes.add(nome)
  }

  if (!Number.isSafeInteger(tabela.horaAtividade) || tabela.horaAtividade < 0 || tabela.horaAtividade > 10000) {
    erros.push('A hora-atividade deve ficar entre 0% e 100%.')
  }

  if (!Number.isInteger(tabela.divisorDsr) || tabela.divisorDsr < 1 || tabela.divisorDsr > LIMITE_DIVISOR_DSR) {
    erros.push(`O divisor do DSR deve ficar entre 1 e ${LIMITE_DIVISOR_DSR}.`)
  }

  return [...new Set(erros)]
}
