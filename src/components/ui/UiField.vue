<script setup lang="ts">
import { computed } from 'vue'
import UiIcon from './UiIcon.vue'
import UiInfo from './UiInfo.vue'

/**
 * Rotulo, dica (no icone de informacao) e erro de um campo, no padrao ex-field.
 *
 * Alinhamento entre campos da mesma linha (classe campo-alinhado):
 * - a area do rotulo cresce para cima (flex-1 + items-end), entao um rotulo que
 *   quebra em duas linhas nao empurra o controle para baixo;
 * - a linha de mensagem e sempre reservada, entao um erro nao desloca o controle.
 *
 * Slot "acao": controle no fim da linha do rotulo (ex.: alternar o modo do campo).
 */
const props = defineProps<{
  id: string
  rotulo: string
  /** Explicacao do campo, exibida na dica do icone de informacao. */
  ajuda?: string
  erro?: string
  opcional?: boolean
  /** Rotula um grupo de campos: o rotulo vira texto com id `${id}-rotulo`, sem `for`. */
  grupo?: boolean
}>()

const descricao = computed(() => (props.erro ? `${props.id}-erro` : undefined))
</script>

<template>
  <div class="ex-field campo-alinhado">
    <div class="flex min-w-0 flex-1 items-end gap-1.5">
      <component :is="grupo ? 'span' : 'label'" :id="grupo ? `${id}-rotulo` : undefined" :for="grupo ? undefined : id" class="ex-label">
        {{ rotulo }}<span v-if="opcional" class="ex-label__opt">(opcional)</span>
      </component>
      <UiInfo v-if="ajuda" :texto="ajuda" :rotulo="`Sobre ${rotulo}`" class="mb-px" />
      <div v-if="$slots.acao" class="ml-auto shrink-0"><slot name="acao" /></div>
    </div>

    <slot :id="id" :descricao="descricao" :invalido="Boolean(erro)" />

    <p v-if="erro" :id="`${id}-erro`" class="ex-error campo-mensagem" :title="erro">
      <UiIcon nome="alerta" :tamanho="14" /><span class="min-w-0 truncate">{{ erro }}</span>
    </p>
    <span v-else class="campo-mensagem" aria-hidden="true" />
  </div>
</template>
