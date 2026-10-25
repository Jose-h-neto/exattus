<script setup lang="ts">
import { ref, useId, watch } from 'vue'
import UiIcon from './UiIcon.vue'
import UiInfo from './UiInfo.vue'

const props = defineProps<{
  titulo: string
  /** Explicacao do grupo, exibida na dica do icone de informacao. */
  descricao?: string
  /** Grupo de campos opcionais que pode ser recolhido. */
  recolhivel?: boolean
  /** Estado inicial quando recolhivel; ao passar para true, o grupo se abre. */
  aberto?: boolean
  /** 4 colunas em telas largas, para formularios extensos. */
  largo?: boolean
}>()

const id = useId()
const expandido = ref(props.aberto ?? false)

watch(
  () => props.aberto,
  (aberto) => {
    if (aberto) expandido.value = true
  },
)
</script>

<template>
  <div role="group" :aria-labelledby="id" class="border-t border-line px-5 pt-5 pb-1 first:border-t-0">
    <div class="flex items-center gap-1.5" :class="!recolhivel && 'mb-4'">
      <button
        v-if="recolhivel"
        type="button"
        class="-mx-1.5 flex flex-1 items-center gap-1.5 rounded-sm px-1.5 py-1 text-left hover:bg-hover focus-visible:focus-ring"
        :aria-expanded="expandido"
        :aria-controls="`${id}-campos`"
        @click="expandido = !expandido"
      >
        <UiIcon nome="seta" :tamanho="16" class="text-ink-muted transition-transform" :class="expandido && 'rotate-90'" />
        <span :id="id" class="text-sm font-bold text-ink">{{ titulo }}</span>
      </button>
      <h3 v-else :id="id" class="text-sm font-bold text-ink">{{ titulo }}</h3>

      <UiInfo v-if="descricao" :texto="descricao" :rotulo="`Sobre ${titulo}`" />
    </div>

    <div
      v-show="!recolhivel || expandido"
      :id="`${id}-campos`"
      class="grid grid-cols-2 gap-x-4 gap-y-0"
      :class="[recolhivel && 'mt-4', largo && 'lg:grid-cols-4']"
    >
      <slot />
    </div>
  </div>
</template>
