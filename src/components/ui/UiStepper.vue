<script setup lang="ts">
import { computed } from 'vue'
import UiIcon from './UiIcon.vue'

export type EstadoEtapa = 'concluida' | 'pendente' | 'erro'

export interface Etapa {
  id: string
  rotulo: string
  estado: EstadoEtapa
  /** Etapa bloqueada ate que as anteriores estejam completas. */
  bloqueada?: boolean
}

const ativa = defineModel<string>({ required: true })

const props = defineProps<{ etapas: Etapa[] }>()

const indiceAtivo = computed(() => props.etapas.findIndex((etapa) => etapa.id === ativa.value))
const etapaAtiva = computed(() => props.etapas[indiceAtivo.value])
</script>

<template>
  <nav aria-label="Etapas" class="vidro rounded-lg">
    <!-- Telas estreitas: etapa atual e progresso. -->
    <div class="flex items-center justify-between gap-3 px-4 py-3 md:hidden">
      <p class="text-sm">
        <span class="text-muted">Etapa {{ indiceAtivo + 1 }} de {{ etapas.length }} ·</span>
        <span class="font-medium text-ink"> {{ etapaAtiva?.rotulo }}</span>
      </p>
      <div class="flex gap-1" aria-hidden="true">
        <span
          v-for="(etapa, indice) in etapas"
          :key="etapa.id"
          class="h-1.5 w-5 rounded-full"
          :class="indice <= indiceAtivo ? 'bg-primary' : 'bg-line-strong'"
        />
      </div>
    </div>

    <ol class="hidden md:flex">
      <li v-for="(etapa, indice) in etapas" :key="etapa.id" class="flex min-w-0 flex-1 items-center">
        <button
          type="button"
          class="group flex w-full min-w-0 items-center gap-2.5 px-4 py-3 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed"
          :aria-current="etapa.id === ativa ? 'step' : undefined"
          :disabled="etapa.bloqueada"
          @click="ativa = etapa.id"
        >
          <span
            class="grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold ring-1 transition-colors"
            :class="[
              etapa.id === ativa
                ? 'bg-primary text-on-primary ring-primary'
                : etapa.estado === 'erro'
                  ? 'bg-negative-soft text-negative ring-danger/30'
                  : etapa.estado === 'concluida'
                    ? 'bg-primary-soft text-primary ring-primary/30'
                    : 'bg-surface text-muted ring-line-strong',
            ]"
          >
            <UiIcon v-if="etapa.estado === 'concluida' && etapa.id !== ativa" nome="ok" :tamanho="13" />
            <UiIcon v-else-if="etapa.estado === 'erro' && etapa.id !== ativa" nome="alerta" :tamanho="12" />
            <template v-else>{{ indice + 1 }}</template>
          </span>
          <span
            class="truncate text-[13px]"
            :class="[
              etapa.id === ativa ? 'font-semibold text-ink' : 'text-ink-2 group-hover:text-ink',
              etapa.bloqueada && '!text-muted',
            ]"
          >
            {{ etapa.rotulo }}
          </span>
          <span v-if="etapa.estado === 'erro'" class="sr-only">(com pendências)</span>
        </button>
        <UiIcon v-if="indice < etapas.length - 1" nome="seta" :tamanho="15" class="shrink-0 text-line-strong" />
      </li>
    </ol>
  </nav>
</template>
