<script setup lang="ts">
import UiIcon, { type NomeIcone } from './UiIcon.vue'

defineProps<{ icone: NomeIcone; titulo: string; descricao?: string }>()
</script>

<template>
  <div class="flex flex-col items-center px-6 py-14 text-center">
    <span class="mb-4 grid size-12 place-items-center rounded-md bg-primary-soft text-primary">
      <UiIcon :nome="icone" :tamanho="20" />
    </span>
    <h2 class="text-base font-bold text-ink">{{ titulo }}</h2>
    <p v-if="descricao" class="mt-1 max-w-sm text-sm text-muted">{{ descricao }}</p>
    <div v-if="$slots.default" class="mt-4 w-full max-w-sm">
      <slot />
    </div>
  </div>
</template>
