<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import AppLogo from './AppLogo.vue'
import AppSidebar, { type ModoMenu } from './AppSidebar.vue'
import UiIcon from '@/components/ui/UiIcon.vue'
import { gravarJson, lerJson } from '@/lib/armazenamento'

const CHAVE_RECOLHIDO = 'exattus:menu-recolhido'

const route = useRoute()

/** Telas largas: menu fixo, recolhivel. Telas estreitas: gaveta. */
const telaLarga = ref(window.matchMedia('(min-width: 1024px)').matches)
const recolhido = ref(lerJson(CHAVE_RECOLHIDO, (v): v is boolean => typeof v === 'boolean') ?? false)
/** Menu recolhido exibido temporariamente sobre o conteudo (hover na borda). */
const espiando = ref(false)
const gavetaAberta = ref(false)

watch(recolhido, (valor) => gravarJson(CHAVE_RECOLHIDO, valor))

const modo = computed<ModoMenu>(() => {
  if (!telaLarga.value) return 'gaveta'
  return recolhido.value ? 'flutuante' : 'fixo'
})

const visivel = computed(() => {
  if (modo.value === 'fixo') return true
  if (modo.value === 'flutuante') return espiando.value
  return gavetaAberta.value
})

let temporizador: number | undefined

function espiar() {
  window.clearTimeout(temporizador)
  if (modo.value === 'flutuante') espiando.value = true
}

function pararDeEspiar() {
  window.clearTimeout(temporizador)
  temporizador = window.setTimeout(() => (espiando.value = false), 250)
}

function alternarMenu() {
  if (modo.value === 'gaveta') {
    gavetaAberta.value = !gavetaAberta.value
    return
  }

  recolhido.value = !recolhido.value
  espiando.value = false
}

let consulta: MediaQueryList | null = null

function atualizarTela() {
  telaLarga.value = consulta?.matches ?? true
  gavetaAberta.value = false
  espiando.value = false
}

function aoTeclar(evento: KeyboardEvent) {
  if (evento.key === 'Escape') {
    gavetaAberta.value = false
    espiando.value = false
  }

  // Ctrl+\ (ou Cmd+\), como no Notion.
  if ((evento.ctrlKey || evento.metaKey) && evento.key === '\\') {
    evento.preventDefault()
    alternarMenu()
  }
}

onMounted(() => {
  consulta = window.matchMedia('(min-width: 1024px)')
  atualizarTela()
  consulta.addEventListener('change', atualizarTela)
  window.addEventListener('keydown', aoTeclar)
})

onBeforeUnmount(() => {
  consulta?.removeEventListener('change', atualizarTela)
  window.removeEventListener('keydown', aoTeclar)
  window.clearTimeout(temporizador)
})

watch(
  () => route.fullPath,
  () => {
    gavetaAberta.value = false
    espiando.value = false
  },
)
</script>

<template>
  <a
    href="#conteudo"
    class="sr-only z-70 rounded-md bg-primary px-3 py-2 text-sm text-on-primary focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
  >
    Pular para o conteúdo
  </a>

  <div class="min-h-dvh transition-[padding] duration-200" :class="modo === 'fixo' && 'pl-(--sidebar-width)'">
    <!-- Faixa sensivel na borda esquerda: revela o menu recolhido. -->
    <div
      v-if="modo === 'flutuante'"
      class="fixed inset-y-0 left-0 z-30 w-3"
      aria-hidden="true"
      @mouseenter="espiar"
      @mouseleave="pararDeEspiar"
    />

    <aside
      class="fixed z-40 w-(--sidebar-width) overflow-hidden transition-[translate,opacity] duration-200"
      :class="[
        modo === 'flutuante'
          ? 'vidro--flutuante top-14 bottom-3 left-0 rounded-r-lg'
          : 'inset-y-0 left-0',
        modo === 'gaveta' && 'vidro--flutuante',
        visivel ? 'translate-x-0' : '-translate-x-full',
        modo === 'flutuante' && !visivel && 'opacity-0',
      ]"
      :inert="!visivel"
      @mouseenter="espiar"
      @mouseleave="pararDeEspiar"
    >
      <AppSidebar :modo="modo" @alternar="alternarMenu" @navegar="gavetaAberta = false" />
    </aside>

    <Transition enter-from-class="opacity-0" leave-to-class="opacity-0">
      <div
        v-if="modo === 'gaveta' && gavetaAberta"
        class="fixed inset-0 z-30 bg-scrim transition-opacity"
        aria-hidden="true"
        @click="gavetaAberta = false"
      />
    </Transition>

    <!-- Menu recolhido em tela larga: botao visivel para reabrir (o hover tambem revela o menu). -->
    <button
      v-if="modo === 'flutuante'"
      type="button"
      class="ex-btn ex-btn--secondary ex-btn--sm fixed top-3 left-3 z-30 shadow-md"
      title="Mostrar menu (Ctrl+\)"
      @mouseenter="espiar"
      @mouseleave="pararDeEspiar"
      @click="alternarMenu"
    >
      <UiIcon nome="expandir" :tamanho="16" />
      Menu
    </button>

    <header
      v-if="modo === 'gaveta'"
      class="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-(--vidro-contorno) px-4"
      style="background: var(--vidro-fundo); backdrop-filter: var(--vidro-desfoque); -webkit-backdrop-filter: var(--vidro-desfoque)"
    >
      <button
        type="button"
        class="ex-btn ex-btn--ghost ex-btn--icon"
        :aria-expanded="gavetaAberta"
        @click="gavetaAberta = true"
      >
        <UiIcon nome="menu" />
        <span class="sr-only">Abrir menu</span>
      </button>
      <span class="flex items-center gap-2">
        <AppLogo :tamanho="26" class="text-[#5D3BCC] dark:text-primary" />
        <span class="text-lg font-extrabold tracking-[-0.03em] text-ink">Exattus</span>
      </span>
    </header>

    <main
      id="conteudo"
      tabindex="-1"
      class="mx-auto max-w-[1344px] px-4 py-6 outline-none sm:px-6 lg:py-8"
      :class="modo === 'flutuante' ? 'lg:px-8 lg:pt-16' : 'lg:px-8'"
    >
      <slot />
    </main>
  </div>
</template>
