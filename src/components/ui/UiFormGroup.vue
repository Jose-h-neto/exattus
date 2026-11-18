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
  /** Valores do holerite do cliente para conferir: cor fixa (nao muda com a paleta). */
  conferencia?: boolean
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

<!--
  Grupo de campos (fieldset) dos formularios. Cabecalho no mesmo padrao dos
  grupos da barra lateral: barra na cor principal + titulo em negrito e caixa
  alta, para o grupo se destacar dos rotulos dos campos. Cada grupo e uma caixa
  propria (.fieldset em main.css), um "formulario dentro do formulario". Grupos opcionais
  recolhem (a linha inteira e clicavel) e mostram "opcional"; a seta fica a direita.
-->
<template>
  <div
    role="group"
    :aria-labelledby="id"
    class="fieldset grupo-form"
    :class="[conferencia && 'fieldset--conferencia', recolhivel && '!pt-2', recolhivel && !expandido && 'pb-2']"
  >
    <!--
      Recolhivel: a linha inteira abre e fecha (o botao se estende por ela com ::after);
      a dica (i) fica acima do botao, logo depois do titulo, e continua clicavel.
    -->
    <div
      v-if="recolhivel"
      class="relative -mx-2 flex items-center gap-2 rounded-[2px] px-2 py-1.5 hover:bg-hover"
    >
      <span class="grupo-form__marca" aria-hidden="true" />
      <button
        type="button"
        class="grupo-form__titulo text-left outline-none after:absolute after:inset-0 after:rounded-[2px] focus-visible:after:[box-shadow:var(--focus-ring)]"
        :aria-expanded="expandido"
        :aria-controls="`${id}-campos`"
        @click="expandido = !expandido"
      >
        <span :id="id">{{ titulo }}</span>
      </button>
      <UiInfo v-if="descricao" :texto="descricao" :rotulo="`Sobre ${titulo}`" class="relative z-10" />
      <span class="text-[11px] font-medium text-ink-subtle">opcional</span>
      <UiIcon nome="seta" :tamanho="16" class="ml-auto text-ink-muted transition-transform" :class="expandido && 'rotate-90'" />
    </div>

    <div v-else class="mb-3 flex items-center gap-2">
      <span class="grupo-form__marca" aria-hidden="true" />
      <h3 :id="id" class="grupo-form__titulo">{{ titulo }}</h3>
      <UiInfo v-if="descricao" :texto="descricao" :rotulo="`Sobre ${titulo}`" />
    </div>

    <div
      v-show="!recolhivel || expandido"
      :id="`${id}-campos`"
      class="grid grid-cols-2 gap-x-4 gap-y-0"
      :class="[recolhivel && 'mt-3', largo && 'lg:grid-cols-4']"
    >
      <slot />
    </div>
  </div>
</template>
