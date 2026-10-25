<script setup lang="ts">
import { computed, useAttrs } from 'vue'

/** Campo de texto do design system (ex-control / ex-input), com prefixo e sufixo. */
defineOptions({ inheritAttrs: false })

const modelo = defineModel<string>({ default: '' })

defineProps<{
  prefixo?: string
  sufixo?: string
  invalido?: boolean
  alinhamento?: 'esquerda' | 'direita'
  /** JetBrains Mono, para identificadores (CPF, matricula). */
  mono?: boolean
}>()

const attrs = useAttrs()
const desabilitado = computed(() => attrs.disabled !== undefined && attrs.disabled !== false)

function atualizar(evento: Event) {
  modelo.value = (evento.target as HTMLInputElement).value
}

/* Esc desfaz a edicao: volta ao valor que o campo tinha ao receber o foco. */
let valorAoFocar = ''

function aoFocar() {
  valorAoFocar = modelo.value
}

function aoTeclar(evento: KeyboardEvent) {
  if (evento.key === 'Escape' && modelo.value !== valorAoFocar) {
    evento.preventDefault()
    evento.stopPropagation()
    modelo.value = valorAoFocar
  }
}
</script>

<template>
  <div :class="['ex-control', { 'ex-control--error': invalido, 'ex-control--disabled': desabilitado }]">
    <span v-if="prefixo" class="ex-control__prefix" aria-hidden="true">{{ prefixo }}</span>
    <input
      v-bind="$attrs"
      :value="modelo"
      :aria-invalid="invalido || undefined"
      :class="['ex-input ex-num', { 'ex-input--mono': mono, 'text-right': alinhamento === 'direita' }]"
      @input="atualizar"
      @focus="aoFocar"
      @keydown="aoTeclar"
    />
    <span v-if="sufixo" class="ex-control__prefix pr-3 pl-0" aria-hidden="true">{{ sufixo }}</span>
  </div>
</template>
