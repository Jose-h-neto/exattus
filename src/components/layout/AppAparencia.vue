<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

import ExThemePicker from '@/components/exattus/ExThemePicker.vue'
import UiIcon, { type NomeIcone } from '@/components/ui/UiIcon.vue'
import UiSegmented from '@/components/ui/UiSegmented.vue'
import { usePaleta } from '@/stores/paleta'
import RodaDeCor from './RodaDeCor.vue'
import { useTema, type Tema } from '@/stores/tema'

/**
 * Aparencia (rodape do menu lateral): modo claro/escuro e paleta de destaque.
 * O painel abre ao lado do menu (ou sobre ele, em telas estreitas) e fica no
 * <body>, porque o menu corta o que passa da sua largura. A troca e imediata.
 */
const emit = defineEmits<{ aberto: [valor: boolean] }>()

const { paleta, paletas, cor, escolherCor, escolherTom, tomAtual } = usePaleta()

/*
 * Roda de cores: aparece com a paleta Personalizada selecionada. O tom fica num
 * estado proprio para o marcador nao "pular" com o arredondamento da cor.
 */
const tom = ref(tomAtual())
let mudouPelaRoda = false

function aoGirar(valor: number) {
  tom.value = valor
  mudouPelaRoda = true
  escolherTom(valor)
}

/* Codigo da cor (escondido por padrao): aplica ao confirmar (Enter ou sair do campo). */
const hexDigitado = ref(cor.value)
const hexInvalido = ref(false)

watch(cor, (valor) => {
  hexDigitado.value = valor
  hexInvalido.value = false

  if (!mudouPelaRoda) tom.value = tomAtual()

  mudouPelaRoda = false
})

function aplicarHex() {
  hexInvalido.value = !escolherCor(hexDigitado.value)
}
const { tema, definir } = useTema()

const modoTema = computed({ get: () => tema.value, set: definir })

const modos: { valor: Tema; rotulo: string; icone: NomeIcone }[] = [
  { valor: 'light', rotulo: 'Claro', icone: 'sol' },
  { valor: 'dark', rotulo: 'Escuro', icone: 'lua' },
]

/** Nome da paleta, na dica do botao do rodape (no painel, a bolinha marcada ja diz qual e). */
const nomePaleta = computed(() => paletas.find((item) => item.id === paleta.value)?.label ?? '')

const aberto = ref(false)
const botao = ref<HTMLButtonElement>()
const painel = ref<HTMLElement>()
const posicao = ref<Record<string, string>>({})

const LARGURA = 340
const MARGEM = 12

/** Ao lado do menu, alinhado pela base do botao; sem espaco, sobre o menu, acima do botao. */
function posicionar() {
  const alvo = botao.value

  if (!alvo) return

  const rBotao = alvo.getBoundingClientRect()
  const rMenu = alvo.closest('aside')?.getBoundingClientRect() ?? rBotao
  const largura = Math.min(LARGURA, window.innerWidth - 2 * MARGEM)
  const aoLado = rMenu.right + 8 + largura <= window.innerWidth - MARGEM
  const base = aoLado ? Math.max(window.innerHeight - rBotao.bottom, MARGEM) : window.innerHeight - rBotao.top + 8

  posicao.value = {
    left: `${aoLado ? rMenu.right + 8 : MARGEM}px`,
    bottom: `${base}px`,
    width: `${largura}px`,
    maxHeight: `${window.innerHeight - base - MARGEM}px`,
  }
}

async function abrir() {
  posicionar()
  aberto.value = true
  emit('aberto', true)
  await nextTick()
  // Foco na paleta escolhida: as setas ja trocam de paleta.
  painel.value?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]')?.focus()
}

function fechar(devolverFoco = true) {
  if (!aberto.value) return

  aberto.value = false
  emit('aberto', false)

  if (devolverFoco) botao.value?.focus()
}

function aoTocarFora(evento: PointerEvent) {
  const alvo = evento.target as Node

  if (!painel.value?.contains(alvo) && !botao.value?.contains(alvo)) fechar(false)
}

function aoTeclar(evento: KeyboardEvent) {
  if (evento.key === 'Escape') {
    // Nao deixa o Esc fechar tambem a gaveta do menu.
    evento.stopPropagation()
    fechar()
  }
}

watch(aberto, (valor) => {
  if (valor) {
    document.addEventListener('pointerdown', aoTocarFora, true)
    window.addEventListener('resize', posicionar)
  } else {
    document.removeEventListener('pointerdown', aoTocarFora, true)
    window.removeEventListener('resize', posicionar)
  }
})

onBeforeUnmount(() => fechar(false))
</script>

<template>
  <button
    ref="botao"
    type="button"
    class="ex-nav-item"
    aria-haspopup="dialog"
    :title="`Aparência · ${nomePaleta}`"
    :aria-expanded="aberto"
    @click="aberto ? fechar() : abrir()"
  >
    <UiIcon nome="paleta" :tamanho="20" />
    <span class="ex-nav-item__label min-w-0 truncate">Aparência</span>
    <span class="ex-sr">: {{ nomePaleta }}</span>
    <span class="size-3 shrink-0 rounded-full bg-primary-fill ring-2 ring-primary-soft" aria-hidden="true" />
  </button>

  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="translate-y-1 opacity-0"
      leave-active-class="transition duration-100 ease-in"
      leave-to-class="translate-y-1 opacity-0"
    >
      <div
        v-if="aberto"
        ref="painel"
        role="dialog"
        aria-labelledby="aparencia-titulo"
        class="vidro--flutuante fixed z-50 overflow-y-auto rounded-lg p-4"
        :style="posicao"
        @keydown="aoTeclar"
      >
        <div class="mb-3 flex items-center justify-between gap-3">
          <h2 id="aparencia-titulo" class="text-sm font-bold text-ink">Aparência</h2>
          <button type="button" class="ex-btn ex-btn--ghost ex-btn--sm ex-btn--icon" @click="fechar()">
            <UiIcon nome="fechar" :tamanho="16" />
            <span class="ex-sr">Fechar aparência</span>
          </button>
        </div>

        <UiSegmented v-model="modoTema" nome="aparencia-modo" rotulo="Modo" :opcoes="modos" />

        <div class="mb-2">
          <span class="ex-label">Cor</span>
        </div>
        <ExThemePicker v-model="paleta" label="Cor" compact />

        <!-- Personalizada: roda de cores. O codigo da cor fica escondido, para quem precisa da cor exata. -->
        <div v-if="paleta === 'personalizada'" class="mt-4 flex flex-col items-center gap-2.5 border-t border-line pt-4">
          <RodaDeCor :model-value="tom" rotulo="Escolher a cor" :tamanho="136" @update:model-value="aoGirar" />

          <details class="w-full text-xs">
            <summary class="cursor-pointer text-center text-muted hover:text-ink">Usar código da cor</summary>
            <input
              v-model="hexDigitado"
              type="text"
              maxlength="7"
              spellcheck="false"
              autocomplete="off"
              aria-label="Código da cor"
              placeholder="#5a3fc0"
              class="mt-2 h-9 w-full rounded-md border bg-surface px-3 font-mono text-sm uppercase outline-none focus:border-primary focus:ring-3 focus:ring-primary-soft"
              :class="hexInvalido ? 'border-danger' : 'border-line-strong'"
              :aria-invalid="hexInvalido"
              @change="aplicarHex"
              @keydown.enter.prevent="aplicarHex"
            />
            <p v-if="hexInvalido" class="mt-1 text-danger">Use o formato #RRGGBB, ex.: #0B6A80.</p>
          </details>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
