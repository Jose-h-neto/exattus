<script setup lang="ts">
import UiButton from '@/components/ui/UiButton.vue'
import UiIcon from '@/components/ui/UiIcon.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiMoneyInput from '@/components/ui/UiMoneyInput.vue'

import { formatarMoeda } from '@/domain/dinheiro'
import { novaLinhaComissao, type LeituraComissoes, type LinhaComissaoFormulario } from '@/features/folha'

/** Varias comissoes lancadas uma a uma; o total entra nos proventos. */
const linhas = defineModel<LinhaComissaoFormulario[]>('linhas', { required: true })

defineProps<{ leitura: LeituraComissoes | null; rotuladoPor?: string }>()

function adicionar() {
  linhas.value = [...linhas.value, novaLinhaComissao()]
}

function remover(indice: number) {
  linhas.value = linhas.value.length > 1 ? linhas.value.filter((_, posicao) => posicao !== indice) : [novaLinhaComissao()]
}
</script>

<template>
  <div class="space-y-2" role="group" :aria-labelledby="rotuladoPor">
    <div v-for="(linha, indice) in linhas" :key="indice" class="grid grid-cols-[minmax(0,1fr)_minmax(0,9rem)_auto] items-start gap-2">
      <UiInput
        v-model="linha.descricao"
        :placeholder="`Comissão ${indice + 1}`"
        :aria-label="`Descrição da comissão ${indice + 1} (opcional)`"
        autocomplete="off"
      />
      <div>
        <UiMoneyInput
          v-model="linha.valor"
          placeholder="0,00"
          :aria-label="`Valor da comissão ${indice + 1}`"
          :invalido="Boolean(leitura?.erros[indice])"
        />
        <p v-if="leitura?.erros[indice]" class="ex-error mt-1 text-xs"><UiIcon nome="alerta" :tamanho="12" />{{ leitura.erros[indice] }}</p>
      </div>
      <UiButton variante="discreto" icone="lixeira" so-icone @click="remover(indice)">Remover comissão {{ indice + 1 }}</UiButton>
    </div>

    <div class="flex items-center justify-between gap-3 pt-1">
      <UiButton variante="discreto" tamanho="sm" icone="adicionar" @click="adicionar">Adicionar comissão</UiButton>
      <p class="text-[13px] text-ink-2">
        Total
        <span class="num ml-1 font-semibold text-ink">{{ formatarMoeda(leitura?.total ?? 0) }}</span>
        <span v-if="leitura && leitura.linhas.length > 1" class="text-muted"> · {{ leitura.linhas.length }} comissões</span>
      </p>
    </div>
  </div>
</template>
