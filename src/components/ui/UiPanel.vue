<script setup lang="ts">
import UiInfo from './UiInfo.vue'

/**
 * Cartao do design system (ex-card, sem padding interno): o conteudo vai de
 * borda a borda, como tabelas e listas.
 */
defineProps<{
  titulo?: string
  /** Explicacao do painel, exibida na dica do icone de informacao. */
  descricao?: string
  tag?: string
}>()
</script>

<template>
  <component :is="tag ?? 'section'" class="ex-card ex-card--flush min-w-0 overflow-hidden">
    <header v-if="titulo || $slots.acoes" class="ex-card__head flex-wrap !items-center">
      <div class="flex min-w-0 items-center gap-1.5">
        <h2 v-if="titulo" class="ex-card__title">{{ titulo }}</h2>
        <UiInfo v-if="descricao" :texto="descricao" :rotulo="`Sobre ${titulo}`" />
      </div>
      <div v-if="$slots.acoes" class="flex flex-wrap items-center gap-2">
        <slot name="acoes" />
      </div>
    </header>
    <slot />
  </component>
</template>
