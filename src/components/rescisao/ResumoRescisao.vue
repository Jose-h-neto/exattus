<script setup lang="ts">
import { computed } from 'vue'

import UiPanel from '@/components/ui/UiPanel.vue'
import { formatarData } from '@/domain/datas'
import { formatarMoeda } from '@/domain/dinheiro'
import { obterModalidade } from '@/domain/rescisao/modalidades'
import { formularioRescisao as form, ROTULOS_PENDENTES } from '@/features/rescisao'
import { calculoRescisao, conferenciaRescisao, folhaInformada, leituraRescisao } from '@/features/rescisaoEstado'

const resultado = computed(() => calculoRescisao.value.resultado)

const pendentes = computed(() => leituraRescisao.value.pendentes.map((campo) => ROTULOS_PENDENTES[campo] ?? campo))

const linhas = computed(() => {
  const r = resultado.value

  if (!r) return []

  const { tempo } = r
  const vencidos = tempo.periodos.filter((p) => p.situacao === 'vencido' || p.situacao === 'vencido_dobro').length

  return [
    { rotulo: 'Tempo de serviço', valor: `${tempo.anos} ${tempo.anos === 1 ? 'ano' : 'anos'}` },
    {
      rotulo: 'Aviso prévio',
      valor: tempo.diasAvisoDireito
        ? `${tempo.diasAvisoDireito} dias${tempo.diasAvisoIndenizados ? ` · ${tempo.diasAvisoIndenizados} indenizados` : ''}`
        : 'Não se aplica',
    },
    { rotulo: 'Data projetada', valor: formatarData(tempo.dataProjetada) },
    { rotulo: 'Avos de 13º', valor: `${tempo.avosDecimoProjetado}/12` },
    { rotulo: 'Avos de férias', valor: `${tempo.avosFeriasProjetado}/12` },
    { rotulo: 'Férias vencidas', valor: vencidos ? `${vencidos} ${vencidos === 1 ? 'período' : 'períodos'}` : 'Nenhuma' },
  ]
})
</script>

<template>
  <UiPanel :titulo="form.referencia.trim() || 'Resumo da rescisão'" :descricao="obterModalidade(form.modalidade).rotulo">
    <div v-if="!resultado" class="px-5 py-4 text-[13px]">
      <p v-if="calculoRescisao.erro" class="text-negative">{{ calculoRescisao.erro }}</p>
      <template v-else-if="pendentes.length">
        <p class="mb-2 text-muted">Para calcular, informe:</p>
        <ul class="space-y-1.5">
          <li v-for="item in pendentes" :key="item" class="flex items-center gap-2 text-ink-2">
            <span class="size-1.5 rounded-full bg-line-strong" aria-hidden="true" />
            {{ item }}
          </li>
        </ul>
      </template>
      <p v-else class="text-muted">Revise os campos destacados.</p>
    </div>

    <template v-else>
      <dl class="divide-y divide-line text-[13px]">
        <div v-for="linha in linhas" :key="linha.rotulo" class="flex justify-between gap-3 px-5 py-2">
          <dt class="text-muted">{{ linha.rotulo }}</dt>
          <dd class="num text-right text-ink">{{ linha.valor }}</dd>
        </div>
      </dl>
      <dl class="border-t border-line bg-primary-soft/70 px-5 py-3">
        <dt class="text-xs text-muted">Valor líquido</dt>
        <dd class="num text-xl font-semibold tracking-tight text-primary">{{ formatarMoeda(resultado.liquido) }}</dd>
      </dl>
      <dl v-if="folhaInformada && conferenciaRescisao" class="flex justify-between gap-3 border-t border-line px-5 py-2.5 text-[13px]">
        <dt class="text-muted">Divergências</dt>
        <dd class="num font-medium" :class="conferenciaRescisao.divergentes ? 'text-negative' : 'text-positive'">
          {{ conferenciaRescisao.divergentes || 'Nenhuma' }}
        </dd>
      </dl>
    </template>
  </UiPanel>
</template>
