<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'

import { brParaIso, isoParaBr, lerData, mascararData, NOMES_MESES, paraInputData, somarDias } from '@/domain/datas'
import UiIcon from './UiIcon.vue'

/**
 * Campo de data no padrao brasileiro (dd/mm/aaaa), com calendario em portugues.
 * O v-model trafega no formato ISO "AAAA-MM-DD", o mesmo das regras de negocio.
 * Datas incompletas sao emitidas como vazio; completas e inexistentes (31/02)
 * sao emitidas como digitadas, para que a validacao do formulario as acuse.
 */

defineOptions({ inheritAttrs: false })

const props = defineProps<{
  modelValue: string
  invalido?: boolean
  /** Limites em ISO ("AAAA-MM-DD"). */
  min?: string
  max?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [valor: string]
  /** Disparado quando a data fica completa e valida, ou e apagada. */
  change: [valor: string]
}>()

const id = useId()
const campo = ref<HTMLInputElement | null>(null)
const envoltorio = ref<HTMLElement | null>(null)
const painel = ref<HTMLElement | null>(null)

const texto = ref(isoParaBr(props.modelValue) || props.modelValue)
let ultimoEmitido = props.modelValue

watch(
  () => props.modelValue,
  (valor) => {
    if (valor === ultimoEmitido) return

    ultimoEmitido = valor
    texto.value = isoParaBr(valor) || valor
  },
)

function emitir(valor: string, confirmar: boolean) {
  if (valor === ultimoEmitido) return

  ultimoEmitido = valor
  emit('update:modelValue', valor)

  if (confirmar) emit('change', valor)
}

function aoDigitar(evento: Event) {
  const alvo = evento.target as HTMLInputElement
  const mascarado = mascararData(alvo.value)

  texto.value = mascarado
  alvo.value = mascarado

  if (!mascarado) {
    emitir('', true)
  } else if (mascarado.length === 10) {
    const iso = brParaIso(mascarado)

    emitir(iso ?? mascarado, iso !== null)
  } else {
    emitir('', false)
  }
}

/* Calendario ----------------------------------------------------------- */

const aberto = ref(false)
const visivel = ref({ ano: 2026, mes: 0 })
const focado = ref('')
const posicao = ref({ top: 0, left: 0 })

const DIAS_SEMANA = [
  { curto: 'D', nome: 'Domingo' },
  { curto: 'S', nome: 'Segunda-feira' },
  { curto: 'T', nome: 'Terça-feira' },
  { curto: 'Q', nome: 'Quarta-feira' },
  { curto: 'Q', nome: 'Quinta-feira' },
  { curto: 'S', nome: 'Sexta-feira' },
  { curto: 'S', nome: 'Sábado' },
]

function hojeIso(): string {
  const agora = new Date()

  return paraInputData(new Date(Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate())))
}

function permitido(iso: string): boolean {
  return (!props.min || iso >= props.min) && (!props.max || iso <= props.max)
}

const anos = computed(() => {
  const atual = new Date().getFullYear()
  const inicio = props.min ? Number(props.min.slice(0, 4)) : Math.min(1950, visivel.value.ano)
  const fim = props.max ? Number(props.max.slice(0, 4)) : Math.max(atual + 10, visivel.value.ano)

  return Array.from({ length: fim - inicio + 1 }, (_, indice) => inicio + indice)
})

/** Seis semanas, de domingo a sabado, cobrindo o mes visivel. */
const semanas = computed(() => {
  const { ano, mes } = visivel.value
  const primeiro = new Date(Date.UTC(ano, mes, 1))
  const inicio = somarDias(primeiro, -primeiro.getUTCDay())
  const hoje = hojeIso()

  return Array.from({ length: 6 }, (_, semana) =>
    Array.from({ length: 7 }, (_, dia) => {
      const data = somarDias(inicio, semana * 7 + dia)
      const iso = paraInputData(data)

      return {
        iso,
        dia: data.getUTCDate(),
        doMes: data.getUTCMonth() === mes,
        hoje: iso === hoje,
        selecionado: iso === props.modelValue,
        permitido: permitido(iso),
        rotulo: `${data.getUTCDate()} de ${NOMES_MESES[data.getUTCMonth()]!.toLowerCase()} de ${data.getUTCFullYear()}`,
      }
    }),
  )
})

