<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import UiButton from '@/components/ui/UiButton.vue'
import UiField from '@/components/ui/UiField.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiModal from '@/components/ui/UiModal.vue'

import { ROTULO_UNIDADE, type RubricaEvento, type UnidadeEvento } from '@/features/eventos/regras'
import { useAvisos } from '@/stores/avisos'
import { useInstitutoTerra } from '@/stores/institutoTerra'

/** Codigo da empresa e rubricas do sistema da folha usadas nos lancamentos do Instituto Terra. */
defineProps<{ aberto: boolean }>()

const emit = defineEmits<{ fechar: [] }>()

const { avisar } = useAvisos()
const { config, salvarCadastro, restaurarPadrao } = useInstitutoTerra()

const codigoEmpresa = ref('')
const rubricas = ref<RubricaEvento[]>([])

function carregar() {
  codigoEmpresa.value = config.value.codigoEmpresa
  rubricas.value = config.value.rubricas.map((rubrica) => ({ ...rubrica }))
}

watch(() => config.value, carregar, { immediate: true })

const UNIDADES = Object.entries(ROTULO_UNIDADE) as [UnidadeEvento, string][]

const erroCodigo = computed(() => (/^\d+$/.test(codigoEmpresa.value.trim()) ? undefined : 'Só números, ex.: 136866.'))

function erroRubrica(rubrica: RubricaEvento): string {
  if (!rubrica.descricao.trim()) return 'Informe a descrição.'
  if (!/^\d+$/.test(rubrica.codigo.trim())) return 'Código só com números.'
  if (rubricas.value.filter((item) => item.codigo.trim() === rubrica.codigo.trim()).length > 1) return 'Código repetido.'

  return ''
}

const valido = computed(() => !erroCodigo.value && rubricas.value.every((rubrica) => !erroRubrica(rubrica)))

function adicionar() {
  rubricas.value.push({ id: `rubrica-${Date.now().toString(36)}`, codigo: '', descricao: '', unidade: 'valor' })
}

function remover(indice: number) {
  rubricas.value.splice(indice, 1)
}

function salvar() {
  if (!valido.value) return

  salvarCadastro(
    codigoEmpresa.value,
    rubricas.value.map((rubrica) => ({ ...rubrica, codigo: rubrica.codigo.trim(), descricao: rubrica.descricao.trim() })),
  )
  avisar('Rubricas do Instituto Terra salvas.')
  emit('fechar')
}

function restaurar() {
  restaurarPadrao()
  avisar('Rubricas padrão restauradas.')
}

function cancelar() {
  carregar()
  emit('fechar')
}
</script>

<template>
  <UiModal
    :aberto="aberto"
    titulo="Rubricas do Instituto Terra"
    icone="ajustes"
    largura="larga"
    descricao="Códigos usados na planilha de lançamentos. As colunas do resumo são ligadas a estas rubricas pelo nome."
    @fechar="cancelar"
  >
    <div class="space-y-4 text-ink">
      <UiField id="it-codigo-empresa" rotulo="Código da empresa" :erro="erroCodigo" ajuda="Código do Instituto Terra no sistema da folha. Vai na coluna A de todas as linhas.">
        <template #default="{ id, descricao, invalido }">
          <UiInput :id="id" v-model="codigoEmpresa" mono inputmode="numeric" class="max-w-48" :invalido="invalido" :aria-describedby="descricao" autocomplete="off" />
        </template>
      </UiField>

      <div class="overflow-x-auto rounded-md border border-line">
        <table class="w-full min-w-[560px] text-sm">
          <thead class="bg-subtle text-xs text-muted">
            <tr>
              <th scope="col" class="w-28 px-3 py-2 text-left font-medium">Código</th>
              <th scope="col" class="px-3 py-2 text-left font-medium">Descrição</th>
              <th scope="col" class="w-36 px-3 py-2 text-left font-medium">Unidade</th>
              <th scope="col" class="w-10 px-2 py-2"><span class="sr-only">Remover</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(rubrica, indice) in rubricas" :key="rubrica.id" class="border-t border-line align-top">
              <td class="px-3 py-1.5">
                <input
                  v-model="rubrica.codigo"
                  inputmode="numeric"
                  :aria-label="`Código da rubrica ${rubrica.descricao}`"
                  class="num h-8 w-full rounded-md border border-line-strong bg-surface px-2 text-sm outline-none focus:border-primary focus:ring-3 focus:ring-primary-soft"
                />
              </td>
              <td class="px-3 py-1.5">
                <input
                  v-model="rubrica.descricao"
                  :aria-label="`Descrição da rubrica ${rubrica.codigo}`"
                  class="h-8 w-full rounded-md border border-line-strong bg-surface px-2 text-sm outline-none focus:border-primary focus:ring-3 focus:ring-primary-soft"
                />
                <p v-if="erroRubrica(rubrica)" class="mt-0.5 text-xs text-negative">{{ erroRubrica(rubrica) }}</p>
              </td>
              <td class="px-3 py-1.5">
                <select
                  v-model="rubrica.unidade"
                  :aria-label="`Unidade da rubrica ${rubrica.descricao}`"
                  class="h-8 w-full rounded-md border border-line-strong bg-surface px-2 text-sm outline-none focus:border-primary focus:ring-3 focus:ring-primary-soft"
                >
                  <option v-for="[valor, rotulo] in UNIDADES" :key="valor" :value="valor">{{ rotulo }}</option>
                </select>
              </td>
              <td class="px-2 py-1.5">
                <UiButton variante="discreto" tamanho="sm" icone="lixeira" so-icone @click="remover(indice)">Remover {{ rubrica.descricao }}</UiButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-2">
        <UiButton variante="discreto" icone="adicionar" @click="adicionar">Nova rubrica</UiButton>
        <button type="button" class="text-xs font-medium text-muted hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary" @click="restaurar">
          Restaurar rubricas padrão
        </button>
      </div>

      <p class="text-xs text-muted">
        <strong class="font-semibold text-ink-2">Horas</strong> vão como horas.minutos (2h20 → 2,20).
        <strong class="font-semibold text-ink-2">Dias</strong>: uma data na célula conta como 1 dia de falta.
      </p>
    </div>

    <template #acoes>
      <UiButton @click="cancelar">Cancelar</UiButton>
      <UiButton variante="primario" icone="salvar" :disabled="!valido" @click="salvar">Salvar rubricas</UiButton>
    </template>
  </UiModal>
</template>
