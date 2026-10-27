<script setup lang="ts">
import { computed, ref } from 'vue'

import MemoriaInss from '@/components/calculo/MemoriaInss.vue'
import MemoriaIrrf from '@/components/calculo/MemoriaIrrf.vue'
import ResumoValores from '@/components/calculo/ResumoValores.vue'
import UiAlert from '@/components/ui/UiAlert.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiInfo from '@/components/ui/UiInfo.vue'
import UiPanel from '@/components/ui/UiPanel.vue'
import UiTabs from '@/components/ui/UiTabs.vue'
import DemonstrativoRescisao from './DemonstrativoRescisao.vue'

import { formatarData } from '@/domain/datas'
import { formatarMoeda, formatarPercentual } from '@/domain/dinheiro'
import type { ResultadoRescisao, SituacaoPeriodo } from '@/domain/rescisao/calculo'

const props = defineProps<{ resultado: ResultadoRescisao }>()

const aba = ref('inss')

const abas = [
  { id: 'inss', rotulo: 'INSS' },
  { id: 'inss13', rotulo: 'INSS 13º' },
  { id: 'irrf', rotulo: 'IRRF' },
  { id: 'irrf13', rotulo: 'IRRF 13º' },
  { id: 'tempo', rotulo: 'Tempo de serviço' },
]

const bases = computed(() => {
  const r = props.resultado
  const folha = r.entrada.folhaAnterior
  const anterior = r.entrada.competenciaAnterior

  return [
    {
      tributo: 'INSS',
      base: r.inssMensal.baseConsiderada,
      calculado: r.inssMensal.total,
      abatido: anterior.inss,
      devido: r.inssMensalDevido,
      nota: anterior.remuneracao ? `Inclui ${formatarMoeda(anterior.remuneracao)} já pagos na competência.` : 'Por competência do desligamento.',
    },
    {
      tributo: 'INSS 13º',
      base: r.inssDecimo.baseConsiderada,
      calculado: r.inssDecimo.total,
      abatido: 0,
      devido: r.inssDecimo.total,
      nota: 'Calculado separadamente do mês.',
    },
    {
      tributo: 'IRRF',
      base: r.irrfMensal.escolhida.base,
      calculado: r.irrfMensal.escolhida.irrf,
      abatido: folha.irrf,
      devido: r.irrfMensalDevido,
      nota: folha.rendimentos
        ? `Regime de caixa: inclui ${formatarMoeda(folha.rendimentos)} da folha anterior paga no mês.`
        : 'Regime de caixa, competência do pagamento.',
    },
    {
      tributo: 'IRRF 13º',
      base: r.irrfDecimo.escolhida.base,
      calculado: r.irrfDecimo.escolhida.irrf,
      abatido: 0,
      devido: r.irrfDecimo.escolhida.irrf,
      nota: 'Tributação exclusiva.',
    },
  ]
})

const SITUACOES: Record<SituacaoPeriodo, { texto: string; tom: 'neutro' | 'marca' | 'atencao' | 'sucesso' }> = {
  gozado: { texto: 'Gozado', tom: 'neutro' },
  vencido: { texto: 'Vencido', tom: 'marca' },
  vencido_dobro: { texto: 'Vencido em dobro', tom: 'atencao' },
  em_curso: { texto: 'Em curso', tom: 'sucesso' },
}
</script>

