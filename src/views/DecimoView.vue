<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import PageHeader from '@/components/layout/PageHeader.vue'
import BarraResultadoMovel from '@/components/calculo/BarraResultadoMovel.vue'
import ConferenciaHolerite from '@/components/calculo/ConferenciaHolerite.vue'
import Demonstrativo, { type LinhaDemonstrativo } from '@/components/calculo/Demonstrativo.vue'
import MemoriaInss from '@/components/calculo/MemoriaInss.vue'
import MemoriaIrrf from '@/components/calculo/MemoriaIrrf.vue'
import ResumoValores from '@/components/calculo/ResumoValores.vue'
import UiAlert from '@/components/ui/UiAlert.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiEmptyState from '@/components/ui/UiEmptyState.vue'
import UiField from '@/components/ui/UiField.vue'
import UiFormGroup from '@/components/ui/UiFormGroup.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiMoneyInput from '@/components/ui/UiMoneyInput.vue'
import UiSegmented from '@/components/ui/UiSegmented.vue'
import UiTabs from '@/components/ui/UiTabs.vue'

import { calcularDecimo, ROTULO_PARCELA, type ParcelaDecimo } from '@/domain/decimo'
import { formatarDecimal, formatarMoeda, formatarPercentual } from '@/domain/dinheiro'
import { encargoFgts } from '@/domain/fgts'
import { formularioDecimo as form, formularioDecimoPadrao, interpretarDecimo } from '@/features/decimo'
import { useAtalhos } from '@/lib/teclado'
import { useAvisos } from '@/stores/avisos'
import { useCofre } from '@/stores/cofre'
import { useConferencias } from '@/stores/conferencias'
import { useParametros } from '@/stores/parametros'

const route = useRoute()
const router = useRouter()
const { tabelaInss, tabelaIrrf } = useParametros()
const conferencias = useConferencias()
const cofre = useCofre()
const { avisar } = useAvisos()

const parcelas: { valor: ParcelaDecimo; rotulo: string }[] = [
  { valor: 'primeira', rotulo: '1ª parcela' },
  { valor: 'segunda', rotulo: '2ª parcela' },
]

const segunda = computed(() => form.parcela === 'segunda')

const leitura = computed(() => interpretarDecimo(form))
const erros = computed(() => leitura.value.erros)

const resultado = computed(() =>
  leitura.value.entrada ? calcularDecimo(leitura.value.entrada, tabelaInss.value, tabelaIrrf.value) : null,
)

const temConferencia = computed(() => Boolean(form.inssInformado || form.irrfInformado))

const aba = ref('formulas')

const abas = computed(() => [
  { id: 'formulas', rotulo: 'Fórmulas' },
  ...(resultado.value?.inss ? [{ id: 'inss', rotulo: 'Memória do INSS' }] : []),
  ...(resultado.value?.irrf ? [{ id: 'irrf', rotulo: 'Memória do IRRF' }] : []),
])

// Ao voltar para a 1a parcela, as abas de INSS e IRRF somem.
watch(abas, (lista) => {
  if (!lista.some((item) => item.id === aba.value)) aba.value = 'formulas'
})

const textoAvos = computed(() => {
  const avos = resultado.value?.entrada.avos

  return avos ? `${avos}/12` : ''
})

const linhas = computed<LinhaDemonstrativo[]>(() => {
  const r = resultado.value

  if (!r) return []

  const conta = `${formatarMoeda(r.remuneracao)} ÷ 12 × ${r.entrada.avos}`

  if (r.entrada.parcela === 'primeira') {
    return [
      {
        descricao: '13º salário · 1ª parcela',
        detalhe: `50% do 13º de ${formatarMoeda(r.integral)} (${conta}) · sem INSS e IRRF`,
        referencia: textoAvos.value,
        provento: r.bruto,
      },
    ]
  }

  const irrf = r.irrf!.escolhida

  return [
    { descricao: '13º salário integral', detalhe: conta, referencia: textoAvos.value, provento: r.integral },
    {
      descricao: 'INSS sobre 13º',
      detalhe: 'Calculado à parte da folha do mês',
      referencia: `base ${formatarMoeda(r.inss!.baseConsiderada)}`,
      desconto: r.inss!.total,
    },
    {
      descricao: 'IRRF sobre 13º',
      detalhe: `Tributação exclusiva · ${irrf.nome}${irrf.reducao.valor > 0 ? ' · com redução da Lei nº 15.270/2025' : ''}`,
      referencia: irrf.faixa.aliquota === 0 ? 'Isento' : formatarPercentual(irrf.faixa.aliquota),
      desconto: irrf.irrf,
    },
    {
      descricao: 'Adiantamento do 13º (1ª parcela)',
      detalhe: r.usouPrimeiraInformada ? 'Valor informado' : 'Metade do 13º calculado',
      desconto: r.adiantamento,
    },
  ]
})

