<script setup lang="ts">
import { formatarDecimal, paraCentavos } from '@/domain/dinheiro'
import UiInput from './UiInput.vue'

defineOptions({ inheritAttrs: false })

const modelo = defineModel<string>({ default: '' })

withDefaults(defineProps<{ invalido?: boolean; sufixo?: string; prefixo?: string }>(), {
  prefixo: 'R$',
})

/** Ao sair do campo, padroniza "5500" para "5.500,00". */
function padronizar() {
  const centavos = paraCentavos(modelo.value)

  if (centavos !== null && Number.isSafeInteger(centavos)) {
    modelo.value = formatarDecimal(centavos)
  }
}

/** Setas ajustam o valor: 1,00 por toque; com Shift, 100,00. Nunca abaixo de zero. */
function ajustar(evento: KeyboardEvent) {
  if ((evento.key !== 'ArrowUp' && evento.key !== 'ArrowDown') || evento.altKey || evento.ctrlKey) return

  const atual = paraCentavos(modelo.value) ?? 0

  if (Number.isNaN(atual)) return

  evento.preventDefault()

  const passo = (evento.shiftKey ? 10000 : 100) * (evento.key === 'ArrowUp' ? 1 : -1)

  modelo.value = formatarDecimal(Math.max(atual + passo, 0))
}
</script>

<template>
  <UiInput
    v-model="modelo"
    v-bind="$attrs"
    :prefixo="sufixo ? undefined : prefixo"
    :sufixo="sufixo"
    :invalido="invalido"
    type="text"
    inputmode="decimal"
    autocomplete="off"
    alinhamento="direita"
    @blur="padronizar"
    @keydown="ajustar"
  />
</template>
