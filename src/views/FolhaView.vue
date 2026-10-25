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

import { formatarMoeda, formatarPercentual } from '@/domain/dinheiro'
import { calcularFolha } from '@/domain/folha'
import type { Modalidade } from '@/domain/inss'
import { formularioFolha as form, formularioFolhaPadrao, interpretarFolha } from '@/features/folha'
import { useAtalhos } from '@/lib/teclado'
import { useAvisos } from '@/stores/avisos'
import { useConferencias } from '@/stores/conferencias'
import { useParametros } from '@/stores/parametros'

const route = useRoute()
const router = useRouter()
const { tabelaInss } = useParametros()
const conferencias = useConferencias()
const { avisar } = useAvisos()

const modalidades: { valor: Modalidade; rotulo: string }[] = [
  { valor: 'empregado', rotulo: 'Empregado' },
  { valor: 'prolabore', rotulo: 'Pró-labore' },
]

/** Abre o grupo de ajustes quando ha valores preenchidos (ex.: conferencia reaberta). */
const temAjustes = computed(() => Boolean(form.baseInssManual || form.inssInformado || form.irrfInformado))

const leitura = computed(() => interpretarFolha(form))
const erros = computed(() => leitura.value.erros)

const resultado = computed(() =>
  leitura.value.entrada ? calcularFolha(leitura.value.entrada, tabelaInss.value) : null,
)

const aba = ref('inss')

const abas = computed(() => [
  { id: 'inss', rotulo: 'Memória do INSS' },
  { id: 'irrf', rotulo: 'Memória do IRRF' },
])

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
    formulario: { ...form },
    resumo: {
      detalhe: `${r.entrada.modalidade === 'prolabore' ? 'Pró-labore' : 'Empregado'} · ${r.entrada.dias} dias`,
      bruto: r.proporcional,
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
      Object.assign(form, formularioFolhaPadrao(), salva.formulario)
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
            <UiInput :id="id" v-model="form.referencia" placeholder="Ex.: José — Junho/2026" autocomplete="off" />
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

        <UiField id="folha-dependentes" rotulo="Dependentes (IRRF)" :erro="erros.dependentes">
          <template #default="{ id, descricao, invalido }">
            <UiInput :id="id" v-model="form.dependentes" type="number" min="0" max="99" step="1" :invalido="invalido" :aria-describedby="descricao" />
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
          ajuda="Quando diferente do salário proporcional."
          :erro="erros.baseInssManual"
          class="col-span-2"
        >
          <template #default="{ id, descricao, invalido }">
            <UiMoneyInput :id="id" v-model="form.baseInssManual" placeholder="Salário proporcional" :invalido="invalido" :aria-describedby="descricao" />
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
            { rotulo: 'Salário proporcional', valor: resultado.proporcional },
            { rotulo: 'INSS', valor: resultado.inss.total, sinal: '-' },
            { rotulo: 'IRRF', valor: resultado.irrf.escolhida.irrf, sinal: '-' },
            { rotulo: 'Valor líquido', valor: resultado.liquido, destaque: true },
          ]"
        />

        <UiAlert v-if="resultado.inss.limitado" tom="atencao">
          A base do INSS ({{ formatarMoeda(resultado.inss.base) }}) ultrapassa o teto de
          {{ formatarMoeda(resultado.inss.teto) }}; a contribuição foi limitada ao teto.
        </UiAlert>

        <Demonstrativo
          :linhas="linhas"
          :total-proventos="resultado.proporcional"
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
                <MemoriaIrrf v-else :irrf="resultado.irrf" rotulo-rendimento="Salário proporcional" />
              </div>
            </template>
          </UiTabs>
        </section>
      </template>
    </div>
  </div>

  <BarraResultadoMovel v-if="resultado" alvo="resultado" :liquido="resultado.liquido" />
</template>
