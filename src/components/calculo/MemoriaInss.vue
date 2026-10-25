<script setup lang="ts">
import { formatarMoeda, formatarPercentual } from '@/domain/dinheiro'
import type { ResultadoInss } from '@/domain/inss'
import UiAlert from '@/components/ui/UiAlert.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiInfo from '@/components/ui/UiInfo.vue'

defineProps<{ resultado: ResultadoInss; compacta?: boolean }>()

function intervalo(de: number, ate: number) {
  return de === 0 ? `Até ${formatarMoeda(ate)}` : `${formatarMoeda(de + 1)} a ${formatarMoeda(ate)}`
}
</script>

<template>
  <div class="space-y-4">
    <div v-if="resultado.modalidade === 'prolabore'" class="rounded-md border border-line bg-subtle/60 px-4 py-3 text-sm">
      <p class="flex items-center gap-1.5 text-muted">
        Pró-labore
        <UiInfo texto="Contribuição do sócio sobre o pró-labore, com alíquota única limitada ao teto." />
      </p>
      <p class="num mt-1 font-medium text-ink">
        {{ formatarMoeda(resultado.baseConsiderada) }} × {{ formatarPercentual(resultado.aliquota ?? 0) }}
        = {{ formatarMoeda(resultado.total) }}
      </p>
    </div>

    <div v-else class="overflow-x-auto rounded-md border border-line">
      <table class="tabela min-w-[520px]">
        <thead>
          <tr>
            <th scope="col">Faixa</th>
            <th scope="col">Intervalo</th>
            <th scope="col" class="num">Base na faixa</th>
            <th scope="col" class="num">Alíquota</th>
            <th scope="col" class="num">Contribuição</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="etapa in resultado.etapas" :key="etapa.numero">
            <td class="whitespace-nowrap text-ink">Faixa {{ etapa.numero }}</td>
            <td class="num text-left text-muted">{{ intervalo(etapa.de, etapa.ate) }}</td>
            <td class="num">{{ formatarMoeda(etapa.base) }}</td>
            <td class="num">{{ formatarPercentual(etapa.aliquota) }}</td>
            <td class="num">
              <UiBadge v-if="etapa.usouValorFixo" class="mr-2" title="Faixa completa: valor fixo da tabela">fixo</UiBadge>
              {{ formatarMoeda(etapa.valor) }}
            </td>
          </tr>
          <tr v-if="!resultado.etapas.length">
            <td colspan="5" class="py-4 text-center text-muted">Base de contribuição zerada.</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" colspan="4" class="text-left">Total do INSS</th>
            <td class="num">{{ formatarMoeda(resultado.total) }}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <UiAlert v-if="resultado.limitado && !compacta" tom="atencao">
      A base de {{ formatarMoeda(resultado.base) }} ultrapassa o teto. A contribuição foi limitada ao teto de
      {{ formatarMoeda(resultado.teto) }}.
    </UiAlert>
  </div>
</template>
