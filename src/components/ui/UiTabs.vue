<script setup lang="ts">
import { computed } from 'vue'
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/vue'

/**
 * Abas em linha do design system (ex-tabs--line). Teclado, foco e ARIA ficam
 * com o Headless UI; o painel recebe o id da aba ativa no slot padrao.
 */
export interface Aba {
  id: string
  rotulo: string
  contador?: string | number
}

const ativa = defineModel<string>({ required: true })

const props = defineProps<{ abas: Aba[]; rotulo: string }>()

const indice = computed(() => Math.max(props.abas.findIndex((aba) => aba.id === ativa.value), 0))

function mudar(novo: number) {
  const aba = props.abas[novo]

  if (aba) ativa.value = aba.id
}
</script>

<template>
  <TabGroup :selected-index="indice" @change="mudar">
    <div class="px-5 pt-1">
      <!-- display em linha inteira: o ex-tabs (inline-flex) limitaria o traco inferior a largura das abas -->
      <TabList class="ex-tabs ex-tabs--line abas-linha" style="display: flex" :aria-label="rotulo">
        <Tab v-for="aba in abas" :key="aba.id" class="ex-tab">
          {{ aba.rotulo }}<span v-if="aba.contador !== undefined" class="ex-tab__count">{{ aba.contador }}</span>
        </Tab>
      </TabList>
    </div>
    <TabPanels>
      <TabPanel v-for="aba in abas" :key="aba.id" class="focus-visible:outline-none">
        <slot :ativa="aba.id" />
      </TabPanel>
    </TabPanels>
  </TabGroup>
</template>
