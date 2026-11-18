<script setup lang="ts">
import { computed, ref } from 'vue'

import { corVivida } from '@/lib/cores'

/**
 * Roda de cores: um anel com todos os tons; arrastar ou clicar escolhe o tom
 * (0 a 359 graus, a partir do topo, no sentido horario). O centro mostra a cor
 * que fica no sistema (var(--primary)). Setas do teclado giram de 5 em 5 graus.
 */
const tom = defineModel<number>({ required: true })

withDefaults(defineProps<{ rotulo?: string; tamanho?: number }>(), { rotulo: 'Escolher a cor', tamanho: 152 })

const ESPESSURA = 22
const raiz = ref<HTMLElement>()
const arrastando = ref(false)

/** Cor do anel em cada tom: a versao mais viva (e a cor aplicada aos botoes ao escolher). */
const corDoAnel = (graus: number) => corVivida(graus)

const anel = computed(() => {
  const paradas = Array.from({ length: 25 }, (_, indice) => `${corDoAnel(indice * 15)} ${indice * 15}deg`)

  return `conic-gradient(from 0deg, ${paradas.join(', ')})`
})

const NOMES: [number, string][] = [
  [15, 'rosa'],
  [45, 'vermelho'],
  [75, 'laranja'],
  [110, 'amarelo'],
  [170, 'verde'],
  [215, 'turquesa'],
  [275, 'azul'],
  [315, 'roxo'],
  [350, 'magenta'],
  [360, 'rosa'],
]

const nomeDoTom = computed(() => NOMES.find(([limite]) => tom.value < limite)?.[1] ?? 'rosa')

/** Angulo do ponteiro em relacao ao centro: 0 no topo, crescendo no sentido horario. */
function tomDoPonteiro(evento: PointerEvent): number | null {
  const caixa = raiz.value?.getBoundingClientRect()

  if (!caixa) return null

  const x = evento.clientX - (caixa.left + caixa.width / 2)
  const y = evento.clientY - (caixa.top + caixa.height / 2)

  return Math.round(((Math.atan2(x, -y) * 180) / Math.PI + 360) % 360)
}

function aoPressionar(evento: PointerEvent) {
  const caixa = raiz.value?.getBoundingClientRect()

  if (!caixa) return

  // O miolo e so a amostra: clicar nele nao muda o tom.
  const raio = caixa.width / 2
  const distancia = Math.hypot(evento.clientX - (caixa.left + raio), evento.clientY - (caixa.top + raio))

  if (distancia < raio - ESPESSURA - 6) return

  arrastando.value = true
  raiz.value?.setPointerCapture(evento.pointerId)
  raiz.value?.focus()

  const novo = tomDoPonteiro(evento)

  if (novo !== null) tom.value = novo
}

function aoMover(evento: PointerEvent) {
  if (!arrastando.value) return

  const novo = tomDoPonteiro(evento)

  if (novo !== null) tom.value = novo
}

function aoSoltar(evento: PointerEvent) {
  arrastando.value = false
  if (raiz.value?.hasPointerCapture(evento.pointerId)) raiz.value.releasePointerCapture(evento.pointerId)
}

function aoTeclar(evento: KeyboardEvent) {
  const passos: Record<string, number> = { ArrowRight: 5, ArrowUp: 5, ArrowLeft: -5, ArrowDown: -5, PageUp: 30, PageDown: -30 }
  const passo = passos[evento.key]

  if (passo === undefined) return

  evento.preventDefault()
  tom.value = (((tom.value + passo) % 360) + 360) % 360
}
</script>

<template>
  <div
    ref="raiz"
    role="slider"
    tabindex="0"
    :aria-label="rotulo"
    aria-valuemin="0"
    aria-valuemax="359"
    :aria-valuenow="Math.round(tom)"
    :aria-valuetext="nomeDoTom"
    class="roda relative shrink-0 touch-none rounded-full select-none focus-visible:outline-none"
    :class="arrastando ? 'cursor-grabbing' : 'cursor-pointer'"
    :style="{ width: `${tamanho}px`, height: `${tamanho}px` }"
    @pointerdown="aoPressionar"
    @pointermove="aoMover"
    @pointerup="aoSoltar"
    @pointercancel="aoSoltar"
    @keydown="aoTeclar"
  >
    <span class="roda__anel absolute inset-0 rounded-full" :style="{ background: anel, '--espessura': `${ESPESSURA}px` }" aria-hidden="true" />

    <!-- Amostra no centro: a cor que fica no sistema, ja ajustada ao tema. -->
    <span
      class="absolute rounded-full bg-primary-fill shadow-[inset_0_0_0_1px_rgb(0_0_0/0.08)] transition-colors"
      :style="{ inset: `${ESPESSURA + 10}px` }"
      aria-hidden="true"
    />

    <!-- Marcador sobre o anel, na posicao do tom escolhido. -->
    <span class="absolute inset-0" :style="{ transform: `rotate(${tom}deg)` }" aria-hidden="true">
      <span
        class="roda__marcador absolute left-1/2 rounded-full border-[3px] border-white"
        :style="{ width: `${ESPESSURA + 4}px`, height: `${ESPESSURA + 4}px`, top: '-2px', marginLeft: `${-(ESPESSURA + 4) / 2}px`, background: corDoAnel(tom) }"
      />
    </span>
  </div>
</template>

<style scoped>
/* Anel: o degrade conico recortado por uma mascara radial (so a faixa externa aparece). */
.roda__anel {
  mask: radial-gradient(farthest-side, transparent calc(100% - var(--espessura)), #000 calc(100% - var(--espessura) + 1px));
}

.roda__marcador {
  box-shadow: 0 1px 4px rgb(0 0 0 / 0.35);
}

.roda:focus-visible .roda__marcador {
  box-shadow: 0 0 0 3px var(--primary), 0 1px 4px rgb(0 0 0 / 0.35);
}
</style>
