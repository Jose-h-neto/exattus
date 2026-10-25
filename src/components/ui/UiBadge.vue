<script setup lang="ts">
import ExBadge from '@/components/exattus/ExBadge.vue'

withDefaults(defineProps<{ tom?: 'neutro' | 'marca' | 'sucesso' | 'atencao' | 'perigo' | 'info'; ponto?: boolean }>(), {
  tom: 'neutro',
})

const TONS = {
  neutro: 'neutral',
  marca: 'primary',
  sucesso: 'success',
  atencao: 'warning',
  perigo: 'danger',
  info: 'info',
} as const
</script>

<template>
  <ExBadge :tone="TONS[tom]" :dot="ponto"><slot /></ExBadge>
</template>
