<script setup lang="ts">
import UiIcon, { type NomeIcone } from './UiIcon.vue'

/** Botao do design system (classes ex-btn), com o vocabulario de variantes do app. */
withDefaults(
  defineProps<{
    variante?: 'primario' | 'secundario' | 'discreto' | 'perigo'
    tamanho?: 'sm' | 'md' | 'lg'
    tipo?: 'button' | 'submit'
    icone?: NomeIcone
    /** Botao apenas com icone: o texto do slot vira rotulo acessivel. */
    soIcone?: boolean
  }>(),
  { variante: 'secundario', tamanho: 'md', tipo: 'button' },
)

const VARIANTES = {
  primario: 'primary',
  secundario: 'secondary',
  discreto: 'ghost',
  perigo: 'danger',
} as const
</script>

<template>
  <button
    :type="tipo"
    :class="['ex-btn', `ex-btn--${VARIANTES[variante]}`, `ex-btn--${tamanho}`, { 'ex-btn--icon': soIcone }]"
  >
    <UiIcon v-if="icone" :nome="icone" :tamanho="tamanho === 'sm' ? 16 : 18" />
    <span v-if="soIcone" class="ex-sr"><slot /></span>
    <slot v-else />
  </button>
</template>
