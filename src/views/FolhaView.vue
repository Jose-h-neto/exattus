<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import PageHeader from '@/components/layout/PageHeader.vue'
import BarraResultadoMovel from '@/components/calculo/BarraResultadoMovel.vue'
import ConferenciaHolerite from '@/components/calculo/ConferenciaHolerite.vue'
import Demonstrativo, { type LinhaDemonstrativo } from '@/components/calculo/Demonstrativo.vue'
import HorasExtrasHoras from '@/components/calculo/HorasExtrasHoras.vue'
import MemoriaInss from '@/components/calculo/MemoriaInss.vue'
import MemoriaIrrf from '@/components/calculo/MemoriaIrrf.vue'
import ResumoValores from '@/components/calculo/ResumoValores.vue'
import UiAlert from '@/components/ui/UiAlert.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiEmptyState from '@/components/ui/UiEmptyState.vue'
import UiField from '@/components/ui/UiField.vue'
import UiFormGroup from '@/components/ui/UiFormGroup.vue'
import type { NomeIcone } from '@/components/ui/UiIcon.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiMoneyInput from '@/components/ui/UiMoneyInput.vue'
import UiSegmented from '@/components/ui/UiSegmented.vue'
import UiTabs from '@/components/ui/UiTabs.vue'

import { formatarMoeda, formatarPercentual } from '@/domain/dinheiro'
import { calcularFolha } from '@/domain/folha'
import { formatarAdicional, formatarHoras } from '@/domain/horasExtras'
import type { Modalidade } from '@/domain/inss'
import {
  copiarFormularioFolha,
  formularioFolha as form,
  formularioFolhaPadrao,
  interpretarFolha,
  type ModoHorasExtras,
} from '@/features/folha'
import { useAtalhos } from '@/lib/teclado'
import { useAvisos } from '@/stores/avisos'
import { useConferencias } from '@/stores/conferencias'
import { useParametros } from '@/stores/parametros'

const route = useRoute()
const router = useRouter()
const { tabelaInss, tabelaIrrf } = useParametros()
const conferencias = useConferencias()
const { avisar } = useAvisos()

const modalidades: { valor: Modalidade; rotulo: string }[] = [
  { valor: 'empregado', rotulo: 'Empregado' },
  { valor: 'prolabore', rotulo: 'Pró-labore' },
]

const modosHorasExtras: { valor: ModoHorasExtras; rotulo: string; icone: NomeIcone }[] = [
  { valor: 'valor', rotulo: 'Valor', icone: 'dinheiro' },
  { valor: 'horas', rotulo: 'Horas', icone: 'relogio' },
]

/** Abre o grupo de ajustes quando ha valores preenchidos (ex.: conferencia reaberta). */
const temAjustes = computed(() => Boolean(form.baseInssManual || form.inssInformado || form.irrfInformado))

const leitura = computed(() => interpretarFolha(form))
const erros = computed(() => leitura.value.erros)

const resultado = computed(() =>
  leitura.value.entrada ? calcularFolha(leitura.value.entrada, tabelaInss.value, tabelaIrrf.value) : null,
)

/** Com horas extras, comissoes ou DSR, o resumo passa a mostrar o total de proventos. */
const rotuloProventos = computed(() =>
  resultado.value && resultado.value.totalProventos !== resultado.value.proporcional
    ? 'Total de proventos'
    : 'Salário proporcional',
)

const aba = ref('inss')

const abas = computed(() => [
  { id: 'inss', rotulo: 'Memória do INSS' },
  { id: 'irrf', rotulo: 'Memória do IRRF' },
])

/** Em horas, uma linha por adicional, como no holerite; em valor, uma linha so. */
function linhasHorasExtras(total: number): LinhaDemonstrativo[] {
  const calculo = leitura.value.horasExtras?.resultado

  if (!calculo) {
    return total > 0 ? [{ descricao: 'Horas extras', provento: total }] : []
  }

  return calculo.linhas
    .filter((linha) => linha.minutos > 0)
    .map((linha) => ({
      descricao: `Horas extras ${formatarAdicional(linha.adicional)}`,
      detalhe: `Valor-hora ${formatarMoeda(calculo.valorHora)} · divisor ${calculo.entrada.divisor}`,
      referencia: formatarHoras(linha.minutos),
      provento: linha.valor,
    }))
}

