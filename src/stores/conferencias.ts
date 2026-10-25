import { computed, ref, watch } from 'vue'

import { gravarJson, lerJson } from '@/lib/armazenamento'

const CHAVE = 'exattus:conferencias'

export type TipoConferencia = 'folha' | 'ferias' | 'rescisao'

export interface ResumoConferencia {
  /** Texto curto com o contexto do calculo (dias, modalidade, periodo). */
  detalhe: string
  bruto: number
  inss: number
  irrf: number
  liquido: number
  inssInformado: number | null
  diferencaInss: number | null
  /** Rescisao: quantidade de itens divergentes da folha (null = folha nao informada). */
  divergencias?: number | null
}

export interface Conferencia {
  id: string
  tipo: TipoConferencia
  referencia: string
  salvoEm: string
  /** Copia dos campos do formulario, para reabrir o calculo. */
  formulario: Record<string, unknown>
  resumo: ResumoConferencia
}

function ehListaDeConferencias(valor: unknown): valor is Conferencia[] {
  return (
    Array.isArray(valor) &&
    valor.every(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        typeof item.id === 'string' &&
        (item.tipo === 'folha' || item.tipo === 'ferias' || item.tipo === 'rescisao') &&
        typeof item.resumo === 'object' &&
        typeof item.formulario === 'object',
    )
  )
}

const conferencias = ref<Conferencia[]>(lerJson(CHAVE, ehListaDeConferencias) ?? [])

watch(conferencias, (lista) => gravarJson(CHAVE, lista), { deep: true })

function novoId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function useConferencias() {
  return {
    conferencias,
    total: computed(() => conferencias.value.length),

    salvar(dados: Omit<Conferencia, 'id' | 'salvoEm'>): Conferencia {
      const conferencia: Conferencia = {
        ...dados,
        id: novoId(),
        salvoEm: new Date().toISOString(),
      }

      conferencias.value = [conferencia, ...conferencias.value]

      return conferencia
    },

    obter(id: string): Conferencia | undefined {
      return conferencias.value.find((item) => item.id === id)
    },

    excluir(id: string) {
      conferencias.value = conferencias.value.filter((item) => item.id !== id)
    },

    limpar() {
      conferencias.value = []
    },
  }
}