const formulas = computed(() => {
  const r = resultado.value

  if (!r) return []

  const m = formatarMoeda
  const lista = [
    { rotulo: 'Remuneração', valor: `Salário ${m(r.entrada.salario)} + médias ${m(r.entrada.medias)} = ${m(r.remuneracao)}` },
    { rotulo: '13º integral', valor: `${m(r.remuneracao)} ÷ 12 × ${r.entrada.avos} = ${m(r.integral)}` },
    { rotulo: '1ª parcela', valor: `${m(r.integral)} ÷ 2 = ${m(r.primeiraParcela)}` },
  ]

  if (r.entrada.parcela === 'segunda') {
    lista.push(
      { rotulo: 'Base do INSS', valor: `13º integral ${m(r.integral)} (tabela aplicada só ao 13º)` },
      { rotulo: 'Rendimento do IRRF', valor: `${m(r.integral)} − INSS ${m(r.inss!.total)} − dependentes, tributação exclusiva` },
      {
        rotulo: 'Líquido da 2ª parcela',
        valor: `${m(r.integral)} − ${m(r.inss!.total)} − ${m(r.irrf!.escolhida.irrf)} − 1ª parcela ${m(r.adiantamento)} = ${m(r.liquido)}`,
      },
      { rotulo: 'FGTS', valor: `(${m(r.integral)} − ${m(r.adiantamento)}) × ${formatarPercentual(r.fgts.aliquota)} = ${m(r.fgts.valor)}` },
    )
  } else {
    lista.push({ rotulo: 'FGTS', valor: `${m(r.primeiraParcela)} × ${formatarPercentual(r.fgts.aliquota)} = ${m(r.fgts.valor)}` })
  }

  return lista
})

const linhasConferencia = computed(() => {
  const r = resultado.value
  const lista = []

  if (r?.conferenciaInss) lista.push({ tributo: 'INSS', conferencia: r.conferenciaInss })
  if (r?.conferenciaIrrf) lista.push({ tributo: 'IRRF', conferencia: r.conferenciaIrrf })

  return lista
})

function limpar() {
  Object.assign(form, formularioDecimoPadrao())
  document.getElementById('decimo-salario')?.focus()
}

useAtalhos([{ tecla: 's', ctrl: true, acao: () => salvar() }])

function salvar() {
  const r = resultado.value

  if (!r) return

  conferencias.salvar({
    tipo: 'decimo',
    referencia: form.referencia.trim() || 'Sem identificação',
    formulario: { ...form },
    resumo: {
      detalhe: `13º · ${ROTULO_PARCELA[r.entrada.parcela]} · ${r.entrada.avos}/12 avos`,
      bruto: r.bruto,
      inss: r.inss?.total ?? 0,
      irrf: r.irrf?.escolhida.irrf ?? 0,
      liquido: r.liquido,
      inssInformado: r.conferenciaInss?.informado ?? null,
      diferencaInss: r.conferenciaInss?.diferenca ?? null,
    },
  })

  avisar('Conferência salva em Registros.')
}

/** Reabre uma conferencia salva: /decimo?conferencia=<id> */
watch(
  () => route.query.conferencia,
  (id) => {
    if (typeof id !== 'string') return

    const salva = conferencias.obter(id)

    if (salva?.tipo === 'decimo') {
      Object.assign(form, formularioDecimoPadrao(), salva.formulario)
      avisar(`Conferência "${salva.referencia}" carregada.`, 'info')
    }

    router.replace({ name: 'decimo' })
  },
  { immediate: true },
)