function mostrarMes(iso: string) {
  const data = lerData(iso)

  if (data) visivel.value = { ano: data.getUTCFullYear(), mes: data.getUTCMonth() }
}

function posicionar() {
  if (!envoltorio.value || !painel.value) return

  const alvo = envoltorio.value.getBoundingClientRect()
  const altura = painel.value.offsetHeight
  const largura = painel.value.offsetWidth
  const abaixo = alvo.bottom + 4 + altura <= window.innerHeight

  posicao.value = {
    top: abaixo ? alvo.bottom + 4 : Math.max(alvo.top - altura - 4, 8),
    left: Math.min(Math.max(alvo.left, 8), window.innerWidth - largura - 8),
  }
}

async function focarDia() {
  await nextTick()
  painel.value?.querySelector<HTMLButtonElement>(`[data-dia="${focado.value}"]`)?.focus()
}

async function abrir() {
  if (props.disabled || aberto.value) return

  const inicial = lerData(props.modelValue) ? props.modelValue : hojeIso()
  const limitado = props.min && inicial < props.min ? props.min : props.max && inicial > props.max ? props.max : inicial

  focado.value = limitado
  mostrarMes(limitado)
  aberto.value = true

  await nextTick()
  posicionar()
  document.addEventListener('mousedown', aoClicarFora)
  window.addEventListener('resize', posicionar)
  window.addEventListener('scroll', posicionar, true)
  focarDia()
}

function fechar(devolverFoco = true) {
  if (!aberto.value) return

  aberto.value = false
  document.removeEventListener('mousedown', aoClicarFora)
  window.removeEventListener('resize', posicionar)
  window.removeEventListener('scroll', posicionar, true)

  if (devolverFoco) campo.value?.focus()
}

function aoClicarFora(evento: MouseEvent) {
  const alvo = evento.target as Node

  if (!envoltorio.value?.contains(alvo) && !painel.value?.contains(alvo)) fechar(false)
}

function escolher(iso: string) {
  if (!permitido(iso)) return

  texto.value = isoParaBr(iso)
  emitir(iso, true)
  fechar()
}

function limpar() {
  texto.value = ''
  emitir('', true)
  fechar()
}

function mudarMes(passo: number) {
  const { ano, mes } = visivel.value
  const data = new Date(Date.UTC(ano, mes + passo, 1))

  visivel.value = { ano: data.getUTCFullYear(), mes: data.getUTCMonth() }
}

async function navegar(evento: KeyboardEvent) {
  const atual = lerData(focado.value)

  if (!atual) return

  const passos: Record<string, number> = {
    ArrowLeft: -1,
    ArrowRight: 1,
    ArrowUp: -7,
    ArrowDown: 7,
    Home: -atual.getUTCDay(),
    End: 6 - atual.getUTCDay(),
  }

  let destino: Date | null = null

  if (evento.key in passos) {
    destino = somarDias(atual, passos[evento.key]!)
  } else if (evento.key === 'PageUp' || evento.key === 'PageDown') {
    const meses = (evento.key === 'PageUp' ? -1 : 1) * (evento.shiftKey ? 12 : 1)
    const ano = atual.getUTCFullYear()
    const mes = atual.getUTCMonth() + meses
    const ultimo = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate()

    destino = new Date(Date.UTC(ano, mes, Math.min(atual.getUTCDate(), ultimo)))
  } else if (evento.key === 'Escape') {
    evento.preventDefault()
    fechar()
    return
  } else {
    return
  }

  evento.preventDefault()
  focado.value = paraInputData(destino)
  mostrarMes(focado.value)
  focarDia()
}

/* Teclado no campo (calendario fechado) --------------------------------- */

let valorAoFocar = ''

function aoFocar() {
  valorAoFocar = props.modelValue
}

function definirData(iso: string) {
  const limitado = props.min && iso < props.min ? props.min : props.max && iso > props.max ? props.max : iso

  texto.value = isoParaBr(limitado)
  emitir(limitado, true)
  campo.value?.select()
}