const linhas = computed<LinhaDemonstrativo[]>(() => {
  const r = resultado.value

  if (!r) return []

  const aliquotaEfetiva = r.inss.baseConsiderada > 0 ? Math.round((r.inss.total / r.inss.baseConsiderada) * 10000) : 0
  const irrf = r.irrf.escolhida

  return [
    {
      descricao: r.entrada.modalidade === 'prolabore' ? 'Pró-labore' : 'Salário',
      detalhe:
        r.entrada.dias === 30
          ? `Mês completo · valor-dia ${formatarMoeda(r.valorDia)}`
          : `${formatarMoeda(r.entrada.salario)} ÷ 30 × ${r.entrada.dias} dias · valor-dia ${formatarMoeda(r.valorDia)}`,
      referencia: `${r.entrada.dias} dias`,
      provento: r.proporcional,
    },
    ...linhasHorasExtras(r.entrada.horasExtras),
    ...(r.entrada.comissoes > 0 ? [{ descricao: 'Comissões', provento: r.entrada.comissoes }] : []),
    ...(r.entrada.dsr > 0 ? [{ descricao: 'DSR', detalhe: 'Sobre horas extras e comissões', provento: r.entrada.dsr }] : []),
    {
      descricao: r.entrada.modalidade === 'prolabore' ? 'INSS sobre pró-labore' : 'INSS',
      detalhe: r.entrada.baseInssManual !== null ? 'Base informada manualmente' : undefined,
      referencia:
        r.entrada.modalidade === 'prolabore'
          ? formatarPercentual(r.inss.aliquota ?? 0)
          : `${formatarPercentual(aliquotaEfetiva)} efetiva`,
      desconto: r.inss.total,
    },
    {
      descricao: 'IRRF',
      detalhe: `${irrf.nome}${irrf.reducao.valor > 0 ? ' · com redução da Lei nº 15.270/2025' : ''}`,
      referencia: irrf.faixa.aliquota === 0 ? 'Isento' : formatarPercentual(irrf.faixa.aliquota),
      desconto: irrf.irrf,
    },
    // Depois dos tributos: so reduzem o liquido.
    ...(r.entrada.adiantamentoSalarial > 0
      ? [{ descricao: 'Adiantamento salarial', detalhe: 'Fora das bases de INSS e IRRF', desconto: r.entrada.adiantamentoSalarial }]
      : []),
    ...(r.entrada.adiantamentoFerias > 0
      ? [{ descricao: 'Adiantamento de férias', detalhe: 'Líquido das férias pago antes · fora das bases', desconto: r.entrada.adiantamentoFerias }]
      : []),
  ]
})

const linhasConferencia = computed(() => {
  const r = resultado.value
  const linhasValidas = []

  if (r?.conferenciaInss) linhasValidas.push({ tributo: 'INSS', conferencia: r.conferenciaInss })
  if (r?.conferenciaIrrf) linhasValidas.push({ tributo: 'IRRF', conferencia: r.conferenciaIrrf })

  return linhasValidas
})

function limpar() {
  Object.assign(form, formularioFolhaPadrao())
  document.getElementById('folha-salario')?.focus()
}

useAtalhos([{ tecla: 's', ctrl: true, acao: () => salvar() }])

function salvar() {
  const r = resultado.value

  if (!r) return

  conferencias.salvar({
    tipo: 'folha',
    referencia: form.referencia.trim() || 'Sem identificação',
    formulario: copiarFormularioFolha(form),
    resumo: {
      detalhe: [
        r.entrada.modalidade === 'prolabore' ? 'Pró-labore' : 'Empregado',
        `${r.entrada.dias} dias`,
        r.entrada.horasExtras > 0 ? 'horas extras' : '',
        r.entrada.comissoes > 0 ? 'comissões' : '',
        r.entrada.dsr > 0 ? 'DSR' : '',
        r.adiantamentos > 0 ? 'adiantamento' : '',
      ].filter(Boolean).join(' · '),
      bruto: r.totalProventos,
      inss: r.inss.total,
      irrf: r.irrf.escolhida.irrf,
      liquido: r.liquido,
      inssInformado: r.conferenciaInss?.informado ?? null,
      diferencaInss: r.conferenciaInss?.diferenca ?? null,
    },
  })

  avisar('Conferência salva em Registros.')
}

