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
    <div v-if="resultado.modalidade === 'prolabore'" class="rounded-[4px] border border-line bg-subtle/60 px-4 py-3 text-sm sm:rounded-md">
      <p class="flex items-center gap-1.5 text-muted">
        Pró-labore
        <UiInfo texto="Contribuição do sócio sobre o pró-labore, com alíquota única limitada ao teto." />
      </p>
      <p class="num mt-1 font-medium text-ink">
        {{ formatarMoeda(resultado.baseConsiderada) }} × {{ formatarPercentual(resultado.aliquota ?? 0) }}
        = {{ formatarMoeda(resultado.total) }}
      </p>
    </div>

    <div v-else class="overflow-x-auto rounded-[4px] border border-line sm:rounded-md">
      <!-- Faixa e intervalo numa coluna (intervalo embaixo, menor): a tabela cabe sem rolagem lateral. -->
      <table class="tabela text-[13px] sm:text-sm">
        <thead>
          <tr>
            <th scope="col">Faixa</th>
            <th scope="col" class="num">Base na faixa</th>
            <th scope="col" class="num hidden sm:table-cell">Alíquota</th>
            <th scope="col" class="num">Contribuição</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="etapa in resultado.etapas" :key="etapa.numero">
            <td class="text-ink">
              <span class="block whitespace-nowrap">Faixa {{ etapa.numero }}</span>
              <span class="block text-xs text-muted tabular-nums">
                {{ intervalo(etapa.de, etapa.ate) }}<span class="sm:hidden"> · {{ formatarPercentual(etapa.aliquota) }}</span>
              </span>
            </td>
            <td class="num">{{ formatarMoeda(etapa.base) }}</td>
            <td class="num hidden sm:table-cell">{{ formatarPercentual(etapa.aliquota) }}</td>
            <td class="num">
              <UiBadge v-if="etapa.usouValorFixo" class="mr-1.5 hidden sm:inline-flex" title="Faixa completa: valor fixo da tabela">fixo</UiBadge>
              {{ formatarMoeda(etapa.valor) }}
            </td>
          </tr>
          <tr v-if="!resultado.etapas.length">
            <td colspan="4" class="py-4 text-center text-muted">Base de contribuição zerada.</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" colspan="3" class="hidden text-left sm:table-cell">Total do INSS</th>
            <th scope="row" colspan="2" class="text-left sm:hidden">Total do INSS</th>
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
