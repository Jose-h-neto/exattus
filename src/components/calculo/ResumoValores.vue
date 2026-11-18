<script setup lang="ts">
import { computed } from 'vue'

import { formatarMoeda } from '@/domain/dinheiro'

export interface ItemResumo {
  rotulo: string
  valor: number
  sinal?: '+' | '-'
  destaque?: boolean
  /** Linha curta junto do rotulo (ex.: "Não desconta do líquido"). */
  nota?: string
}

const props = defineProps<{ itens: ItemResumo[] }>()

/* Ate 4 cards lado a lado; um 5o item (ex.: FGTS) vira uma faixa abaixo, com o mesmo peso do valor. */
const principais = computed(() => props.itens.slice(0, 4))
const faixa = computed(() => props.itens[4] ?? null)
</script>

<template>
  <!-- Container query: o layout acompanha a largura da coluna, nao da tela. -->
  <div class="@container">
    <dl class="grid grid-cols-2 overflow-hidden vidro rounded-lg @xl:grid-cols-4">
      <div
        v-for="(item, indice) in principais"
        :key="item.rotulo"
        class="flex min-w-0 flex-col gap-1 px-4 py-3"
        :class="[
          indice % 2 === 1 && 'border-l border-line',
          indice >= 2 && 'border-t border-line @xl:border-t-0',
          indice === 2 && '@xl:border-l',
          item.destaque && 'bg-primary-soft/70',
        ]"
      >
        <dt class="text-xs text-muted">{{ item.rotulo }}</dt>
        <dd
          class="num truncate text-lg font-semibold tracking-tight @3xl:text-xl"
          :class="item.destaque ? 'text-primary' : 'text-ink'"
        >
          <span v-if="item.sinal === '-'" class="mr-0.5 font-normal text-muted">−</span>{{ formatarMoeda(item.valor) }}
        </dd>
        <dd v-if="item.nota" class="text-[11px] leading-tight text-muted">{{ item.nota }}</dd>
      </div>

      <div
        v-if="faixa"
        class="col-span-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-line bg-info-soft/60 px-4 py-2.5 @xl:col-span-4"
      >
        <dt class="min-w-0">
          <span class="block text-xs font-medium text-ink-2">{{ faixa.rotulo }}</span>
          <span v-if="faixa.nota" class="block text-[11px] leading-tight text-muted">{{ faixa.nota }}</span>
        </dt>
        <dd class="num text-lg font-semibold tracking-tight text-ink @3xl:text-xl">{{ formatarMoeda(faixa.valor) }}</dd>
      </div>
    </dl>
  </div>
</template>