function deslocar(dias: number, meses: number) {
  const base = lerData(props.modelValue) ?? lerData(hojeIso())

  if (!base) return

  if (meses) {
    const ano = base.getUTCFullYear()
    const mes = base.getUTCMonth() + meses
    const ultimo = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate()

    definirData(paraInputData(new Date(Date.UTC(ano, mes, Math.min(base.getUTCDate(), ultimo)))))
  } else {
    // Campo vazio: a primeira seta preenche com hoje.
    definirData(lerData(props.modelValue) ? paraInputData(somarDias(base, dias)) : hojeIso())
  }
}

function aoTeclarCampo(evento: KeyboardEvent) {
  if (evento.altKey && evento.key === 'ArrowDown') {
    evento.preventDefault()
    abrir()
    return
  }

  if (evento.altKey || evento.ctrlKey || evento.metaKey) return

  const acoes: Record<string, () => void> = {
    ArrowUp: () => deslocar(1, 0),
    ArrowDown: () => deslocar(-1, 0),
    PageUp: () => deslocar(0, evento.shiftKey ? 12 : 1),
    PageDown: () => deslocar(0, evento.shiftKey ? -12 : -1),
    h: () => definirData(hojeIso()),
    H: () => definirData(hojeIso()),
    Escape: () => {
      if (props.modelValue === valorAoFocar && texto.value === (isoParaBr(valorAoFocar) || valorAoFocar)) return
      texto.value = isoParaBr(valorAoFocar) || valorAoFocar
      emitir(valorAoFocar, true)
      evento.stopPropagation()
    },
  }

  const acao = acoes[evento.key]

  if (!acao) return

  evento.preventDefault()
  acao()
}

/** Mantem o painel focavel por Tab apenas dentro dele. */
function prenderFoco(evento: KeyboardEvent) {
  if (evento.key === 'Escape') {
    evento.preventDefault()
    fechar()
    return
  }

  if (evento.key !== 'Tab' || !painel.value) return

  const focaveis = [
    ...painel.value.querySelectorAll<HTMLElement>('select, button:not([disabled]):not([tabindex="-1"])'),
  ]
  const primeiro = focaveis[0]
  const ultimo = focaveis.at(-1)

  if (evento.shiftKey && document.activeElement === primeiro) {
    evento.preventDefault()
    ultimo?.focus()
  } else if (!evento.shiftKey && document.activeElement === ultimo) {
    evento.preventDefault()
    primeiro?.focus()
  }
}

/* Ao trocar de mes pelos seletores, o dia focavel acompanha o mes visivel. */
watch(visivel, ({ ano, mes }) => {
  const atual = lerData(focado.value)

  if (atual && atual.getUTCFullYear() === ano && atual.getUTCMonth() === mes) return

  const ultimo = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate()

  focado.value = paraInputData(new Date(Date.UTC(ano, mes, Math.min(atual?.getUTCDate() ?? 1, ultimo))))
})

const tituloMes = computed(() => `${NOMES_MESES[visivel.value.mes]} de ${visivel.value.ano}`)

onBeforeUnmount(() => fechar(false))
</script>

