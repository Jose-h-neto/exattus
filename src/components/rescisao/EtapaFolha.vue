<script setup lang="ts">
import { computed } from 'vue'

import UiButton from '@/components/ui/UiButton.vue'
import UiMoneyInput from '@/components/ui/UiMoneyInput.vue'
import UiPanel from '@/components/ui/UiPanel.vue'

import { formatarMoeda } from '@/domain/dinheiro'
import type { GrupoConferencia, ItemConferencia } from '@/domain/rescisao/conferencia'
import { formularioRescisao as form } from '@/features/rescisao'
import { conferenciaRescisao, valoresFolha } from '@/features/rescisaoEstado'

const GRUPOS: { grupo: GrupoConferencia; titulo: string; descricao: string }[] = [
  { grupo: 'provento', titulo: 'Proventos', descricao: 'Verbas pagas no termo de rescisão.' },
  { grupo: 'desconto', titulo: 'Descontos', descricao: 'Descontos e tributos retidos.' },
  { grupo: 'total', titulo: 'Totais', descricao: 'Totais do termo de rescisão.' },
  { grupo: 'encargo', titulo: 'Bases e encargos', descricao: 'Bases de cálculo e valores de FGTS informados pela folha.' },
]

const itens = computed(() => conferenciaRescisao.value?.itens ?? [])

function doGrupo(grupo: GrupoConferencia, naoDevidas: boolean) {
  return itens.value.filter((item) => item.grupo === grupo && item.naoDevida === naoDevidas)
}

const naoDevidas = computed(() => itens.value.filter((item) => item.naoDevida))

function campo(chave: string) {
  return {
    get valor() {
      return form.folha[chave] ?? ''
    },
    set valor(texto: string) {
      form.folha = { ...form.folha, [chave]: texto }
    },
  }
}

function classeDiferenca(item: ItemConferencia) {
  if (item.situacao === 'confere') return 'text-positive'
  if (item.situacao === 'divergente') return 'font-medium text-warning'
  return 'text-muted'
}

function limpar() {
  form.folha = {}
}
</script>

<template>
  <div class="space-y-6">
    <UiPanel
      v-for="grupo in GRUPOS"
      :key="grupo.grupo"
      :titulo="grupo.titulo"
      :descricao="grupo.descricao"
    >
      <template v-if="grupo.grupo === 'provento'" #acoes>
        <UiButton tamanho="sm" variante="discreto" icone="reiniciar" :disabled="!Object.keys(form.folha).length" @click="limpar">
          Limpar valores da folha
        </UiButton>
      </template>

      <div class="overflow-x-auto">
        <table class="tabela min-w-[560px]">
          <thead>
            <tr>
              <th scope="col" class="pl-5">Item</th>
              <th scope="col" class="num">Calculado</th>
              <th scope="col" class="w-48">Valor na folha</th>
              <th scope="col" class="num pr-5">Diferença</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in doGrupo(grupo.grupo, false)" :key="item.chave">
              <td class="pl-5 align-middle font-medium text-ink">{{ item.descricao }}</td>
              <td class="num align-middle">{{ formatarMoeda(item.calculado) }}</td>
              <td>
                <UiMoneyInput
                  v-model="campo(item.chave).valor"
                  placeholder="Não informado"
                  :aria-label="`${item.descricao}: valor na folha`"
                  :invalido="valoresFolha.invalidos.includes(item.chave)"
                />
              </td>
              <td class="num pr-5 align-middle" :class="classeDiferenca(item)">
                {{ item.diferenca === null ? 'Não conferido' : `${item.diferenca > 0 ? '+' : ''}${formatarMoeda(item.diferenca)}` }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <details v-if="grupo.grupo === 'provento' && naoDevidas.length" class="group border-t border-line">
        <summary
          class="flex cursor-pointer list-none items-center justify-between px-5 py-3 text-[13px] text-ink-2 hover:bg-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden"
        >
          <span>Verbas não devidas neste cálculo. Preencha se a folha as pagou ou descontou.</span>
          <span class="text-xs text-muted">{{ naoDevidas.length }}</span>
        </summary>
        <div class="overflow-x-auto border-t border-line">
          <table class="tabela min-w-[560px]">
            <tbody>
              <tr v-for="item in naoDevidas" :key="item.chave">
                <td class="pl-5 align-middle text-ink-2">{{ item.descricao }}</td>
                <td class="num align-middle text-muted">{{ formatarMoeda(0) }}</td>
                <td class="w-48">
                  <UiMoneyInput
                    v-model="campo(item.chave).valor"
                    placeholder="Não pago"
                    :aria-label="`${item.descricao}: valor na folha`"
                    :invalido="valoresFolha.invalidos.includes(item.chave)"
                  />
                </td>
                <td class="num pr-5 align-middle" :class="classeDiferenca(item)">
                  {{ item.diferenca === null ? 'Não conferido' : `${item.diferenca > 0 ? '+' : ''}${formatarMoeda(item.diferenca)}` }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>
    </UiPanel>
  </div>
</template>
