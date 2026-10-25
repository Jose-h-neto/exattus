<script setup lang="ts">
import { computed, ref } from 'vue'

import UiBadge from '@/components/ui/UiBadge.vue'
import UiEmptyState from '@/components/ui/UiEmptyState.vue'
import UiIcon from '@/components/ui/UiIcon.vue'

import { formatarMoeda } from '@/domain/dinheiro'
import type { ItemConferencia, SituacaoConferencia } from '@/domain/rescisao/conferencia'
import { RUBRICAS } from '@/domain/rescisao/rubricas'
import { useParametrosRescisao } from '@/stores/rescisao'
import { conferenciaRescisao, folhaInformada } from '@/features/rescisaoEstado'

const emit = defineEmits<{ irParaFolha: [] }>()

const { parametros } = useParametrosRescisao()

type Filtro = 'divergente' | 'confere' | 'todos'

const filtro = ref<Filtro>('divergente')
const aberto = ref<string | null>(null)

const resumo = computed(() => conferenciaRescisao.value)

const informados = computed(() => (resumo.value?.itens ?? []).filter((item) => item.situacao !== 'nao_informado'))

const visiveis = computed(() => {
  const lista = filtro.value === 'todos' ? informados.value : informados.value.filter((item) => item.situacao === filtro.value)

  return [...lista].sort((a, b) => Math.abs(b.diferenca ?? 0) - Math.abs(a.diferenca ?? 0))
})

const filtros = computed(() => [
  { valor: 'divergente' as const, rotulo: 'Divergentes', total: resumo.value?.divergentes ?? 0 },
  { valor: 'confere' as const, rotulo: 'Conferem', total: resumo.value?.conferidos ?? 0 },
  { valor: 'todos' as const, rotulo: 'Todos informados', total: informados.value.length },
])

const SITUACOES: Record<SituacaoConferencia, { texto: string; tom: 'sucesso' | 'perigo' | 'neutro' }> = {
  confere: { texto: 'Confere', tom: 'sucesso' },
  divergente: { texto: 'Divergente', tom: 'perigo' },
  nao_informado: { texto: 'Não informado', tom: 'neutro' },
}

/** Pistas objetivas sobre a origem provavel da divergencia. */
function pistas(item: ItemConferencia): string[] {
  const lista: string[] = []

  if (item.naoDevida && item.informado) {
    lista.push('A folha pagou ou descontou uma verba que não é devida para os dados e a modalidade informados.')
  }

  if (!item.naoDevida && item.informado === 0 && item.calculado > 0) {
    lista.push('A folha não pagou uma verba devida.')
  }

  const definicao = RUBRICAS.find((rubrica) => rubrica.codigo === item.chave)

  if (definicao) {
    const incidencia = parametros.value.incidencias[definicao.codigo]
    const texto = (ativa: boolean) => (ativa ? 'incide' : 'não incide')

    lista.push(
      `Parâmetro de incidência: INSS ${texto(incidencia.inss)}, IRRF ${texto(incidencia.irrf)}, FGTS ${texto(incidencia.fgts)}.` +
        (definicao.validar ? ' Incidência sujeita a validação.' : ''),
    )
  }

  if (item.chave.startsWith('inss') || item.chave.startsWith('irrf') || item.chave.startsWith('base_')) {
    lista.push('Divergências em tributos costumam vir de incidências diferentes ou de pagamentos anteriores no mês não informados.')
  }

  return lista
}
</script>

