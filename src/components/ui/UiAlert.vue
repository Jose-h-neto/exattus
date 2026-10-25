<script setup lang="ts">
import ExAlert from '@/components/exattus/ExAlert.vue'

withDefaults(defineProps<{ tom?: 'info' | 'atencao' | 'perigo' | 'sucesso'; titulo?: string }>(), { tom: 'info' })

const TONS = { info: 'info', atencao: 'warning', perigo: 'danger', sucesso: 'success' } as const
</script>

<template>
  <ExAlert :tone="TONS[tom]" :title="titulo">
    <template v-if="$slots.default" #default><slot /></template>
    <template v-if="$slots.acao" #action><slot name="acao" /></template>
  </ExAlert>
</template>