<template>
  <div
    ref="envoltorio"
    :class="['ex-control', { 'ex-control--error': invalido, 'ex-control--disabled': disabled, 'is-open': aberto }]"
  >
    <input
      ref="campo"
      v-bind="$attrs"
      :value="texto"
      type="text"
      inputmode="numeric"
      autocomplete="off"
      placeholder="dd/mm/aaaa"
      maxlength="10"
      :disabled="disabled"
      :aria-invalid="invalido || undefined"
      aria-haspopup="dialog"
      :aria-expanded="aberto"
      class="ex-input ex-num"
      @input="aoDigitar"
      @keydown="aoTeclarCampo"
      @focus="aoFocar"
    />
    <button
      type="button"
      class="mr-1.5 grid size-7 shrink-0 place-items-center rounded-sm text-ink-muted hover:bg-hover hover:text-ink focus-visible:focus-ring"
      :disabled="disabled"
      :aria-label="texto ? `Escolher data, selecionada ${texto}` : 'Escolher data'"
      :aria-expanded="aberto"
      @click="aberto ? fechar() : abrir()"
    >
      <UiIcon nome="calendario" :tamanho="18" />
    </button>
  </div>

  <Teleport to="body">
    <div
      v-if="aberto"
      ref="painel"
      role="dialog"
      :aria-label="`Calendário, ${tituloMes}`"
      class="vidro vidro--flutuante fixed z-80 w-[296px] rounded-md p-3"
      :style="{ top: `${posicao.top}px`, left: `${posicao.left}px` }"
      @keydown="prenderFoco"
    >
      <div class="mb-2 flex items-center gap-1">
        <button
          type="button"
          class="grid size-8 place-items-center rounded-md text-ink-2 hover:bg-subtle focus-visible:outline-2 focus-visible:outline-primary"
          aria-label="Mês anterior"
          @click="mudarMes(-1)"
        >
          <UiIcon nome="anterior" :tamanho="16" />
        </button>

        <label class="sr-only" :for="`${id}-mes`">Mês</label>
        <select
          :id="`${id}-mes`"
          v-model.number="visivel.mes"
          class="h-8 min-w-0 flex-1 rounded-md border border-line bg-surface px-1.5 text-[13px] font-medium text-ink focus-visible:outline-2 focus-visible:outline-primary"
        >
          <option v-for="(nome, indice) in NOMES_MESES" :key="nome" :value="indice">{{ nome }}</option>
        </select>

        <label class="sr-only" :for="`${id}-ano`">Ano</label>
        <select
          :id="`${id}-ano`"
          v-model.number="visivel.ano"
          class="num h-8 w-[76px] rounded-md border border-line bg-surface px-1.5 text-[13px] font-medium text-ink focus-visible:outline-2 focus-visible:outline-primary"
        >
          <option v-for="ano in anos" :key="ano" :value="ano">{{ ano }}</option>
        </select>

        <button
          type="button"
          class="grid size-8 place-items-center rounded-md text-ink-2 hover:bg-subtle focus-visible:outline-2 focus-visible:outline-primary"
          aria-label="Próximo mês"
          @click="mudarMes(1)"
        >
          <UiIcon nome="seta" :tamanho="16" />
        </button>
      </div>

      <table role="grid" class="w-full border-collapse" :aria-label="tituloMes" @keydown="navegar">
        <thead>
          <tr>
            <th
              v-for="(dia, indice) in DIAS_SEMANA"
              :key="indice"
              scope="col"
              :abbr="dia.nome"
              class="pb-1 text-center text-[11px] font-medium text-muted"
            >
              {{ dia.curto }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(semana, indice) in semanas" :key="indice">
            <td v-for="dia in semana" :key="dia.iso" class="p-0.5 text-center" :aria-selected="dia.selecionado">
              <button
                type="button"
                :data-dia="dia.iso"
                :tabindex="dia.iso === focado ? 0 : -1"
                :disabled="!dia.permitido"
                :aria-label="dia.rotulo"
                :aria-pressed="dia.selecionado"
                :aria-current="dia.hoje ? 'date' : undefined"
                class="num grid size-9 place-items-center rounded-md text-[13px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-30"
                :class="[
                  dia.selecionado
                    ? 'bg-primary font-semibold text-on-primary'
                    : dia.doMes
                      ? 'text-ink hover:bg-subtle'
                      : 'text-ink-subtle hover:bg-subtle',
                  dia.hoje && !dia.selecionado && 'font-semibold text-primary ring-1 ring-primary/30 ring-inset',
                ]"
                @click="escolher(dia.iso)"
                @focus="focado = dia.iso"
              >
                {{ dia.dia }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="mt-2 flex items-center justify-between border-t border-line pt-2">
        <button
          type="button"
          class="h-8 rounded-md px-2.5 text-[13px] font-medium text-primary hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-40"
          :disabled="!permitido(hojeIso())"
          @click="escolher(hojeIso())"
        >
          Hoje
        </button>
        <button
          type="button"
          class="h-8 rounded-md px-2.5 text-[13px] font-medium text-ink-2 hover:bg-subtle focus-visible:outline-2 focus-visible:outline-primary"
          @click="limpar"
        >
          Limpar
        </button>
      </div>
    </div>
  </Teleport>
</template>