/** Abre um funcionario de um lote do cofre: /decimo?lote=<id>&linha=<id> */
watch(
  () => [route.query.lote, route.query.linha] as const,
  async ([lote, linha]) => {
    if (typeof lote !== 'string' || typeof linha !== 'string') return

    const encontrada = await cofre.obterLinha(lote, linha).catch(() => null)

    if (encontrada?.tipo === 'decimo') {
      Object.assign(form, formularioDecimoPadrao(), encontrada.formulario)
      avisar(`“${encontrada.nome}” carregado do lote.`, 'info')
    } else {
      avisar('Funcionário do lote não encontrado.', 'erro')
    }

    router.replace({ name: 'decimo' })
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
    <form v-navegar-enter class="vidro rounded-lg" novalidate aria-label="Dados do 13º salário" @submit.prevent>
      <UiFormGroup
        titulo="Parcela"
        :descricao="
          segunda
            ? '2ª parcela: até 20 de dezembro. INSS e IRRF sobre o 13º integral, descontando a 1ª parcela já paga.'
            : '1ª parcela: até 30 de novembro (ou nas férias, se pedida). Metade do 13º, sem INSS e IRRF.'
        "
      >
        <UiField id="decimo-referencia" rotulo="Funcionário ou referência" opcional class="col-span-2">
          <template #default="{ id }">
            <UiInput :id="id" v-model="form.referencia" placeholder="Maria, 13º 2026" autocomplete="off" />
          </template>
        </UiField>

        <UiSegmented v-model="form.parcela" nome="decimo-parcela" rotulo="Parcela" :opcoes="parcelas" class="col-span-2" />
      </UiFormGroup>

      <UiFormGroup titulo="Remuneração">
        <UiField id="decimo-salario" rotulo="Salário bruto" :erro="erros.salario">
          <template #default="{ id, descricao, invalido }">
            <UiMoneyInput :id="id" v-model="form.salario" placeholder="0,00" :invalido="invalido" :aria-describedby="descricao" autofocus />
          </template>
        </UiField>

        <UiField
          id="decimo-avos"
          rotulo="Avos"
          ajuda="Meses do ano com 15 dias ou mais de trabalho."
          :erro="erros.avos"
        >
          <template #default="{ id, descricao, invalido }">
            <UiInput :id="id" v-model="form.avos" type="number" min="1" max="12" step="1" sufixo="/12" :invalido="invalido" :aria-describedby="descricao" />
          </template>
        </UiField>

        <UiField
          id="decimo-medias"
          rotulo="Médias"
          opcional
          ajuda="Média MENSAL de horas extras, comissões e adicionais variáveis do ano. Soma-se ao salário antes dos avos."
          :erro="erros.medias"
          class="col-span-2"
        >
          <template #default="{ id, descricao, invalido }">
            <UiMoneyInput :id="id" v-model="form.medias" placeholder="0,00" :invalido="invalido" :aria-describedby="descricao" />
          </template>
        </UiField>
      </UiFormGroup>

      <UiFormGroup v-if="segunda" titulo="2ª parcela" descricao="A 1ª parcela paga é descontada do líquido e da base do FGTS.">
        <UiField
          id="decimo-primeira"
          rotulo="1ª parcela paga"
          opcional
          ajuda="Valor efetivamente pago em novembro. Em branco = metade do 13º calculado."
          :erro="erros.primeiraParcelaPaga"
        >
          <template #default="{ id, descricao, invalido }">
            <UiMoneyInput
              :id="id"
              v-model="form.primeiraParcelaPaga"
              :placeholder="resultado ? formatarDecimal(resultado.primeiraParcela) : 'Metade do 13º'"
              :invalido="invalido"
              :aria-describedby="descricao"
            />
          </template>
        </UiField>

        <UiField id="decimo-dependentes" rotulo="Dependentes (IRRF)" :erro="erros.dependentes">
          <template #default="{ id, descricao, invalido }">
            <UiInput :id="id" v-model="form.dependentes" type="number" min="0" max="99" step="1" :invalido="invalido" :aria-describedby="descricao" />
          </template>
        </UiField>
      </UiFormGroup>

      <UiFormGroup v-if="segunda" titulo="Conferência do holerite" recolhivel :aberto="temConferencia">
        <UiField id="decimo-inss-informado" rotulo="INSS do holerite" opcional :erro="erros.inssInformado">
          <template #default="{ id, descricao, invalido }">
            <UiMoneyInput :id="id" v-model="form.inssInformado" placeholder="0,00" :invalido="invalido" :aria-describedby="descricao" />
          </template>
        </UiField>

        <UiField id="decimo-irrf-informado" rotulo="IRRF do holerite" opcional :erro="erros.irrfInformado">
          <template #default="{ id, descricao, invalido }">
            <UiMoneyInput :id="id" v-model="form.irrfInformado" placeholder="0,00" :invalido="invalido" :aria-describedby="descricao" />
          </template>
        </UiField>
      </UiFormGroup>
    </form>

    <div id="resultado" class="min-w-0 scroll-mt-20 space-y-6" aria-live="polite">
      <div v-if="!resultado" class="vidro vidro--tracejado rounded-lg">
        <UiEmptyState icone="calendario" :titulo="leitura.vazio ? 'Informe o salário para iniciar' : 'Revise os campos destacados'" />
      </div>

      <template v-else>
        <ResumoValores
          v-if="resultado.entrada.parcela === 'primeira'"
          :itens="[
            { rotulo: '13º integral', valor: resultado.integral },
            { rotulo: '1ª parcela (50%)', valor: resultado.primeiraParcela },
            { rotulo: 'FGTS (empregador)', valor: resultado.fgts.valor },
            { rotulo: 'Valor líquido', valor: resultado.liquido, destaque: true },
          ]"
        />
        <ResumoValores
          v-else
          :itens="[
            { rotulo: '13º integral', valor: resultado.integral },
            { rotulo: 'INSS + IRRF', valor: (resultado.inss?.total ?? 0) + (resultado.irrf?.escolhida.irrf ?? 0), sinal: '-' },
            { rotulo: '1ª parcela paga', valor: resultado.adiantamento, sinal: '-' },
            { rotulo: 'Líquido da 2ª parcela', valor: resultado.liquido, destaque: true },
          ]"
        />

        <UiAlert v-if="resultado.liquido < 0" tom="atencao">
          Os descontos superam o 13º: o líquido ficou negativo. Confira o valor da 1ª parcela informada.
        </UiAlert>

        <UiAlert v-if="resultado.inss?.limitado" tom="atencao">
          A base do INSS ({{ formatarMoeda(resultado.inss.base) }}) ultrapassa o teto de
          {{ formatarMoeda(resultado.inss.teto) }}; a contribuição foi limitada ao teto.
        </UiAlert>

        <Demonstrativo
          :linhas="linhas"
          :total-proventos="resultado.bruto"
          :total-descontos="resultado.totalDescontos"
          :liquido="resultado.liquido"
          :subtitulo="[form.referencia.trim(), `13º salário · ${ROTULO_PARCELA[resultado.entrada.parcela]}`].filter(Boolean).join(' · ')"
          :bases="
            resultado.inss && resultado.irrf
              ? [
                  { rotulo: 'Base do INSS (13º)', valor: resultado.inss.baseConsiderada },
                  { rotulo: 'Base de cálculo do IRRF', valor: resultado.irrf.escolhida.base },
                  { rotulo: 'Base do FGTS', valor: resultado.fgts.base },
                ]
              : [{ rotulo: 'Base do FGTS', valor: resultado.fgts.base }]
          "
          :encargos="encargoFgts(resultado.fgts, segunda ? 'FGTS sobre a 2ª parcela' : 'FGTS sobre a 1ª parcela')"
        />

        <ConferenciaHolerite v-if="linhasConferencia.length" :linhas="linhasConferencia" />

        <section class="vidro rounded-lg">
          <UiTabs v-model="aba" :abas="abas" rotulo="Memória de cálculo">
            <template #default="{ ativa }">
              <div v-if="ativa === 'inss' && resultado.inss" class="p-5">
                <MemoriaInss :resultado="resultado.inss" />
              </div>
              <div v-else-if="ativa === 'irrf' && resultado.irrf" class="p-5">
                <MemoriaIrrf :irrf="resultado.irrf" rotulo-rendimento="13º salário integral" rotulo-inss="INSS sobre 13º" />
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
