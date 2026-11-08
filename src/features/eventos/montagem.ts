/*
 * Monta os lancamentos do mes a partir do resumo lido, das regras das
 * rubricas e das edicoes feitas na tela (quantidade alterada, linha removida,
 * lancamento incluido a mao).
 */

import type { LinhaLancamento } from '@/features/lote/lancamentos'

import type { ResumoEventos, ValorEvento } from './leitura'
import { destinoDaColuna, formatarDuracao, minutosParaHorasMinutos, type ConfigEventos, type DestinoColuna, type RubricaEvento } from './regras'

export interface LancamentoEvento {
  /** Estavel entre recalculos: aba|linha|coluna (ou manual:<n>). */
  id: string
  aba: string
  matricula: string
  nome: string
  rubrica: RubricaEvento
  /** Quantidade/valor que vai para a planilha (null = precisa de revisao). */
  quantidade: number | null
  /** Valor lido da planilha, como texto (ex.: "2h20", "06/10/2026"). */
  original: string
  /** Por que o valor foi convertido assim ou precisa de revisao. */
  nota?: string
  /** O valor nao pode ser lido com seguranca: o usuario confirma. */
  revisar: boolean
  editado: boolean
  manual: boolean
}

export interface LancamentoManual {
  id: string
  matricula: string
  nome: string
  rubricaId: string
  quantidade: number
}

export interface EdicoesEventos {
  /** id -> nova quantidade, ou null para remover a linha. */
  quantidades: Record<string, number | null>
  manuais: LancamentoManual[]
}

export interface ColunaEncontrada {
  chave: string
  cabecalho: string
  destino: DestinoColuna
  abas: string[]
  /** Celulas preenchidas nessa coluna, em todas as abas. */
  preenchidas: number
}

export interface ResultadoEventos {
  lancamentos: LancamentoEvento[]
  removidos: LancamentoEvento[]
  colunas: ColunaEncontrada[]
  colaboradores: { aba: string; matricula: string; nome: string; notas: string[] }[]
  /** Matriculas que aparecem em mais de uma aba. */
  repetidas: { matricula: string; nome: string; abas: string[] }[]
}

function formatarData(data: string): string {
  const [ano, mes, dia] = data.split('-')

  return `${dia}/${mes}/${ano}`
}

function formatarNumero(numero: number): string {
  return numero.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}

export function valorOriginal(valor: ValorEvento): string {
  switch (valor.tipo) {
    case 'numero':
      return formatarNumero(valor.numero)
    case 'tempo':
      return formatarDuracao(valor.minutos)
    case 'data':
      return formatarData(valor.data)
    case 'texto':
      return valor.texto
  }
}

/** Datas citadas num texto ("19 a 30/10", "25/09 - 13/10"): cada uma conta como um dia de falta. */
function contarDatas(texto: string): number {
  return (texto.match(/\b\d{1,2}(?:\/\d{1,2}(?:\/\d{2,4})?)?\b/g) ?? []).length
}

interface Conversao {
  quantidade: number | null
  nota?: string
  revisar?: boolean
}

/** Converte o valor da celula para a quantidade da rubrica. Quantidade 0 = nada a lancar. */
export function converter(valor: ValorEvento, rubrica: RubricaEvento): Conversao {
  const unidade = rubrica.unidade

  if (valor.tipo === 'numero') {
    return { quantidade: Math.round(valor.numero * 100) / 100 }
  }

  if (valor.tipo === 'tempo') {
    if (valor.minutos === 0) return { quantidade: 0 }
    if (unidade === 'horas') return { quantidade: minutosParaHorasMinutos(valor.minutos), nota: `${formatarDuracao(valor.minutos)} → horas.minutos` }

    return { quantidade: null, revisar: true, nota: `Tempo (${formatarDuracao(valor.minutos)}) numa coluna de ${unidade === 'dias' ? 'dias' : 'valor'}.` }
  }

  if (valor.tipo === 'data') {
    if (unidade === 'dias') return { quantidade: 1, nota: `Data da falta (${formatarData(valor.data)}) = 1 dia` }

    return { quantidade: null, revisar: true, nota: `Data (${formatarData(valor.data)}) numa coluna de ${unidade === 'horas' ? 'horas' : 'valor'}.` }
  }

  if (unidade === 'dias') {
    const dias = contarDatas(valor.texto)

    return dias
      ? { quantidade: dias, revisar: true, nota: `Texto na célula: sugestão de ${dias} ${dias === 1 ? 'dia' : 'dias'} (uma por data citada).` }
      : { quantidade: null, revisar: true, nota: 'Texto na célula: informe a quantidade de dias.' }
  }

  return { quantidade: null, revisar: true, nota: 'Texto na célula: informe o valor.' }
}

