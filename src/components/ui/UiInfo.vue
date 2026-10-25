<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref } from 'vue'
import UiIcon from './UiIcon.vue'

/**
 * Icone de informacao com dica flutuante (hover, foco ou toque).
 * A dica e posicionada em relacao a janela, sem ser cortada por containers.
 */
withDefaults(defineProps<{ texto: string; rotulo?: string }>(), { rotulo: 'Mais informações' })

const gatilho = ref<HTMLElement | null>(null)
const caixa = ref<HTMLElement | null>(null)
const aberto = ref(false)
const posicao = ref({ top: 0, left: 0 })

const MARGEM = 8

async function abrir() {
  aberto.value = true
  await nextTick()

  if (!gatilho.value || !caixa.value) return

  const alvo = gatilho.value.getBoundingClientRect()
  const dica = caixa.value.getBoundingClientRect()
  const cabeAcima = alvo.top - dica.height - MARGEM > 0

  const left = Math.min(
    Math.max(alvo.left + alvo.width / 2 - dica.width / 2, MARGEM),
    window.innerWidth - dica.width - MARGEM,
  )

  posicao.value = {
    top: cabeAcima ? alvo.top - dica.height - 6 : alvo.bottom + 6,
    left,
  }

  window.addEventListener('scroll', fechar, { once: true, capture: true })
}

function fechar() {
  aberto.value = false
}

function alternar() {
  if (aberto.value) {
    fechar()
  } else {
    abrir()
  }
}

onBeforeUnmount(() => window.removeEventListener('scroll', fechar, { capture: true }))
</script>

<template>
  <button
    ref="gatilho"
    type="button"
    class="inline-grid size-4 shrink-0 place-items-center rounded-full align-middle text-ink-subtle transition-colors hover:text-primary focus-visible:text-primary focus-visible:focus-ring"
    :class="aberto && 'text-primary'"
    @mouseenter="abrir"
    @mouseleave="fechar"
    @focus="abrir"
    @blur="fechar"
    @click.prevent.stop="alternar"
    @keydown.esc="fechar"
  >
    <UiIcon nome="info" :tamanho="16" />
    <span class="sr-only">{{ rotulo }}: {{ texto }}</span>
  </button>

  <Teleport to="body">
    <Transition enter-active-class="transition-opacity duration-100" enter-from-class="opacity-0">
      <div
        v-if="aberto"
        ref="caixa"
        aria-hidden="true"
        class="pointer-events-none fixed z-80 max-w-72 rounded-sm bg-ink px-3 py-2 text-xs leading-[18px] font-medium text-surface shadow-md"
        :style="{ top: `${posicao.top}px`, left: `${posicao.left}px` }"
      >
        {{ texto }}
      </div>
    </Transition>
  </Teleport>
</template>