<template>
  <div class="space-y-6">
    <UiAlert v-if="resultado.alertas.length" tom="atencao" titulo="Pontos de atenção">
      <ul class="list-disc pl-4">
        <li v-for="alerta in resultado.alertas" :key="alerta">{{ alerta }}</li>
      </ul>
    </UiAlert>

    <ResumoValores
      :itens="[
        { rotulo: 'Proventos', valor: resultado.totalProventos },
        { rotulo: 'Descontos', valor: resultado.totalDescontos, sinal: '-' },
        { rotulo: 'Valor líquido', valor: resultado.liquido, destaque: true },
        { rotulo: 'FGTS + multa (GRRF)', valor: resultado.fgts.mensal + resultado.fgts.decimo + resultado.fgts.multa },
      ]"
    />

    <DemonstrativoRescisao :resultado="resultado" />

    <div class="grid gap-6 2xl:grid-cols-2">
      <UiPanel titulo="Bases tributárias" descricao="INSS e IRRF calculados separadamente sobre a remuneração do mês e sobre o 13º salário.">
        <div class="overflow-x-auto">
          <table class="tabela min-w-[520px]">
            <thead>
              <tr>
                <th scope="col" class="pl-5">Tributo</th>
                <th scope="col" class="num">Base</th>
                <th scope="col" class="num">Calculado</th>
                <th scope="col" class="num">Já retido</th>
                <th scope="col" class="num pr-5">Devido</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="linha in bases" :key="linha.tributo">
                <td class="pl-5">
                  <span class="flex items-center gap-1.5 font-medium text-ink">
                    {{ linha.tributo }}
                    <UiInfo :texto="linha.nota" />
                  </span>
                </td>
                <td class="num">{{ formatarMoeda(linha.base) }}</td>
                <td class="num">{{ formatarMoeda(linha.calculado) }}</td>
                <td class="num text-muted">{{ formatarMoeda(linha.abatido ?? 0) }}</td>
                <td class="num pr-5 font-medium text-ink">{{ formatarMoeda(linha.devido) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </UiPanel>

      <UiPanel titulo="FGTS" descricao="Depositado via guia, fora do valor líquido. Não incide sobre férias indenizadas.">
        <dl class="divide-y divide-line text-[13px]">
          <div class="flex justify-between gap-4 px-5 py-2.5">
            <dt class="text-ink-2">FGTS do mês rescisório</dt>
            <dd class="num text-ink">
              <span class="mr-2 text-xs text-muted">{{ formatarMoeda(resultado.fgts.baseMensal) }} × {{ formatarPercentual(resultado.fgts.aliquota) }}</span>
              {{ formatarMoeda(resultado.fgts.mensal) }}
            </dd>
          </div>
          <div class="flex justify-between gap-4 px-5 py-2.5">
            <dt class="text-ink-2">FGTS sobre 13º</dt>
            <dd class="num text-ink">
              <span class="mr-2 text-xs text-muted">{{ formatarMoeda(resultado.fgts.baseDecimo) }} × {{ formatarPercentual(resultado.fgts.aliquota) }}</span>
              {{ formatarMoeda(resultado.fgts.decimo) }}
            </dd>
          </div>
          <div class="flex justify-between gap-4 px-5 py-2.5">
            <dt class="text-ink-2">Multa rescisória</dt>
            <dd class="num text-ink">
              <span class="mr-2 text-xs text-muted">
                {{ formatarMoeda(resultado.fgts.baseMulta) }} × {{ resultado.fgts.percentualMulta ? formatarPercentual(resultado.fgts.percentualMulta) : '0%' }}
              </span>
              {{ formatarMoeda(resultado.fgts.multa) }}
            </dd>
          </div>
          <div class="flex justify-between gap-4 px-5 py-2.5">
            <dt class="text-ink-2">Saque</dt>
            <dd class="text-ink">{{ resultado.modalidade.saqueFgts }}</dd>
          </div>
        </dl>
      </UiPanel>
    </div>

    <section class="vidro rounded-lg">
      <UiTabs v-model="aba" :abas="abas" rotulo="Memória de cálculo">
        <template #default="{ ativa }">
          <div class="p-5">
            <MemoriaInss v-if="ativa === 'inss'" :resultado="resultado.inssMensal" />
            <MemoriaInss v-else-if="ativa === 'inss13'" :resultado="resultado.inssDecimo" />
            <MemoriaIrrf
              v-else-if="ativa === 'irrf'"
              :irrf="resultado.irrfMensal"
              rotulo-rendimento="Rendimentos do mês"
            />
            <MemoriaIrrf v-else-if="ativa === 'irrf13'" :irrf="resultado.irrfDecimo" rotulo-rendimento="13º salário" />

            <div v-else class="space-y-4">
              <dl class="grid grid-cols-2 gap-x-6 gap-y-3 text-[13px] lg:grid-cols-4">
                <div>
                  <dt class="text-xs text-muted">Tempo de serviço</dt>
                  <dd class="num font-medium text-ink">{{ resultado.tempo.anos }} {{ resultado.tempo.anos === 1 ? 'ano completo' : 'anos completos' }}</dd>
                </div>
                <div>
                  <dt class="text-xs text-muted">Data projetada</dt>
                  <dd class="num font-medium text-ink">{{ formatarData(resultado.tempo.dataProjetada) }}</dd>
                </div>
                <div>
                  <dt class="text-xs text-muted">Avos de 13º</dt>
                  <dd class="num font-medium text-ink">
                    {{ resultado.tempo.avosDecimoReal }}/12
                    <span v-if="resultado.tempo.avosDecimoProjetado > resultado.tempo.avosDecimoReal" class="font-normal text-muted">
                      + {{ resultado.tempo.avosDecimoProjetado - resultado.tempo.avosDecimoReal }} pela projeção
                    </span>
                  </dd>
                </div>
                <div>
                  <dt class="text-xs text-muted">Avos de férias</dt>
                  <dd class="num font-medium text-ink">
                    {{ resultado.tempo.avosFeriasReal }}/12
                    <span v-if="resultado.tempo.avosFeriasProjetado > resultado.tempo.avosFeriasReal" class="font-normal text-muted">
                      + {{ resultado.tempo.avosFeriasProjetado - resultado.tempo.avosFeriasReal }} pela projeção
                    </span>
                  </dd>
                </div>
              </dl>

              <div class="overflow-x-auto rounded-md border border-line">
                <table class="tabela min-w-[600px]">
                  <thead>
                    <tr>
                      <th scope="col">Período aquisitivo</th>
                      <th scope="col">Concessivo até</th>
                      <th scope="col">Situação</th>
                      <th scope="col" class="num">Faltas</th>
                      <th scope="col" class="num">Dias</th>
                      <th scope="col" class="num">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="periodo in resultado.tempo.periodos" :key="periodo.numero">
                      <td class="num text-left whitespace-nowrap text-ink">
                        {{ periodo.numero }}º · {{ formatarData(periodo.inicio) }} a {{ formatarData(periodo.fim) }}
                      </td>
                      <td class="num text-left">{{ formatarData(periodo.fimConcessivo) }}</td>
                      <td><UiBadge :tom="SITUACOES[periodo.situacao].tom">{{ SITUACOES[periodo.situacao].texto }}</UiBadge></td>
                      <td class="num">{{ periodo.faltas }}</td>
                      <td class="num">{{ periodo.situacao === 'gozado' ? 0 : periodo.dias }}</td>
                      <td class="num">{{ formatarMoeda(periodo.valor ?? 0) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </template>
      </UiTabs>
    </section>
  </div>
</template>
