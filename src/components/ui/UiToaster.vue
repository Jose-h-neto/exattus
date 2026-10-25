<script setup lang="ts">
import { useAvisos } from '@/stores/avisos'
import UiIcon from './UiIcon.vue'

const { avisos, fechar } = useAvisos()

const icones = { sucesso: 'sucesso', info: 'info', erro: 'alerta' } as const
const cores = { sucesso: 'text-success', info: 'text-info', erro: 'text-danger' }
</script>

<template>
  <div
    aria-live="polite"
    class="pointer-events-none fixed right-4 bottom-4 left-4 z-60 flex flex-col items-end gap-2 sm:left-auto"
  >
    <TransitionGroup
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="translate-y-2 opacity-0"
      leave-active-class="transition duration-150 ease-out"
      leave-to-class="opacity-0"
    >
      <div
        v-for="aviso in avisos"
        :key="aviso.id"
        class="pointer-events-auto flex w-full items-center gap-3 vidro vidro--flutuante rounded-md px-4 py-3 text-sm font-semibold text-ink sm:w-auto sm:min-w-72"
      >
        <UiIcon :nome="icones[aviso.tom]" :class="cores[aviso.tom]" :tamanho="20" />
        <span class="flex-1">{{ aviso.mensagem }}</span>
        <button
          type="button"
          class="grid size-7 place-items-center rounded-sm text-ink-muted hover:bg-hover hover:text-ink focus-visible:focus-ring"
          @click="fechar(aviso.id)"
        >
          <span class="ex-sr">Fechar aviso</span>
          <UiIcon nome="fechar" :tamanho="16" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>
