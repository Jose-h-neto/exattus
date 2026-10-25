<script setup lang="ts">
import ExModal from '@/components/exattus/ExModal.vue'
import type { IconName } from '@/components/exattus/icons'

/**
 * Dialogo de confirmacao do design system (Headless UI Dialog: foco, Esc e
 * clique fora). Acoes com efeito irreversivel usam tom "perigo".
 */
defineProps<{
  aberto: boolean
  titulo: string
  descricao?: string
  tom?: 'padrao' | 'perigo'
  icone?: IconName
  /** "larga" para conteudo extenso (ex.: lista de atalhos em duas colunas). */
  largura?: 'padrao' | 'larga'
}>()

const emit = defineEmits<{ fechar: [] }>()

function atualizar(aberto: boolean) {
  if (!aberto) emit('fechar')
}
</script>

<template>
  <ExModal
    :open="aberto"
    :title="titulo"
    :description="descricao"
    :icon="icone ?? (tom === 'perigo' ? 'alert' : undefined)"
    :tone="tom === 'perigo' ? 'danger' : 'primary'"
    :class="largura === 'larga' && 'ex-modal--larga'"
    @update:open="atualizar"
  >
    <div v-if="$slots.default" class="mt-3 text-sm text-ink-muted"><slot /></div>
    <template v-if="$slots.acoes" #actions><slot name="acoes" /></template>
  </ExModal>
</template>
