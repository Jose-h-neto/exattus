<script setup lang="ts">
import { computed } from 'vue'
import UiIcon from './UiIcon.vue'
import UiInfo from './UiInfo.vue'

/** Rotulo, dica (no icone de informacao) e erro de um campo, no padrao ex-field. */
const props = defineProps<{
  id: string
  rotulo: string
  /** Explicacao do campo, exibida na dica do icone de informacao. */
  ajuda?: string
  erro?: string
  opcional?: boolean
}>()

const descricao = computed(() => (props.erro ? `${props.id}-erro` : undefined))
</script>

<template>
  <div class="ex-field">
    <div class="flex min-w-0 items-center gap-1.5">
      <label :for="id" class="ex-label">
        {{ rotulo }}<span v-if="opcional" class="ex-label__opt">(opcional)</span>
      </label>
      <UiInfo v-if="ajuda" :texto="ajuda" :rotulo="`Sobre ${rotulo}`" />
    </div>

    <slot :id="id" :descricao="descricao" :invalido="Boolean(erro)" />

    <p v-if="erro" :id="`${id}-erro`" class="ex-error">
      <UiIcon nome="alerta" :tamanho="14" />{{ erro }}
    </p>
  </div>
</template>
