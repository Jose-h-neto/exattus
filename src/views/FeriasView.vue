<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import PageHeader from '@/components/layout/PageHeader.vue'
import BarraResultadoMovel from '@/components/calculo/BarraResultadoMovel.vue'
import Demonstrativo, { type LinhaDemonstrativo } from '@/components/calculo/Demonstrativo.vue'
import MemoriaInss from '@/components/calculo/MemoriaInss.vue'
import MemoriaIrrf from '@/components/calculo/MemoriaIrrf.vue'
import ResumoValores from '@/components/calculo/ResumoValores.vue'
import UiAlert from '@/components/ui/UiAlert.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiEmptyState from '@/components/ui/UiEmptyState.vue'
import UiField from '@/components/ui/UiField.vue'
import UiFormGroup from '@/components/ui/UiFormGroup.vue'
import UiIcon from '@/components/ui/UiIcon.vue'
import UiDateInput from '@/components/ui/UiDateInput.vue'
import UiInfo from '@/components/ui/UiInfo.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiMoneyInput from '@/components/ui/UiMoneyInput.vue'
import UiSwitch from '@/components/ui/UiSwitch.vue'
import UiTabs from '@/components/ui/UiTabs.vue'

import { formatarData, lerData, nomeCompetencia } from '@/domain/datas'
import { formatarMoeda, formatarPercentual } from '@/domain/dinheiro'
import { calcularFerias, separarCompetencias } from '@/domain/ferias'
import { ANO_VIGENCIA } from '@/domain/parametros'
import {
  aoAlternarAbono,
  formularioFerias as form,
  formularioFeriasPadrao,
  interpretarFerias,
  sugerirPagamento,
} from '@/features/ferias'
import { useAtalhos } from '@/lib/teclado'
import { useAvisos } from '@/stores/avisos'
import { useConferencias } from '@/stores/conferencias'
import { useParametros } from '@/stores/parametros'

const route = useRoute()
const router = useRouter()
const { tabelaInss, tabelaIrrf } = useParametros()
const conferencias = useConferencias()
const { avisar } = useAvisos()

const leitura = computed(() => interpretarFerias(form))
const erros = computed(() => leitura.value.erros)

const resultado = computed(() =>
  leitura.value.entrada ? calcularFerias(leitura.value.entrada, tabelaInss.value, tabelaIrrf.value) : null,
)

const textoPeriodo = computed(() => {
  const { fim } = leitura.value
  const inicio = lerData(form.dataInicio)

  if (!fim || !inicio || erros.value.diasFerias) {
    return 'Término calculado automaticamente.'
  }

  const quantidade = separarCompetencias(inicio, Number(form.diasFerias)).length

  return `Término em ${formatarData(fim)} · ${quantidade} ${quantidade === 1 ? 'competência' : 'competências'}.`
})

const aba = ref('inss')

const abas = computed(() => [
  { id: 'inss', rotulo: 'INSS por competência', contador: resultado.value?.competencias.length },
  { id: 'irrf', rotulo: 'Memória do IRRF' },
  { id: 'formulas', rotulo: 'Fórmulas' },
])

const linhas = computed<LinhaDemonstrativo[]>(() => {
  const r = resultado.value

  if (!r) return []

  const { entrada } = r
  const lista: LinhaDemonstrativo[] = [
    {
      descricao: 'Férias gozadas',
      detalhe: `${formatarMoeda(entrada.salario)} ÷ 30 × ${entrada.diasFerias}`,
      referencia: `${entrada.diasFerias} dias`,
      provento: r.salarioFerias,
    },
  ]

  if (r.mediasFerias > 0) {
    lista.push({ descricao: 'Médias e adicionais sobre férias', provento: r.mediasFerias })
  }

  lista.push({ descricao: '1/3 constitucional', referencia: '1/3', provento: r.terco })

  if (entrada.diasAbono > 0) {
    lista.push({
      descricao: 'Abono pecuniário',
      detalhe: `${formatarMoeda(entrada.salario)} ÷ 30 × ${entrada.diasAbono}`,
      referencia: `${entrada.diasAbono} dias`,
      provento: r.salarioAbono,
      isenta: true,
    })

    if (r.mediasAbono > 0) {
      lista.push({ descricao: 'Médias sobre abono', provento: r.mediasAbono, isenta: true })
    }

    lista.push({
      descricao: '1/3 sobre abono',
      detalhe: 'Tributável pelo IRRF',
      referencia: '1/3',
      provento: r.tercoAbono,
    })
  }

  lista.push(
    {
      descricao: 'INSS sobre férias',
      detalhe: r.usouInssManual ? `Valor informado · estimado ${formatarMoeda(r.inssEstimado)}` : undefined,
      referencia: r.usouInssManual ? 'Manual' : `${r.competencias.length} comp.`,
      desconto: r.inssUsado,
    },
    {
      descricao: 'IRRF sobre férias',
      detalhe: r.irrf.escolhida.nome,
      referencia: r.irrf.escolhida.faixa.aliquota === 0 ? 'Isento' : formatarPercentual(r.irrf.escolhida.faixa.aliquota),
      desconto: r.irrf.escolhida.irrf,
    },
  )

  return lista
})

