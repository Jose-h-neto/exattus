<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { localizarItem } from '@/app/navegacao'
import UiIcon from '@/components/ui/UiIcon.vue'
import UiInfo from '@/components/ui/UiInfo.vue'

const route = useRoute()

const local = computed(() => localizarItem(String(route.name ?? '')))
</script>

<template>
  <header
    v-if="local"
    class="mb-6 flex flex-col gap-4 border-b border-line pb-5 md:flex-row md:items-end md:justify-between"
  >
    <div class="min-w-0">
      <!-- Trilha direto sobre o degrade (sem vidro): texto em ink para manter 4,5:1 sobre o brilho do fundo. -->
      <nav aria-label="Trilha" class="mb-1.5 flex items-center gap-1 text-xs text-ink-2">
        <span>{{ local.grupo.titulo }}</span>
        <UiIcon nome="seta" :tamanho="13" class="text-muted" />
        <span aria-current="page" class="font-semibold">{{ local.item.rotulo }}</span>
      </nav>
      <div class="flex items-center gap-2">
        <h1 class="text-2xl leading-8 font-bold tracking-[-0.015em] text-ink">{{ local.item.rotulo }}</h1>
        <UiInfo :texto="local.item.descricao" :rotulo="`Sobre ${local.item.rotulo}`" />
      </div>
    </div>

    <div v-if="$slots.acoes" class="flex shrink-0 flex-wrap items-center gap-2">
      <slot name="acoes" />
    </div>
  </header>
</template>
