<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

import { formatarMoeda } from '@/domain/dinheiro'
import UiIcon from '@/components/ui/UiIcon.vue'

/**
 * Em telas sem duas colunas, mantem o valor liquido visivel enquanto o
 * formulario e preenchido; some quando o resultado entra na tela.
 */
const props = defineProps<{ alvo: string; liquido: number }>()

const resultadoVisivel = ref(false)
let observador: IntersectionObserver | null = null

onMounted(() => {
  const elemento = document.getElementById(props.alvo)

  if (!elemento || typeof IntersectionObserver === 'undefined') return

  observador = new IntersectionObserver(([entrada]) => {
    resultadoVisivel.value = Boolean(entrada?.isIntersecting)
  })
  observador.observe(elemento)
})

onBeforeUnmount(() => observador?.disconnect())

function irParaResultado() {
  document.getElementById(props.alvo)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>

<template>
  <Transition enter-from-class="translate-y-full" leave-to-class="translate-y-full">
    <div
      v-if="!resultadoVisivel"
      style="background: var(--vidro-fundo-forte); backdrop-filter: var(--vidro-desfoque); -webkit-backdrop-filter: var(--vidro-desfoque)"
      class="fixed inset-x-0 bottom-0 z-20 flex items-center justify-between gap-4 border-t border-(--vidro-contorno) px-4 py-2.5 transition-transform sm:px-6 lg:hidden"
    >
      <div class="leading-tight">
        <p class="text-xs text-muted">Valor líquido</p>
        <p class="num text-lg font-semibold text-primary">{{ formatarMoeda(liquido) }}</p>
      </div>
      <button
        type="button"
        class="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3.5 text-sm font-medium text-on-primary hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        @click="irParaResultado"
      >
        Ver demonstrativo
        <UiIcon nome="seta" :tamanho="16" class="rotate-90" />
      </button>
    </div>
  </Transition>
</template>
