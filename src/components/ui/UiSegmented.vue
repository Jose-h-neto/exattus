<script setup lang="ts" generic="T extends string">
import { useId } from 'vue'
import UiIcon, { type NomeIcone } from './UiIcon.vue'

/**
 * Escolha unica em trilha segmentada (visual ex-tabs segmented), com radios nativos.
 * Segue a mesma regua de alinhamento do UiField (rotulo ancorado embaixo e
 * linha de mensagem reservada), para alinhar com os campos da mesma linha.
 * Compacto: so a trilha, sem rotulo visivel, para alternar o modo de um campo.
 *
 * Raios concentricos: o raio interno e o externo menos borda e respiro
 * (10 - 1 - 3 = 6 no normal; 8 - 1 - 2 = 5 no compacto).
 */
const modelo = defineModel<T>({ required: true })

defineProps<{
  nome: string
  rotulo: string
  opcoes: { valor: T; rotulo: string; icone?: NomeIcone }[]
  compacto?: boolean
}>()

const id = useId()
</script>

<template>
  <div
    :class="compacto ? 'inline-block' : 'ex-field campo-alinhado'"
    role="radiogroup"
    :aria-labelledby="compacto ? undefined : id"
    :aria-label="compacto ? rotulo : undefined"
  >
    <div v-if="!compacto" class="flex min-w-0 flex-1 items-end">
      <span :id="id" class="ex-label">{{ rotulo }}</span>
    </div>

    <!-- Selecionado preenchido com primary: inequivoco nos dois temas (surface e sunken quase se confundem no escuro). -->
    <div
      class="grid auto-cols-fr grid-flow-col gap-0.5 border border-line-strong/60 bg-sunken"
      :class="compacto ? 'h-7 rounded-[8px] p-[2px]' : 'h-(--control-md) rounded-[10px] p-[3px]'"
    >
      <label
        v-for="opcao in opcoes"
        :key="opcao.valor"
        class="flex min-w-0 cursor-pointer items-center justify-center gap-1.5 font-semibold whitespace-nowrap transition-colors has-focus-visible:shadow-(--focus-ring)"
        :class="[
          compacto ? 'gap-1 rounded-[5px] px-2.5 text-xs' : 'rounded-[6px] px-2 text-[13px]',
          modelo === opcao.valor ? 'bg-primary text-on-primary shadow-xs' : 'text-ink-muted hover:bg-hover hover:text-ink',
        ]"
      >
        <input v-model="modelo" type="radio" :name="nome" :value="opcao.valor" class="ex-sr" />
        <UiIcon v-if="opcao.icone" :nome="opcao.icone" :tamanho="compacto ? 14 : 16" class="shrink-0" />
        <span class="truncate">{{ opcao.rotulo }}</span>
      </label>
    </div>

    <span v-if="!compacto" class="campo-mensagem" aria-hidden="true" />
  </div>
</template>