const formulas = computed(() => {
  const r = resultado.value

  if (!r) return []

  const { entrada } = r
  const m = formatarMoeda
  const lista = [
    { rotulo: 'Férias', valor: `${m(entrada.salario)} ÷ 30 × ${entrada.diasFerias} = ${m(r.salarioFerias)}; + médias ${m(r.mediasFerias)} = ${m(r.ferias)}` },
    { rotulo: '1/3 constitucional', valor: `(${m(r.salarioFerias)} + ${m(r.mediasFerias)}) ÷ 3 = ${m(r.terco)}` },
    { rotulo: 'Base do INSS', valor: `${m(r.ferias)} + ${m(r.terco)} = ${m(r.tributavel)}` },
    {
      rotulo: 'Rendimento do IRRF',
      valor: `${m(r.tributavel)} + 1/3 do abono ${m(r.tercoAbono)} = ${m(r.rendimentoIrrf)}`,
    },
  ]

  if (entrada.diasAbono > 0) {
    lista.push({
      rotulo: 'Abono pecuniário',
      valor:
        `${m(entrada.salario)} ÷ 30 × ${entrada.diasAbono} = ${m(r.salarioAbono)}; ` +
        `médias ${m(entrada.medias)} × ${entrada.diasAbono} ÷ ${entrada.diasFerias} = ${m(r.mediasAbono)}; ` +
        `abono isento ${m(r.abono)}; 1/3 do abono (tributável pelo IRRF) = ${m(r.tercoAbono)}`,
    })
  }

  lista.push(
    { rotulo: 'Total bruto', valor: `${m(r.tributavel)} + ${m(r.totalAbono)} = ${m(r.totalBruto)}` },
    { rotulo: 'Valor líquido', valor: `${m(r.totalBruto)} − ${m(r.inssUsado)} − ${m(r.irrf.escolhida.irrf)} = ${m(r.liquido)}` },
  )

  return lista
})

const totaisCompetencias = computed(() => {
  const lista = resultado.value?.competencias ?? []
  const somar = (campo: 'dias' | 'salario' | 'medias' | 'terco' | 'base') =>
    lista.reduce((soma, item) => soma + item[campo], 0)

  return { dias: somar('dias'), salario: somar('salario'), medias: somar('medias'), terco: somar('terco'), base: somar('base') }
})

function aoMudarInicio() {
  sugerirPagamento(form)
}

function aoMudarPagamento() {
  form.pagamentoAutomatico = false
}

function limpar() {
  Object.assign(form, formularioFeriasPadrao())
  document.getElementById('ferias-salario')?.focus()
}

useAtalhos([{ tecla: 's', ctrl: true, acao: () => salvar() }])

function salvar() {
  const r = resultado.value

  if (!r) return

  const { entrada } = r

  conferencias.salvar({
    tipo: 'ferias',
    referencia: form.referencia.trim() || 'Sem identificação',
    formulario: { ...form },
    resumo: {
      detalhe:
        `${formatarData(entrada.inicio)} a ${formatarData(entrada.fim)} · ${entrada.diasFerias} dias` +
        (entrada.diasAbono ? ` + ${entrada.diasAbono} vendidos` : ''),
      bruto: r.totalBruto,
      inss: r.inssUsado,
      irrf: r.irrf.escolhida.irrf,
      liquido: r.liquido,
      inssInformado: null,
      diferencaInss: null,
    },
  })

  avisar('Conferência salva em Registros.')
}

