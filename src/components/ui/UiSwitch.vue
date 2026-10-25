<script setup lang="ts">
import ExSwitch from '@/components/exattus/ExSwitch.vue'

/** Switch do design system (Headless UI). Emite `change` apos cada alteracao. */
const modelo = defineModel<boolean>({ default: false })

defineProps<{ id?: string; rotulo: string; descricao?: string; disabled?: boolean }>()

const emit = defineEmits<{ change: [valor: boolean] }>()

function atualizar(valor: boolean) {
  modelo.value = valor
  emit('change', valor)
}
</script>

<template>
  <ExSwitch :model-value="modelo" :label="rotulo" :description="descricao" :disabled="disabled" @update:model-value="atualizar" />
</template>
