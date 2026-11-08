/*
 * Resumo de eventos -> lancamentos da folha (Instituto Terra).
 * Cada coluna do resumo (cabecalho) vira uma rubrica do sistema da folha, e o
 * valor da celula e convertido conforme a unidade da rubrica:
 *   valor: R$ (ex.: 700)            -> 700
 *   horas: tempo do Excel (2:20)    -> 2,20 (horas.minutos, como o sistema da folha espera)
 *   dias:  numero de dias; uma data na celula conta como 1 dia (o dia da falta)
 */

export type UnidadeEvento = 'valor' | 'horas' | 'dias'

export interface RubricaEvento {
  id: string
  codigo: string
  descricao: string
  unidade: UnidadeEvento
}

export interface ConfigEventos {
  codigoEmpresa: string
  rubricas: RubricaEvento[]
  /** Escolhas do usuario para cabecalhos: chave normalizada -> id da rubrica ou IGNORAR. */
  mapeamentos: Record<string, string>
  /** Rubricas desligadas: as colunas continuam reconhecidas, mas nao sao lancadas. */
  desligadas: string[]
}

export const IGNORAR = 'ignorar'

export const ROTULO_UNIDADE: Record<UnidadeEvento, string> = { valor: 'Valor (R$)', horas: 'Horas', dias: 'Dias' }

/** Rubricas do Instituto Terra, na ordem dos lancamentos. */
export const RUBRICAS_INSTITUTO_TERRA: readonly RubricaEvento[] = [
  { id: 'vale-alimentacao', codigo: '955', descricao: 'Vale alimentação', unidade: 'valor' },
  { id: 'he-50', codigo: '15', descricao: 'Horas extras 50%', unidade: 'horas' },
  { id: 'he-100', codigo: '19', descricao: 'Horas extras 100%', unidade: 'horas' },
  { id: 'adicional-noturno', codigo: '13', descricao: 'Adicional noturno 25%', unidade: 'horas' },
  { id: 'faltas-horas', codigo: '310', descricao: 'Atraso (= faltas em horas)', unidade: 'horas' },
  { id: 'faltas-dias', codigo: '311', descricao: 'Faltas (em dias)', unidade: 'dias' },
  { id: 'diarias', codigo: '1004', descricao: 'Diárias de viagens', unidade: 'valor' },
  { id: 'auxilio-creche', codigo: '34', descricao: 'Auxílio creche', unidade: 'valor' },
  { id: 'gratificacao', codigo: '25', descricao: 'Gratificação', unidade: 'valor' },
  { id: 'comissao', codigo: '24', descricao: 'Comissão', unidade: 'valor' },
]

export const CODIGO_EMPRESA_INSTITUTO_TERRA = '136866'

export function configPadrao(): ConfigEventos {
  return {
    codigoEmpresa: CODIGO_EMPRESA_INSTITUTO_TERRA,
    rubricas: RUBRICAS_INSTITUTO_TERRA.map((rubrica) => ({ ...rubrica })),
    mapeamentos: {},
    desligadas: [],
  }
}

/** "VLR. AUXÍLIO ALIMENTAÇÃO " -> "vlr auxilio alimentacao" */
export function normalizarCabecalho(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Reconhecimento automatico dos cabecalhos das abas do resumo (ja normalizados). */
const RECONHECIMENTO: { id: string; padrao: RegExp }[] = [
  { id: 'vale-alimentacao', padrao: /\b(aux\w*|vale|vlr)\b.*\balimenta/ },
  { id: 'he-50', padrao: /\b(hrs?|horas?)\s+extras?\s+50\b/ },
  { id: 'he-100', padrao: /\b(hrs?|horas?)\s+extras?\s+100\b/ },
  { id: 'adicional-noturno', padrao: /\bad\w*\s+noturno\b/ },
  { id: 'faltas-horas', padrao: /\bfaltas?\s+em\s+(hrs?|horas?)\b|\batrasos?\b/ },
  { id: 'faltas-dias', padrao: /\bfaltas?\s+em\s+dias?\b/ },
  { id: 'diarias', padrao: /\bdiarias?\b/ },
  { id: 'auxilio-creche', padrao: /\b(aux\w*)\s+creche\b/ },
  { id: 'gratificacao', padrao: /\bgratifica/ },
  { id: 'comissao', padrao: /\bcomiss/ },
]

/** Colunas de controle ou descontos lancados por outro caminho: ficam fora sem perguntar. */
const FORA_DO_LANCAMENTO = /\b(aabb|consignado|emprestimo|emprest|plano de saude|penhora|minutos|obs|observac\w*|seguro|total)\b/

export type DestinoColuna =
  | { tipo: 'rubrica'; rubrica: RubricaEvento; automatico: boolean }
  | { tipo: 'ignorada'; automatico: boolean }
  | { tipo: 'sem-rubrica' }

export function destinoDaColuna(chave: string, config: ConfigEventos): DestinoColuna {
  const escolhido = config.mapeamentos[chave]

  if (escolhido === IGNORAR) return { tipo: 'ignorada', automatico: false }

  if (escolhido) {
    const rubrica = config.rubricas.find((item) => item.id === escolhido)

    if (rubrica) return { tipo: 'rubrica', rubrica, automatico: false }
  }

  const reconhecida = RECONHECIMENTO.find((item) => item.padrao.test(chave))
  const rubrica = reconhecida && config.rubricas.find((item) => item.id === reconhecida.id)

  if (rubrica) return { tipo: 'rubrica', rubrica, automatico: true }
  if (FORA_DO_LANCAMENTO.test(chave)) return { tipo: 'ignorada', automatico: true }

  return { tipo: 'sem-rubrica' }
}

/** 140 minutos -> 2.2 (2 horas e 20 minutos, no formato horas.minutos). */
export function minutosParaHorasMinutos(minutos: number): number {
  const total = Math.round(minutos)

  return Math.round((Math.trunc(total / 60) + (total % 60) / 100) * 100) / 100
}

/** 140 minutos -> "2h20" */
export function formatarDuracao(minutos: number): string {
  const total = Math.round(minutos)
  const horas = Math.trunc(total / 60)
  const resto = total % 60

  return resto ? `${horas}h${String(resto).padStart(2, '0')}` : `${horas}h`
}

/** "IT_RESUMO EVENTOS_10.2026.xlsx" -> "2026-10" */
export function competenciaDoArquivo(nome: string): string | null {
  const achado = /(?:^|[^\d])(0?[1-9]|1[0-2])[._\-/ ](20\d{2})(?!\d)/.exec(nome)

  return achado ? `${achado[2]}-${achado[1]!.padStart(2, '0')}` : null
}
