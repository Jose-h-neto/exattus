<script setup lang="ts">
import { nextTick } from 'vue'

import UiButton from '@/components/ui/UiButton.vue'
import UiField from '@/components/ui/UiField.vue'
import UiIcon from '@/components/ui/UiIcon.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiMoneyInput from '@/components/ui/UiMoneyInput.vue'

import { formatarMoeda } from '@/domain/dinheiro'
import { formatarHoras, lerHoras, LIMITE_MINUTOS_HORA_EXTRA, mascararHoras } from '@/domain/horasExtras'
import { novaLinhaHoraExtra, type LeituraHorasExtras, type LinhaHoraExtraFormulario } from '@/features/folha'

/**
 * Horas extras lancadas em horas: base e divisor do valor-hora e uma linha por
 * adicional (50%, 100%...), cada uma com o valor calculado ao lado.
 */
const linhas = defineModel<LinhaHoraExtraFormulario[]>('linhas', { required: true })
const base = defineModel<string>('base', { required: true })
const divisor = defineModel<string>('divisor', { required: true })

defineProps<{
  leitura: LeituraHorasExtras | null
  erroBase?: string
  erroDivisor?: string
  /** Id do rotulo do grupo ("Horas extras"). */
  rotuladoPor: string
}>()

const idHoras = (indice: number) => `folha-he-${indice}-horas`

/** Mascara hh:mm durante a digitacao (o campo exibe o valor ja mascarado). */
function digitarHoras(linha: LinhaHoraExtraFormulario, evento: Event) {
  const campo = evento.target as HTMLInputElement
  const mascarado = mascararHoras(campo.value)

  campo.value = mascarado
  linha.horas = mascarado
}

/** Ao sair, completa "8" para "08:00". */
function padronizarHoras(linha: LinhaHoraExtraFormulario) {
  const minutos = lerHoras(linha.horas)

  if (minutos !== null && !Number.isNaN(minutos)) {
    linha.horas = formatarHoras(minutos)
  }
}

/** Setas somam ou tiram 30 minutos. */
function ajustarHoras(linha: LinhaHoraExtraFormulario, evento: KeyboardEvent) {
  if ((evento.key !== 'ArrowUp' && evento.key !== 'ArrowDown') || evento.altKey || evento.ctrlKey) return

  const atual = lerHoras(linha.horas) ?? 0

  if (Number.isNaN(atual)) return

  evento.preventDefault()

  const passo = evento.key === 'ArrowUp' ? 30 : -30

  linha.horas = formatarHoras(Math.min(Math.max(atual + passo, 0), LIMITE_MINUTOS_HORA_EXTRA))
}

/** A segunda linha em diante sugere 100% (domingos e feriados). */
async function adicionarLinha() {
  linhas.value = [...linhas.value, novaLinhaHoraExtra(linhas.value.length ? '100' : '50')]
  await nextTick()
  document.getElementById(idHoras(linhas.value.length - 1))?.focus()
}

async function removerLinha(indice: number) {
  linhas.value = linhas.value.filter((_, posicao) => posicao !== indice)
  await nextTick()
  document.getElementById(idHoras(Math.min(indice, linhas.value.length - 1)))?.focus()
}

function valorDaLinha(leitura: LeituraHorasExtras | null, indice: number) {
  const valor = leitura?.valores[indice]

  return formatarMoeda(valor ?? 0)
}

function erroDaLinha(leitura: LeituraHorasExtras | null, indice: number) {
  const erros = leitura?.erros[indice]

  return [erros?.horas, erros?.adicional].filter(Boolean).join(' ')
}
</script>

