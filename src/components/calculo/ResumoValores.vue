<script setup lang="ts">
import { computed } from 'vue'

import { formatarMoeda } from '@/domain/dinheiro'

/**
 * positivo: entrada (proventos, bruto) em verde; negativo: desconto em vermelho
 * (tambem quando sinal = '-'); encargo: valor do empregador (FGTS), informativo.
 */
export type TomResumo = 'positivo' | 'negativo' | 'encargo' | 'neutro'

export interface ItemResumo {
  rotulo: string
  valor: number
  sinal?: '+' | '-'
  /** O valor principal (liquido): maior e em verde; vermelho se negativo. */
  destaque?: boolean
  tom?: TomResumo
  /** Linha curta junto do rotulo (ex.: "Não desconta do líquido"). */
  nota?: string
}

const props = defineProps<{ itens: ItemResumo[] }>()

/*
 * Hierarquia: o liquido e o numero principal (maior); proventos e descontos sao
 * medios; um 5o item (ex.: FGTS) vira uma faixa abaixo, menor e informativa.
 */
const principais = computed(() => props.itens.slice(0, 4))
const faixa = computed(() => props.itens[4] ?? null)

function tomDe(item: ItemResumo): TomResumo {
  return item.tom ?? (item.sinal === '-' ? 'negativo' : 'neutro')
}

const COR: Record<TomResumo, string> = {
  positivo: 'text-(--cor-provento)',
  negativo: 'text-(--cor-desconto)',
  encargo: 'text-(--cor-encargo)',
  neutro: 'text-ink',
}

function corDoValor(item: ItemResumo): string {
  if (item.destaque) return item.valor < 0 ? 'text-(--cor-desconto)' : 'text-(--cor-liquido)'

  return COR[tomDe(item)]
}
</script>

<template>
  <!-- Container query: o layout acompanha a largura da coluna, nao da tela. -->
  <div class="@container">
    <dl class="grid grid-cols-2 overflow-hidden vidro rounded-lg @xl:grid-cols-4">
      <div
        v-for="(item, indice) in principais"
        :key="item.rotulo"
        class="flex min-w-0 flex-col justify-center gap-0.5 px-4 py-3"
        :class="[
          indice % 2 === 1 && 'border-l border-line',
          indice >= 2 && 'border-t border-line @xl:border-t-0',
          indice === 2 && '@xl:border-l',
          item.destaque && (item.valor < 0 ? 'bg-negative-soft' : 'bg-(--cor-liquido-fundo)'),
        ]"
      >
        <dt class="text-xs" :class="item.destaque ? 'font-semibold text-ink' : 'text-muted'">{{ item.rotulo }}</dt>
        <dd
          class="num truncate font-semibold tracking-tight"
          :class="[item.destaque ? 'text-[22px] leading-7 font-bold @3xl:text-2xl' : 'text-base @3xl:text-lg', corDoValor(item)]"
        >
          <span v-if="item.sinal === '-'" class="mr-0.5 font-normal opacity-70">−</span>{{ formatarMoeda(item.valor) }}
        </dd>
        <dd v-if="item.nota" class="text-[11px] leading-tight text-muted">{{ item.nota }}</dd>
      </div>

      <div
        v-if="faixa"
        class="col-span-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5 border-t border-line bg-info-soft/50 px-4 py-2 @xl:col-span-4"
      >
        <dt class="min-w-0 text-xs">
          <span class="font-medium text-ink-2">{{ faixa.rotulo }}</span>
          <span v-if="faixa.nota" class="ml-1.5 text-muted">· {{ faixa.nota }}</span>
        </dt>
        <dd class="num text-sm font-semibold" :class="COR[faixa.tom ?? 'encargo']">{{ formatarMoeda(faixa.valor) }}</dd>
      </div>
    </dl>
  </div>
</template>
