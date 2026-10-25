<script setup lang="ts" generic="T extends string">
import { useId } from 'vue'

/**
 * Escolha unica em trilha segmentada (visual ex-tabs segmented), com radios nativos.
 * Segue a mesma regua de alinhamento do UiField (rotulo ancorado embaixo e
 * linha de mensagem reservada), para alinhar com os campos da mesma linha.
 */
const modelo = defineModel<T>({ required: true })

defineProps<{
  nome: string
  rotulo: string
  opcoes: { valor: T; rotulo: string }[]
}>()

const id = useId()
</script>

<template>
  <div class="ex-field campo-alinhado" role="radiogroup" :aria-labelledby="id">
    <div class="flex min-w-0 flex-1 items-end">
      <span :id="id" class="ex-label">{{ rotulo }}</span>
    </div>

    <!-- Selecionado preenchido com primary: inequivoco nos dois temas (surface e sunken quase se confundem no escuro). -->
    <div class="grid h-(--control-md) auto-cols-fr grid-flow-col gap-0.5 rounded-md border border-line-strong/60 bg-sunken p-[3px]">
      <label
        v-for="opcao in opcoes"
        :key="opcao.valor"
        class="flex min-w-0 cursor-pointer items-center justify-center gap-1.5 rounded-[7px] px-2 text-[13px] font-semibold whitespace-nowrap transition-colors has-focus-visible:shadow-(--focus-ring)"
        :class="
          modelo === opcao.valor
            ? 'bg-primary text-on-primary shadow-xs'
            : 'text-ink-muted hover:bg-hover hover:text-ink'
        "
      >
        <input v-model="modelo" type="radio" :name="nome" :value="opcao.valor" class="ex-sr" />
        <span class="truncate">{{ opcao.rotulo }}</span>
      </label>
    </div>

    <span class="campo-mensagem" aria-hidden="true" />
  </div>
</template>