<template>
  <div role="group" :aria-labelledby="rotuladoPor" class="rounded-md border border-line bg-sunken/40 px-3 pt-3 pb-2">
    <div class="grid grid-cols-2 gap-x-3">
      <UiField
        id="folha-he-base"
        rotulo="Base do valor-hora"
        ajuda="Vazio usa o salário bruto mensal, sem proporcionalizar pelos dias. Informe outra base quando houver adicionais que integram o valor-hora, como insalubridade ou periculosidade (Súmula 264 do TST)."
        :erro="erroBase"
      >
        <template #default="{ id, descricao, invalido }">
          <UiMoneyInput :id="id" v-model="base" placeholder="Salário bruto" :invalido="invalido" :aria-describedby="descricao" />
        </template>
      </UiField>

      <UiField
        id="folha-he-divisor"
        rotulo="Divisor"
        ajuda="Horas mensais da jornada: 220 para 44 h semanais, 200 para 40 h, 180 para 36 h e 150 para 30 h."
        :erro="erroDivisor"
      >
        <template #default="{ id, descricao, invalido }">
          <UiInput :id="id" v-model="divisor" inputmode="numeric" autocomplete="off" sufixo="h/mês" :invalido="invalido" :aria-describedby="descricao" />
        </template>
      </UiField>
    </div>

    <p class="mb-3 text-xs text-muted">
      <template v-if="leitura?.valorHora != null">
        Valor-hora <span class="num font-semibold text-ink-2">{{ formatarMoeda(leitura.valorHora) }}</span>
        = {{ formatarMoeda(leitura.base ?? 0) }} ÷ {{ leitura.divisor }}
      </template>
      <template v-else>Informe o salário para calcular o valor-hora.</template>
    </p>

    <div class="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_2rem] items-center gap-x-2 gap-y-2">
      <span class="ex-label text-xs" aria-hidden="true">Horas</span>
      <span class="ex-label text-xs" aria-hidden="true">Adicional</span>
      <span class="ex-label text-right text-xs" aria-hidden="true">Valor</span>
      <span aria-hidden="true" />

      <template v-for="(linha, indice) in linhas" :key="indice">
        <UiInput
          :id="idHoras(indice)"
          :model-value="linha.horas"
          inputmode="numeric"
          autocomplete="off"
          placeholder="00:00"
          :aria-label="`Horas da linha ${indice + 1}`"
          :invalido="Boolean(leitura?.erros[indice]?.horas)"
          @update:model-value="(valor: string) => (linha.horas = mascararHoras(valor))"
          @input="digitarHoras(linha, $event)"
          @blur="padronizarHoras(linha)"
          @keydown="ajustarHoras(linha, $event)"
        />
        <UiInput
          :id="`folha-he-${indice}-adicional`"
          v-model="linha.adicional"
          inputmode="decimal"
          autocomplete="off"
          placeholder="50"
          sufixo="%"
          :aria-label="`Adicional da linha ${indice + 1}`"
          :invalido="Boolean(leitura?.erros[indice]?.adicional)"
        />
        <span class="num min-w-[4.5rem] text-right text-[13px] font-medium" :class="leitura?.valores[indice] == null ? 'text-ink-subtle' : 'text-ink'">
          {{ valorDaLinha(leitura, indice) }}
        </span>
        <UiButton
          v-if="linhas.length > 1"
          variante="discreto"
          tamanho="sm"
          icone="fechar"
          so-icone
          @click="removerLinha(indice)"
        >Remover linha {{ indice + 1 }}</UiButton>
        <span v-else aria-hidden="true" />

        <p v-if="erroDaLinha(leitura, indice)" class="ex-error col-span-4 -mt-1" role="alert">
          <UiIcon nome="alerta" :tamanho="14" />{{ erroDaLinha(leitura, indice) }}
        </p>
      </template>
    </div>

    <div class="mt-2 flex items-center justify-between gap-3 border-t border-line pt-2">
      <UiButton variante="discreto" tamanho="sm" icone="adicionar" @click="adicionarLinha">Adicionar percentual</UiButton>
      <p class="text-xs text-muted">
        Total <span class="num ml-1 text-sm font-semibold text-ink">{{ formatarMoeda(leitura?.resultado?.total ?? 0) }}</span>
      </p>
    </div>
  </div>
</template>
