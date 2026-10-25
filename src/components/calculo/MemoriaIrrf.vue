<script setup lang="ts">
import { computed } from 'vue'

import { formatarMoeda, formatarPercentual } from '@/domain/dinheiro'
import { descreverFaixaIrrf, type OpcaoIrrf, type ResultadoIrrf } from '@/domain/irrf'
import UiBadge from '@/components/ui/UiBadge.vue'

const props = withDefaults(
  defineProps<{ irrf: ResultadoIrrf; rotuloRendimento?: string; rotuloInss?: string }>(),
  { rotuloRendimento: 'Rendimento tributável', rotuloInss: 'INSS' },
)

const opcoes = computed(() =>
  props.irrf.simplificadoPermitido ? [props.irrf.legal, props.irrf.simplificado] : [props.irrf.legal],
)

const escolhida = computed(() => props.irrf.escolhida)

function adotada(opcao: OpcaoIrrf) {
  return opcao.modelo === escolhida.value.modelo
}

const linhas = computed(() => {
  const { irrf } = props
  const m = (valor: number) => formatarMoeda(valor)
  const vazio = '—'
  const comSimplificado = irrf.simplificadoPermitido
  const par = (legal: string, simplificado: string) => (comSimplificado ? [legal, simplificado] : [legal])

  return [
    { rotulo: props.rotuloRendimento, valores: par(m(irrf.rendimento), m(irrf.rendimento)) },
    { rotulo: `(−) ${props.rotuloInss}`, valores: par(m(irrf.inss), vazio) },
    {
      rotulo: `(−) Dependentes (${irrf.dependentes} × ${m(irrf.tabela.dependente)})`,
      valores: par(m(irrf.deducaoDependentes), vazio),
    },
    ...(comSimplificado ? [{ rotulo: '(−) Desconto simplificado', valores: [vazio, m(irrf.tabela.simplificado)] }] : []),
    { rotulo: '(=) Base de cálculo', valores: opcoes.value.map((o) => m(o.base)), forte: true },
    {
      rotulo: 'Faixa',
      valores: opcoes.value.map((o) => descreverFaixaIrrf(o.faixaIndice, irrf.tabela)),
      texto: true,
    },
    { rotulo: 'Alíquota', valores: opcoes.value.map((o) => formatarPercentual(o.faixa.aliquota)) },
    { rotulo: '(−) Parcela a deduzir', valores: opcoes.value.map((o) => m(o.faixa.deducao)) },
    { rotulo: '(=) Imposto bruto', valores: opcoes.value.map((o) => m(o.impostoBruto)) },
    { rotulo: '(−) Redução Lei nº 15.270/2025', valores: opcoes.value.map((o) => m(o.reducao.valor)) },
    { rotulo: '(=) IRRF', valores: opcoes.value.map((o) => m(o.irrf)), forte: true },
  ]
})

const formulaReducao = computed(() => {
  const { reducao } = escolhida.value
  const regra = props.irrf.tabela.reducao

  if (reducao.regra === 'nao_aplicada' || !regra) {
    return 'Não aplicada neste cálculo.'
  }

  if (reducao.regra === 'isencao') {
    return `${props.rotuloRendimento} até ${formatarMoeda(regra.limiteIsencao)}: redução de até ${formatarMoeda(regra.reducaoMaxima)}, limitada ao imposto calculado (${formatarMoeda(reducao.valor)}).`
  }

  if (reducao.regra === 'transicao') {
    return `${formatarMoeda(regra.parcelaFixa)} − (0,133145 × ${formatarMoeda(props.irrf.rendimento)}) = ${formatarMoeda(reducao.calculada)}, limitada ao imposto: ${formatarMoeda(reducao.valor)}.`
  }

  return `${props.rotuloRendimento} acima de ${formatarMoeda(regra.limiteTransicao)}: sem redução.`
})
</script>

<template>
  <div class="space-y-4">
    <div class="overflow-x-auto rounded-md border border-line">
      <table class="tabela" :class="opcoes.length > 1 ? 'min-w-[560px]' : 'min-w-[400px]'">
        <caption class="sr-only">Comparação entre deduções legais e desconto simplificado</caption>
        <thead>
          <tr>
            <th scope="col" class="w-[40%]">Item</th>
            <th
              v-for="opcao in opcoes"
              :key="opcao.modelo"
              scope="col"
              class="num"
              :class="opcoes.length > 1 && adotada(opcao) && '!bg-primary-soft !text-primary'"
            >
              <span class="inline-flex items-center gap-2">
                {{ opcao.nome }}
                <UiBadge v-if="opcoes.length > 1 && adotada(opcao)" tom="marca">adotado</UiBadge>
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="linha in linhas" :key="linha.rotulo">
            <th
              scope="row"
              class="!bg-transparent border-t border-line !text-[13px] !font-normal !text-ink-2"
              :class="linha.forte && '!font-semibold !text-ink'"
            >
              {{ linha.rotulo }}
            </th>
            <td
              v-for="(valor, indice) in linha.valores"
              :key="indice"
              class="num"
              :class="[
                opcoes.length > 1 && adotada(opcoes[indice]!) && 'bg-primary-soft/40',
                linha.forte && 'font-semibold text-ink',
                linha.texto && 'text-xs text-muted',
              ]"
            >
              {{ valor }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <dl class="grid gap-3 text-[13px] sm:grid-cols-[180px_1fr]">
      <dt class="text-muted">Modelo adotado</dt>
      <dd v-if="irrf.simplificadoPermitido" class="text-ink">
        {{ escolhida.nome }}, por resultar no menor imposto. IRRF por deduções legais:
        {{ formatarMoeda(irrf.legal.irrf) }}; por desconto simplificado: {{ formatarMoeda(irrf.simplificado.irrf) }}.
      </dd>
      <dd v-else class="text-ink">Deduções legais (desconto simplificado desabilitado nos parâmetros).</dd>

      <dt class="text-muted">Imposto bruto</dt>
      <dd class="num text-ink">
        {{ formatarMoeda(escolhida.base) }} × {{ formatarPercentual(escolhida.faixa.aliquota) }}
        − {{ formatarMoeda(escolhida.faixa.deducao) }} = {{ formatarMoeda(escolhida.impostoBruto) }}
      </dd>

      <dt class="text-muted">Redução</dt>
      <dd class="num text-ink">{{ formulaReducao }}</dd>

      <dt class="text-muted">IRRF</dt>
      <dd class="num font-medium text-ink">
        {{ formatarMoeda(escolhida.impostoBruto) }} − {{ formatarMoeda(escolhida.reducao.valor) }}
        = {{ formatarMoeda(escolhida.irrf) }}
      </dd>
    </dl>
  </div>
</template>
