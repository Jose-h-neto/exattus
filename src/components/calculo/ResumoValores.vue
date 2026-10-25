<script setup lang="ts">
import { formatarMoeda } from '@/domain/dinheiro'

export interface ItemResumo {
  rotulo: string
  valor: number
  sinal?: '+' | '-'
  destaque?: boolean
}

defineProps<{ itens: ItemResumo[] }>()
</script>

<template>
  <!-- Container query: o layout acompanha a largura da coluna, nao da tela. -->
  <div class="@container">
    <dl class="grid grid-cols-2 overflow-hidden vidro rounded-lg @xl:grid-cols-4">
      <div
        v-for="(item, indice) in itens"
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
      </div>
    </dl>
  </div>
</template>