<template>
  <div class="space-y-6">
    <div v-if="!folhaInformada" class="vidro vidro--tracejado rounded-lg">
      <UiEmptyState icone="arquivo" titulo="Nenhum valor da folha informado">
        <button
          type="button"
          class="inline-flex h-9 items-center rounded-md bg-primary px-3.5 text-sm font-medium text-on-primary hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          @click="emit('irParaFolha')"
        >
          Informar valores da folha
        </button>
      </UiEmptyState>
    </div>

    <template v-else-if="resumo">
      <div class="@container">
        <dl class="grid grid-cols-2 overflow-hidden vidro rounded-lg @xl:grid-cols-4">
          <div class="px-4 py-3">
            <dt class="text-xs text-muted">Conferem</dt>
            <dd class="num text-xl font-semibold text-positive">{{ resumo.conferidos }}</dd>
          </div>
          <div class="border-l border-line px-4 py-3" :class="resumo.divergentes > 0 && 'bg-negative-soft'">
            <dt class="text-xs text-muted">Divergentes</dt>
            <dd class="num text-xl font-semibold" :class="resumo.divergentes ? 'text-negative' : 'text-ink'">{{ resumo.divergentes }}</dd>
          </div>
          <div class="border-t border-line px-4 py-3 @xl:border-t-0 @xl:border-l">
            <dt class="text-xs text-muted">Devidas e não informadas</dt>
            <dd class="num text-xl font-semibold text-ink">{{ resumo.naoInformados }}</dd>
          </div>
          <div class="border-t border-l border-line px-4 py-3 @xl:border-t-0">
            <dt class="text-xs text-muted">Diferença no líquido</dt>
            <dd
              class="num text-xl font-semibold"
              :class="resumo.diferencaLiquido ? 'text-warning' : resumo.diferencaLiquido === 0 ? 'text-positive' : 'text-muted'"
            >
              {{ resumo.diferencaLiquido === null ? '—' : `${resumo.diferencaLiquido > 0 ? '+' : ''}${formatarMoeda(resumo.diferencaLiquido)}` }}
            </dd>
          </div>
        </dl>
      </div>

      <section class="vidro rounded-lg" aria-labelledby="titulo-divergencias">
        <header class="flex flex-col gap-3 border-b border-line px-5 py-3 md:flex-row md:items-center md:justify-between">
          <h2 id="titulo-divergencias" class="text-base font-bold text-ink">Relatório de conferência</h2>
          <div role="radiogroup" aria-label="Filtrar itens" class="flex gap-1 overflow-x-auto">
            <button
              v-for="opcao in filtros"
              :key="opcao.valor"
              type="button"
              role="radio"
              :aria-checked="filtro === opcao.valor"
              class="inline-flex h-8 items-center gap-2 rounded-md px-3 text-[13px] font-medium whitespace-nowrap focus-visible:outline-2 focus-visible:outline-primary"
              :class="filtro === opcao.valor ? 'bg-primary-soft text-primary' : 'text-muted hover:bg-subtle hover:text-ink'"
              @click="filtro = opcao.valor"
            >
              {{ opcao.rotulo }}
              <span class="num text-[11px] opacity-75">{{ opcao.total }}</span>
            </button>
          </div>
        </header>

        <div class="overflow-x-auto">
          <table class="tabela min-w-[680px]">
            <thead>
              <tr>
                <th scope="col" class="pl-5">Item</th>
                <th scope="col">Situação</th>
                <th scope="col" class="num">Calculado</th>
                <th scope="col" class="num">Folha</th>
                <th scope="col" class="num pr-5">Diferença</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="item in visiveis" :key="item.chave">
                <tr class="hover:bg-subtle/50">
                  <td class="pl-5">
                    <button
                      type="button"
                      class="-ml-1 flex items-center gap-1.5 rounded px-1 text-left font-medium text-ink focus-visible:outline-2 focus-visible:outline-primary"
                      :aria-expanded="aberto === item.chave"
                      @click="aberto = aberto === item.chave ? null : item.chave"
                    >
                      <UiIcon nome="seta" :tamanho="14" class="text-muted transition-transform" :class="aberto === item.chave && 'rotate-90'" />
                      {{ item.descricao }}
                    </button>
                  </td>
                  <td><UiBadge :tom="SITUACOES[item.situacao].tom">{{ SITUACOES[item.situacao].texto }}</UiBadge></td>
                  <td class="num">{{ formatarMoeda(item.calculado) }}</td>
                  <td class="num">{{ item.informado === null ? '—' : formatarMoeda(item.informado) }}</td>
                  <td class="num pr-5" :class="item.situacao === 'divergente' ? 'font-semibold text-negative' : 'text-positive'">
                    {{ item.diferenca === null ? '—' : `${item.diferenca > 0 ? '+' : ''}${formatarMoeda(item.diferenca)}` }}
                  </td>
                </tr>
                <tr v-if="aberto === item.chave">
                  <td colspan="5" class="!border-t-0 bg-subtle/50 !py-3 pr-5 pl-12 text-xs">
                    <p class="mb-1 font-medium text-ink-2">Memória do cálculo</p>
                    <ol class="list-decimal space-y-0.5 pl-4 text-ink-2 marker:text-muted">
                      <li v-for="(linha, indice) in item.memoria" :key="indice" class="num">{{ linha }}</li>
                    </ol>
                    <template v-if="pistas(item).length">
                      <p class="mt-2 mb-1 font-medium text-ink-2">Pontos a verificar</p>
                      <ul class="list-disc space-y-0.5 pl-4 text-ink-2">
                        <li v-for="pista in pistas(item)" :key="pista">{{ pista }}</li>
                      </ul>
                    </template>
                  </td>
                </tr>
              </template>
              <tr v-if="!visiveis.length">
                <td colspan="5" class="py-10 text-center text-muted">
                  {{ filtro === 'divergente' ? 'Nenhuma divergência entre os itens informados.' : 'Nenhum item neste filtro.' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>