watch(
  () => route.query.conferencia,
  (id) => {
    if (typeof id !== 'string') return

    const salva = conferencias.obter(id)

    if (salva?.tipo === 'ferias') {
      Object.assign(form, formularioFeriasPadrao(), salva.formulario)
      avisar(`Conferência "${salva.referencia}" carregada.`, 'info')
    }

    router.replace({ name: 'ferias' })
  },
  { immediate: true },
)
</script>

<template>
  <PageHeader>
    <template #acoes>
      <UiButton variante="discreto" icone="reiniciar" @click="limpar">Limpar</UiButton>
      <UiButton variante="primario" icone="salvar" :disabled="!resultado" @click="salvar">Salvar conferência</UiButton>
    </template>
  </PageHeader>

  <div class="grid items-start gap-6 pb-20 lg:grid-cols-[360px_minmax(0,1fr)] lg:pb-0 xl:grid-cols-[400px_minmax(0,1fr)] 2xl:grid-cols-[440px_minmax(0,1fr)]">
    <form v-navegar-enter class="vidro rounded-lg" novalidate aria-label="Dados das férias" @submit.prevent>
      <UiFormGroup titulo="Remuneração">
        <UiField id="ferias-referencia" rotulo="Funcionário ou referência" opcional class="col-span-2">
          <template #default="{ id }">
            <UiInput :id="id" v-model="form.referencia" autocomplete="off" />
          </template>
        </UiField>

        <UiField id="ferias-salario" rotulo="Salário bruto" :erro="erros.salario">
          <template #default="{ id, descricao, invalido }">
            <UiMoneyInput :id="id" v-model="form.salario" placeholder="0,00" :invalido="invalido" :aria-describedby="descricao" autofocus />
          </template>
        </UiField>

        <UiField
          id="ferias-medias"
          rotulo="Médias"
          opcional
          ajuda="Valor total de horas extras, comissões e adicionais habituais referente aos dias gozados. O abono usa a mesma média diária."
          :erro="erros.medias"
        >
          <template #default="{ id, descricao, invalido }">
            <UiMoneyInput :id="id" v-model="form.medias" placeholder="0,00" :invalido="invalido" :aria-describedby="descricao" />
          </template>
        </UiField>
      </UiFormGroup>

      <UiFormGroup titulo="Período" :descricao="`Gozo e pagamento devem ocorrer em ${ANO_VIGENCIA}, ano das tabelas vigentes.`">
        <UiField id="ferias-dias" rotulo="Dias de gozo" :erro="erros.diasFerias">
          <template #default="{ id, descricao, invalido }">
            <UiInput :id="id" v-model="form.diasFerias" type="number" min="1" max="30" step="1" sufixo="dias" :invalido="invalido" :aria-describedby="descricao" />
          </template>
        </UiField>

        <UiField id="ferias-dependentes" rotulo="Dependentes (IRRF)" :erro="erros.dependentes">
          <template #default="{ id, descricao, invalido }">
            <UiInput :id="id" v-model="form.dependentes" type="number" min="0" max="99" step="1" :invalido="invalido" :aria-describedby="descricao" />
          </template>
        </UiField>

        <UiField id="ferias-inicio" rotulo="Início do gozo" :ajuda="textoPeriodo" :erro="erros.dataInicio">
          <template #default="{ id, descricao, invalido }">
            <UiDateInput
              :id="id"
              v-model="form.dataInicio"
              :min="`${ANO_VIGENCIA}-01-01`"
              :max="`${ANO_VIGENCIA}-12-31`"
              :invalido="invalido"
              :aria-describedby="descricao"
              @change="aoMudarInicio"
            />
          </template>
        </UiField>

        <UiField
          id="ferias-pagamento"
          rotulo="Pagamento"
          :ajuda="form.pagamentoAutomatico ? 'Sugerido 2 dias antes do início.' : 'Definido manualmente.'"
          :erro="erros.dataPagamento"
        >
          <template #default="{ id, descricao, invalido }">
            <UiDateInput
              :id="id"
              v-model="form.dataPagamento"
              :min="`${ANO_VIGENCIA}-01-01`"
              :max="`${ANO_VIGENCIA}-12-31`"
              :invalido="invalido"
              :aria-describedby="descricao"
              @change="aoMudarPagamento"
            />
          </template>
        </UiField>
      </UiFormGroup>

      <UiFormGroup titulo="Abono pecuniário" descricao="Venda de até 10 dias. O abono é isento de INSS e IRRF; o 1/3 sobre o abono entra na base do IRRF.">
        <UiSwitch
          id="ferias-abono"
          v-model="form.possuiAbono"
          rotulo="Vender dias"
          class="campo-switch"
          @change="aoAlternarAbono(form)"
        />

        <UiField id="ferias-dias-abono" rotulo="Dias vendidos" :erro="erros.diasAbono">
          <template #default="{ id, descricao, invalido }">
            <UiInput
              :id="id"
              v-model="form.diasAbono"
              type="number"
              min="1"
              max="10"
              step="1"
              sufixo="dias"
              :disabled="!form.possuiAbono"
              :invalido="invalido"
              :aria-describedby="descricao"
            />
          </template>
        </UiField>
      </UiFormGroup>

      <UiFormGroup
        titulo="Conferência avançada"
        recolhivel
        :aberto="Boolean(form.inssManual)"
      >
        <UiField
          id="ferias-inss-manual"
          rotulo="INSS informado no recibo"
          opcional
          ajuda="Substitui o INSS estimado quando a folha considera outras verbas da mesma competência."
          :erro="erros.inssManual"
          class="col-span-2"
        >
          <template #default="{ id, descricao, invalido }">
            <UiMoneyInput :id="id" v-model="form.inssManual" placeholder="Usar INSS estimado" :invalido="invalido" :aria-describedby="descricao" />
          </template>
        </UiField>
      </UiFormGroup>
    </form>

    <div id="resultado" class="min-w-0 scroll-mt-20 space-y-6" aria-live="polite">
      <div v-if="!resultado" class="vidro vidro--tracejado rounded-lg">
        <UiEmptyState
          icone="ferias"
          :titulo="leitura.pendentes.length ? 'Complete os dados das férias' : 'Revise os campos destacados'"
        >
          <ul v-if="leitura.pendentes.length" class="mx-auto w-fit space-y-1.5 text-left text-sm">
            <li v-for="item in leitura.pendentes" :key="item" class="flex items-center gap-2 text-ink-2">
              <span class="size-1.5 rounded-full bg-line-strong" aria-hidden="true" />
              {{ item }}
            </li>
          </ul>
        </UiEmptyState>
      </div>

      <template v-else>
        <ResumoValores
          :itens="[
            { rotulo: 'Total bruto', valor: resultado.totalBruto },
            { rotulo: 'INSS', valor: resultado.inssUsado, sinal: '-' },
            { rotulo: 'IRRF', valor: resultado.irrf.escolhida.irrf, sinal: '-' },
            { rotulo: 'Valor líquido', valor: resultado.liquido, destaque: true },
          ]"
        />

        <UiAlert v-if="resultado.usouInssManual" tom="info">
          INSS calculado pelas competências: {{ formatarMoeda(resultado.inssEstimado) }}. No recibo foi usado o valor
          informado de {{ formatarMoeda(resultado.inssUsado) }}.
        </UiAlert>

        <Demonstrativo
          :linhas="linhas"
          :total-proventos="resultado.totalBruto"
          :total-descontos="resultado.totalDescontos"
          :liquido="resultado.liquido"
          :subtitulo="`Gozo de ${formatarData(resultado.entrada.inicio)} a ${formatarData(resultado.entrada.fim)} · pagamento em ${formatarData(resultado.entrada.pagamento)}`"
          :bases="[
            { rotulo: 'Base do INSS (férias + 1/3)', valor: resultado.tributavel },
            { rotulo: 'Rendimento do IRRF (inclui 1/3 do abono)', valor: resultado.rendimentoIrrf },
            { rotulo: 'Base de cálculo do IRRF', valor: resultado.irrf.escolhida.base },
            { rotulo: 'Verbas isentas (abono)', valor: resultado.abono },
          ]"
        />

        <section class="vidro rounded-lg">
          <UiTabs v-model="aba" :abas="abas" rotulo="Memória de cálculo">
            <template #default="{ ativa }">
              <div v-if="ativa === 'inss'" class="space-y-4 p-5">
                <div class="overflow-x-auto rounded-md border border-line">
                  <table class="tabela min-w-[600px] [&_td]:px-3 [&_th]:px-3">
                    <caption class="sr-only">INSS das férias por competência</caption>
                    <thead>
                      <tr>
                        <th scope="col">
                          <span class="inline-flex items-center gap-1.5">
                            Competência
                            <UiInfo texto="O valor tributável das férias, incluindo o 1/3, é distribuído conforme os dias gozados em cada mês, e o INSS é calculado separadamente por competência." />
                          </span>
                        </th>
                        <th scope="col" class="num">Dias</th>
                        <th scope="col" class="num">Salário</th>
                        <th scope="col" class="num">Médias</th>
                        <th scope="col" class="num">1/3</th>
                        <th scope="col" class="num">Base INSS</th>
                        <th scope="col" class="num">INSS</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="item in resultado.competencias" :key="item.chave">
                        <td class="font-medium whitespace-nowrap text-ink">{{ nomeCompetencia(item.chave) }}</td>
                        <td class="num">{{ item.dias }}</td>
                        <td class="num">{{ formatarMoeda(item.salario) }}</td>
                        <td class="num">{{ formatarMoeda(item.medias) }}</td>
                        <td class="num">{{ formatarMoeda(item.terco) }}</td>
                        <td class="num">{{ formatarMoeda(item.base) }}</td>
                        <td class="num font-medium text-ink">{{ formatarMoeda(item.inss.total) }}</td>
                      </tr>
                    </tbody>
                    <tfoot>
                      <tr>
                        <th scope="row" class="text-left">Total estimado</th>
                        <td class="num">{{ totaisCompetencias.dias }}</td>
                        <td class="num">{{ formatarMoeda(totaisCompetencias.salario) }}</td>
                        <td class="num">{{ formatarMoeda(totaisCompetencias.medias) }}</td>
                        <td class="num">{{ formatarMoeda(totaisCompetencias.terco) }}</td>
                        <td class="num">{{ formatarMoeda(totaisCompetencias.base) }}</td>
                        <td class="num">{{ formatarMoeda(resultado.inssEstimado) }}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <details
                  v-for="item in resultado.competencias"
                  :key="`faixas-${item.chave}`"
                  class="group rounded-md border border-line"
                >
                  <summary
                    class="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 text-[13px] font-medium text-ink-2 hover:bg-subtle focus-visible:outline-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden"
                  >
                    <span class="flex items-center gap-2">
                      <UiIcon nome="seta" :tamanho="15" class="text-muted transition-transform group-open:rotate-90" />
                      Faixas do INSS em {{ nomeCompetencia(item.chave).toLowerCase() }}
                    </span>
                    <span class="num text-muted">{{ formatarMoeda(item.inss.total) }}</span>
                  </summary>
                  <div class="border-t border-line p-4">
                    <MemoriaInss :resultado="item.inss" />
                  </div>
                </details>
              </div>

              <div v-else-if="ativa === 'irrf'" class="p-5">
                <MemoriaIrrf
                  :irrf="resultado.irrf"
                  rotulo-rendimento="Rendimento tributável das férias"
                  :rotulo-inss="resultado.usouInssManual ? 'INSS informado' : 'INSS das férias'"
                />
              </div>

              <dl v-else class="divide-y divide-line">
                <div v-for="item in formulas" :key="item.rotulo" class="grid gap-1 px-5 py-3 text-[13px] sm:grid-cols-[180px_1fr]">
                  <dt class="text-muted">{{ item.rotulo }}</dt>
                  <dd class="num text-ink">{{ item.valor }}</dd>
                </div>
              </dl>
            </template>
          </UiTabs>
        </section>
      </template>
    </div>
  </div>

  <BarraResultadoMovel v-if="resultado" alvo="resultado" :liquido="resultado.liquido" />
</template>
