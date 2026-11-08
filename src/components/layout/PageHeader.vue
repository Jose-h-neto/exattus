<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, type RouteLocationRaw } from 'vue-router'

import { localizarItem, rotaDoMenu } from '@/app/navegacao'
import UiIcon from '@/components/ui/UiIcon.vue'
import UiInfo from '@/components/ui/UiInfo.vue'

/**
 * titulo e trilha: paginas internas de um modulo (ex.: uma pasta do cofre)
 * trocam o titulo e acrescentam etapas a trilha depois do item do menu.
 */
const props = defineProps<{
  titulo?: string
  trilha?: { rotulo: string; para?: RouteLocationRaw }[]
}>()

const route = useRoute()

const local = computed(() => localizarItem(rotaDoMenu(route)))

const interna = computed(() => Boolean(props.trilha?.length))
</script>

<template>
  <header
    v-if="local"
    class="mb-6 flex flex-col gap-4 border-b border-line pb-5 md:flex-row md:items-end md:justify-between"
  >
    <div class="min-w-0">
      <!-- Trilha direto sobre o degrade (sem vidro): texto em ink para manter 4,5:1 sobre o brilho do fundo. -->
      <nav aria-label="Trilha" class="mb-1.5 flex min-w-0 items-center gap-1 text-xs text-ink-2">
        <span class="shrink-0">{{ local.grupo.titulo }}</span>
        <UiIcon nome="seta" :tamanho="13" class="shrink-0 text-muted" />
        <RouterLink
          v-if="interna"
          :to="{ name: local.item.rota }"
          class="shrink-0 rounded-xs hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary"
        >
          {{ local.item.rotulo }}
        </RouterLink>
        <span v-else aria-current="page" class="font-semibold">{{ local.item.rotulo }}</span>
        <template v-for="(etapa, indice) in trilha" :key="indice">
          <UiIcon nome="seta" :tamanho="13" class="shrink-0 text-muted" />
          <RouterLink
            v-if="etapa.para && indice < (trilha?.length ?? 0) - 1"
            :to="etapa.para"
            class="min-w-0 truncate rounded-xs hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary"
          >
            {{ etapa.rotulo }}
          </RouterLink>
          <span v-else :aria-current="indice === (trilha?.length ?? 0) - 1 ? 'page' : undefined" class="min-w-0 truncate font-semibold">
            {{ etapa.rotulo }}
          </span>
        </template>
      </nav>
      <div class="flex items-center gap-2">
        <h1 class="min-w-0 truncate text-2xl leading-8 font-bold tracking-[-0.015em] text-ink">{{ titulo ?? local.item.rotulo }}</h1>
        <UiInfo v-if="!interna" :texto="local.item.descricao" :rotulo="`Sobre ${local.item.rotulo}`" />
        <slot name="titulo" />
      </div>
      <p v-if="$slots.subtitulo" class="mt-1 text-sm text-muted"><slot name="subtitulo" /></p>
    </div>

    <div v-if="$slots.acoes" class="flex shrink-0 flex-wrap items-center gap-2">
      <slot name="acoes" />
    </div>
  </header>
</template>