/** Reabre uma conferencia salva: /folha?conferencia=<id> */
watch(
  () => route.query.conferencia,
  (id) => {
    if (typeof id !== 'string') return

    const salva = conferencias.obter(id)

    if (salva?.tipo === 'folha') {
      Object.assign(form, formularioFolhaPadrao(), copiarFormularioFolha(salva.formulario))
      avisar(`Conferência "${salva.referencia}" carregada.`, 'info')
    }

    router.replace({ name: 'folha' })
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
    <form v-navegar-enter
      class="vidro rounded-lg"
      novalidate
      aria-label="Dados da folha"
      @submit.prevent
    >
      <UiFormGroup titulo="Dados do cálculo" descricao="O salário proporcional considera sempre o mês comercial de 30 dias.">
        <UiField id="folha-referencia" rotulo="Funcionário ou referência" opcional class="col-span-2">
          <template #default="{ id }">
            <UiInput :id="id" v-model="form.referencia" placeholder="José, junho/2026" autocomplete="off" />
          </template>
        </UiField>

        <UiSegmented v-model="form.modalidade" nome="folha-modalidade" rotulo="Vínculo" :opcoes="modalidades" class="col-span-2" />

        <UiField id="folha-salario" rotulo="Salário bruto" :erro="erros.salario">
          <template #default="{ id, descricao, invalido }">
            <UiMoneyInput :id="id" v-model="form.salario" placeholder="0,00" :invalido="invalido" :aria-describedby="descricao" autofocus />
          </template>
        </UiField>

        <UiField id="folha-dias" rotulo="Dias trabalhados" :erro="erros.dias">
          <template #default="{ id, descricao, invalido }">
            <UiInput :id="id" v-model="form.dias" type="number" min="0" max="30" step="1" sufixo="de 30" :invalido="invalido" :aria-describedby="descricao" />
          </template>
        </UiField>

        <template v-if="form.modalidade === 'empregado'">
          <UiField
            id="folha-horas-extras"
            rotulo="Horas extras"
            :opcional="form.horasExtrasModo === 'valor'"
            :grupo="form.horasExtrasModo === 'horas'"
            :ajuda="
              form.horasExtrasModo === 'valor'
                ? 'Valor total do mês, somado ao salário. Não é proporcionalizado pelos dias trabalhados.'
                : 'Base ÷ divisor × horas × (100% + adicional). O arredondamento é feito uma vez em cada linha; se a folha arredondar o valor-hora antes, pode haver diferença de centavos.'
            "
            :erro="form.horasExtrasModo === 'valor' ? erros.horasExtras : undefined"
            class="col-span-2"
          >
            <template #acao>
              <UiSegmented v-model="form.horasExtrasModo" compacto nome="folha-he-modo" rotulo="Informar horas extras em" :opcoes="modosHorasExtras" />
            </template>
            <template #default="{ id, descricao, invalido }">
              <UiMoneyInput
                v-if="form.horasExtrasModo === 'valor'"
                :id="id"
                v-model="form.horasExtras"
                placeholder="0,00"
                :invalido="invalido"
                :aria-describedby="descricao"
              />
              <HorasExtrasHoras
                v-else
                v-model:linhas="form.horasExtrasLinhas"
                v-model:base="form.baseValorHora"
                v-model:divisor="form.divisor"
                :leitura="leitura.horasExtras"
                :erro-base="erros.baseValorHora"
                :erro-divisor="erros.divisor"
                :rotulado-por="`${id}-rotulo`"
              />
            </template>
          </UiField>

          <UiField
            id="folha-comissoes"
            rotulo="Comissões"
            opcional
            ajuda="Valor total do mês, somado ao salário. Não é proporcionalizado pelos dias trabalhados."
            :erro="erros.comissoes"
          >
            <template #default="{ id, descricao, invalido }">
              <UiMoneyInput :id="id" v-model="form.comissoes" placeholder="0,00" :invalido="invalido" :aria-describedby="descricao" />
            </template>
          </UiField>

          <UiField
            id="folha-dsr"
            rotulo="DSR"
            opcional
            ajuda="Descanso semanal remunerado sobre horas extras e comissões, como consta no holerite."
            :erro="erros.dsr"
          >
            <template #default="{ id, descricao, invalido }">
              <UiMoneyInput :id="id" v-model="form.dsr" placeholder="0,00" :invalido="invalido" :aria-describedby="descricao" />
            </template>
          </UiField>
        </template>

        <UiField id="folha-dependentes" rotulo="Dependentes (IRRF)" :erro="erros.dependentes">
          <template #default="{ id, descricao, invalido }">
            <UiInput :id="id" v-model="form.dependentes" type="number" min="0" max="99" step="1" :invalido="invalido" :aria-describedby="descricao" />
          </template>
        </UiField>
      </UiFormGroup>

      <UiFormGroup
        titulo="Adiantamentos"
        descricao="Valores já pagos no mês. São descontados do líquido depois do INSS e do IRRF e não alteram as bases de cálculo."
      >
        <UiField
          id="folha-adiantamento"
          rotulo="Adiantamento salarial"
          ajuda="Opcional. Vale ou adiantamento quinzenal pago no mês."
          :erro="erros.adiantamentoSalarial"
          :class="form.modalidade === 'empregado' ? '' : 'col-span-2'"
        >
          <template #default="{ id, descricao, invalido }">
            <UiMoneyInput :id="id" v-model="form.adiantamentoSalarial" placeholder="0,00" :invalido="invalido" :aria-describedby="descricao" />
          </template>
        </UiField>

        <UiField
          v-if="form.modalidade === 'empregado'"
          id="folha-adiantamento-ferias"
          rotulo="Adiantamento de férias"
          ajuda="Opcional. Líquido das férias pago antes do início do gozo, que a folha do mês desconta."
          :erro="erros.adiantamentoFerias"
        >
          <template #default="{ id, descricao, invalido }">
            <UiMoneyInput :id="id" v-model="form.adiantamentoFerias" placeholder="0,00" :invalido="invalido" :aria-describedby="descricao" />
          </template>
        </UiField>
      </UiFormGroup>

      <UiFormGroup
        titulo="Ajustes e conferência do holerite"
        recolhivel
        :aberto="temAjustes"
      >
        <UiField
          id="folha-base-inss"
          rotulo="Base do INSS"
          opcional
          ajuda="Quando diferente do total de proventos (salário proporcional + horas extras + comissões + DSR)."
          :erro="erros.baseInssManual"
          class="col-span-2"
        >
          <template #default="{ id, descricao, invalido }">
            <UiMoneyInput :id="id" v-model="form.baseInssManual" placeholder="Total de proventos" :invalido="invalido" :aria-describedby="descricao" />
          </template>
        </UiField>

        <UiField id="folha-inss-informado" rotulo="INSS do holerite" opcional :erro="erros.inssInformado">
          <template #default="{ id, descricao, invalido }">
            <UiMoneyInput :id="id" v-model="form.inssInformado" placeholder="0,00" :invalido="invalido" :aria-describedby="descricao" />
          </template>
        </UiField>

        <UiField id="folha-irrf-informado" rotulo="IRRF do holerite" opcional :erro="erros.irrfInformado">
          <template #default="{ id, descricao, invalido }">
            <UiMoneyInput :id="id" v-model="form.irrfInformado" placeholder="0,00" :invalido="invalido" :aria-describedby="descricao" />
          </template>
        </UiField>
      </UiFormGroup>
    </form>

    <div id="resultado" class="min-w-0 scroll-mt-20 space-y-6" aria-live="polite">
      <div v-if="!resultado" class="vidro vidro--tracejado rounded-lg">
        <UiEmptyState
          icone="calculadora"
          :titulo="leitura.vazio ? 'Informe o salário para iniciar' : 'Revise os campos destacados'"
        />
      </div>

      <template v-else>
        <ResumoValores
          :itens="[
            { rotulo: rotuloProventos, valor: resultado.totalProventos },
            { rotulo: 'INSS', valor: resultado.inss.total, sinal: '-' },
            { rotulo: 'IRRF', valor: resultado.irrf.escolhida.irrf, sinal: '-' },
            { rotulo: 'Valor líquido', valor: resultado.liquido, destaque: true },
          ]"
        />

        <UiAlert v-if="resultado.liquido < 0" tom="atencao">
          Os descontos superam os proventos: o líquido ficou negativo. Confira os adiantamentos informados.
        </UiAlert>

        <UiAlert v-if="resultado.inss.limitado" tom="atencao">
          A base do INSS ({{ formatarMoeda(resultado.inss.base) }}) ultrapassa o teto de
          {{ formatarMoeda(resultado.inss.teto) }}; a contribuição foi limitada ao teto.
        </UiAlert>

        <Demonstrativo
          :linhas="linhas"
          :total-proventos="resultado.totalProventos"
          :total-descontos="resultado.totalDescontos"
          :liquido="resultado.liquido"
          :subtitulo="form.referencia.trim() || undefined"
          :bases="[
            { rotulo: 'Salário de contribuição (INSS)', valor: resultado.inss.baseConsiderada },
            { rotulo: 'Rendimento tributável', valor: resultado.irrf.rendimento },
            { rotulo: 'Base de cálculo do IRRF', valor: resultado.irrf.escolhida.base },
          ]"
        />

        <ConferenciaHolerite v-if="linhasConferencia.length" :linhas="linhasConferencia" />

        <section class="vidro rounded-lg">
          <UiTabs v-model="aba" :abas="abas" rotulo="Memória de cálculo">
            <template #default="{ ativa }">
              <div class="p-5">
                <MemoriaInss v-if="ativa === 'inss'" :resultado="resultado.inss" />
                <MemoriaIrrf v-else :irrf="resultado.irrf" :rotulo-rendimento="rotuloProventos" />
              </div>
            </template>
          </UiTabs>
        </section>
      </template>
    </div>
  </div>

  <BarraResultadoMovel v-if="resultado" alvo="resultado" :liquido="resultado.liquido" />
</template>
