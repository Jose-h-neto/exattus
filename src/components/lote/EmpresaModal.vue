<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'

import UiButton from '@/components/ui/UiButton.vue'
import UiField from '@/components/ui/UiField.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiModal from '@/components/ui/UiModal.vue'

import { formatarCnpj, normalizarCnpj, type Empresa } from '@/domain/lote/tipos'
import { useAvisos } from '@/stores/avisos'
import { useCofre } from '@/stores/cofre'

/** Cria uma pasta (sem `empresa`) ou edita nome e CNPJ de uma existente. */
const props = defineProps<{ aberto: boolean; empresa?: Empresa }>()

const emit = defineEmits<{ fechar: []; salva: [empresa: Empresa] }>()

const { criarEmpresa, atualizarEmpresa, empresaPorCnpj, obterEmpresa } = useCofre()
const { avisar } = useAvisos()

const form = reactive({ nome: '', cnpj: '' })
const tentou = ref(false)
const salvando = ref(false)

watch(
  () => props.aberto,
  (aberto) => {
    if (!aberto) return

    tentou.value = false
    form.nome = props.empresa?.nome ?? ''
    form.cnpj = props.empresa?.cnpj ? formatarCnpj(props.empresa.cnpj) : ''
  },
  { immediate: true },
)

const erros = computed(() => {
  const lista: { nome?: string; cnpj?: string } = {}
  const cnpj = normalizarCnpj(form.cnpj)
  const outra = cnpj ? empresaPorCnpj(cnpj) : undefined

  if (!form.nome.trim()) lista.nome = 'Informe o nome da empresa.'
  if (cnpj && cnpj.length !== 14) lista.cnpj = 'O CNPJ tem 14 dígitos.'
  else if (outra && outra.id !== props.empresa?.id) lista.cnpj = `Já existe a pasta “${outra.nome}” com este CNPJ.`

  return lista
})

async function salvar() {
  tentou.value = true

  if (Object.keys(erros.value).length || salvando.value) return

  salvando.value = true

  try {
    if (props.empresa) {
      await atualizarEmpresa(props.empresa.id, form)
      avisar('Pasta atualizada.')
      emit('salva', obterEmpresa(props.empresa.id) ?? props.empresa)
    } else {
      const empresa = await criarEmpresa(form)

      avisar(`Pasta “${empresa.nome}” criada.`)
      emit('salva', empresa)
    }

    emit('fechar')
  } catch (causa) {
    avisar(causa instanceof Error ? causa.message : 'Não foi possível salvar a pasta.', 'erro')
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <UiModal
    :aberto="aberto"
    :titulo="empresa ? 'Editar pasta' : 'Nova pasta de empresa'"
    icone="empresa"
    descricao="Cada empresa tem uma pasta no cofre com as suas conferências em lote."
    @fechar="emit('fechar')"
  >
    <form class="grid gap-y-1" @submit.prevent="salvar">
      <UiField id="empresa-nome" rotulo="Nome da empresa" :erro="tentou ? erros.nome : undefined">
        <template #default="{ id, descricao, invalido }">
          <UiInput :id="id" v-model="form.nome" data-foco-inicial :invalido="invalido" :aria-describedby="descricao" autocomplete="off" />
        </template>
      </UiField>
      <UiField id="empresa-cnpj" rotulo="CNPJ" opcional ajuda="Com o CNPJ, a importação da planilha encontra esta pasta sozinha." :erro="erros.cnpj">
        <template #default="{ id, descricao, invalido }">
          <UiInput :id="id" v-model="form.cnpj" mono placeholder="00.000.000/0000-00" :invalido="invalido" :aria-describedby="descricao" autocomplete="off" />
        </template>
      </UiField>
      <button type="submit" class="sr-only" tabindex="-1">Salvar</button>
    </form>

    <template #acoes>
      <UiButton @click="emit('fechar')">Cancelar</UiButton>
      <UiButton variante="primario" :disabled="salvando" @click="salvar">{{ empresa ? 'Salvar' : 'Criar pasta' }}</UiButton>
    </template>
  </UiModal>
</template>