export function montarEventos(resumo: ResumoEventos, config: ConfigEventos, edicoes: EdicoesEventos): ResultadoEventos {
  const colunas = new Map<string, ColunaEncontrada>()
  const lancamentos: LancamentoEvento[] = []
  const removidos: LancamentoEvento[] = []
  const colaboradores: ResultadoEventos['colaboradores'] = []
  const abasPorMatricula = new Map<string, { nome: string; abas: string[] }>()
  const ordem = new Map(config.rubricas.map((rubrica, indice) => [rubrica.id, indice]))

  for (const aba of resumo.abas) {
    for (const coluna of aba.colunas) {
      const existente = colunas.get(coluna.chave)
      const preenchidas = aba.colaboradores.filter((colaborador) => colaborador.valores[coluna.chave]).length

      if (existente) {
        if (!existente.abas.includes(aba.nome)) existente.abas.push(aba.nome)
        existente.preenchidas += preenchidas
      } else {
        colunas.set(coluna.chave, { chave: coluna.chave, cabecalho: coluna.cabecalho, destino: destinoDaColuna(coluna.chave, config), abas: [aba.nome], preenchidas })
      }
    }

    for (const colaborador of aba.colaboradores) {
      colaboradores.push({ aba: aba.nome, matricula: colaborador.matricula, nome: colaborador.nome, notas: colaborador.notas })

      const registro = abasPorMatricula.get(colaborador.matricula) ?? { nome: colaborador.nome, abas: [] }

      if (!registro.abas.includes(aba.nome)) registro.abas.push(aba.nome)
      abasPorMatricula.set(colaborador.matricula, registro)

      const daLinha: LancamentoEvento[] = []

      for (const [chave, valor] of Object.entries(colaborador.valores)) {
        const destino = colunas.get(chave)?.destino

        if (destino?.tipo !== 'rubrica' || config.desligadas.includes(destino.rubrica.id)) continue

        const conversao = converter(valor, destino.rubrica)

        if (conversao.quantidade === 0) continue

        const id = `${aba.nome}|${colaborador.linha}|${chave}`
        const editada = id in edicoes.quantidades
        const quantidade = editada ? edicoes.quantidades[id]! : conversao.quantidade
        const lancamento: LancamentoEvento = {
          id,
          aba: aba.nome,
          matricula: colaborador.matricula,
          nome: colaborador.nome,
          rubrica: destino.rubrica,
          quantidade,
          original: valorOriginal(valor),
          ...(conversao.nota ? { nota: conversao.nota } : {}),
          revisar: Boolean(conversao.revisar) && !editada,
          editado: editada && quantidade !== conversao.quantidade,
          manual: false,
        }

        if (editada && quantidade === null) removidos.push(lancamento)
        else daLinha.push(lancamento)
      }

      daLinha.sort((a, b) => (ordem.get(a.rubrica.id) ?? 99) - (ordem.get(b.rubrica.id) ?? 99))
      lancamentos.push(...daLinha)
    }
  }

  for (const manual of edicoes.manuais) {
    const rubrica = config.rubricas.find((item) => item.id === manual.rubricaId)

    if (!rubrica) continue

    lancamentos.push({
      id: manual.id,
      aba: 'Incluído',
      matricula: manual.matricula,
      nome: manual.nome,
      rubrica,
      quantidade: manual.quantidade,
      original: '—',
      revisar: false,
      editado: false,
      manual: true,
    })
  }

  return {
    lancamentos,
    removidos,
    colunas: [...colunas.values()],
    colaboradores,
    repetidas: [...abasPorMatricula]
      .filter(([, registro]) => registro.abas.length > 1)
      .map(([matricula, registro]) => ({ matricula, nome: registro.nome, abas: registro.abas })),
  }
}

/** Linhas prontas para a planilha de lancamentos (so as com quantidade > 0). */
export function paraPlanilha(lancamentos: readonly LancamentoEvento[]): LinhaLancamento[] {
  return lancamentos
    .filter((lancamento) => lancamento.quantidade !== null && lancamento.quantidade > 0)
    .map((lancamento) => ({
      nome: lancamento.nome,
      matricula: lancamento.matricula,
      rubrica: lancamento.rubrica.codigo,
      descricao: lancamento.rubrica.descricao,
      quantidade: lancamento.quantidade!,
    }))
}

/**
 * Quantidade digitada na tela: "2,20" ou "2:20" (horas.minutos), "700" ou "383,34" (valor), "2" (dias).
 * Devolve null quando vazio e NaN quando invalido.
 */
export function lerQuantidade(texto: string, unidade: RubricaEvento['unidade']): number | null {
  const limpo = texto.trim()

  if (!limpo) return null

  const tempo = /^(\d{1,3}):([0-5]?\d)$/.exec(limpo)

  if (tempo) return unidade === 'horas' ? minutosParaHorasMinutos(Number(tempo[1]) * 60 + Number(tempo[2])) : Number.NaN

  const normal = limpo.replace(/^r\$\s*/i, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')

  if (!/^\d+(\.\d{1,2})?$/.test(normal)) return Number.NaN

  const numero = Number(normal)

  // Horas no formato horas.minutos: os minutos vao ate 59.
  if (unidade === 'horas' && Math.round((numero % 1) * 100) >= 60) return Number.NaN

  return numero
}

/** 2.2 -> "2,20"; 700 -> "700,00" */
export function formatarQuantidade(quantidade: number): string {
  return quantidade.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
