<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import PageHeader from '@/components/layout/PageHeader.vue'
import EtapaCalculo from '@/components/rescisao/EtapaCalculo.vue'
import EtapaDados from '@/components/rescisao/EtapaDados.vue'
import EtapaDivergencias from '@/components/rescisao/EtapaDivergencias.vue'
import EtapaFolha from '@/components/rescisao/EtapaFolha.vue'
import EtapaModalidade from '@/components/rescisao/EtapaModalidade.vue'
import ResumoRescisao from '@/components/rescisao/ResumoRescisao.vue'
import UiAlert from '@/components/ui/UiAlert.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiStepper, { type Etapa } from '@/components/ui/UiStepper.vue'

import { formatarData } from '@/domain/datas'
import { obterModalidade } from '@/domain/rescisao/modalidades'
import {
  etapaDoCampo,
  formularioRescisao as form,
  formularioRescisaoPadrao,
  ROTULOS_PENDENTES,
} from '@/features/rescisao'
import { calculoRescisao, conferenciaRescisao, folhaInformada, leituraRescisao } from '@/features/rescisaoEstado'
import { camposNavegaveis, focarCampo, useAtalhos } from '@/lib/teclado'
import { useAvisos } from '@/stores/avisos'
import { useConferencias } from '@/stores/conferencias'

const route = useRoute()
const router = useRouter()
const conferencias = useConferencias()
const { avisar } = useAvisos()

const ORDEM = ['dados', 'modalidade', 'calculo', 'folha', 'divergencias'] as const
type IdEtapa = (typeof ORDEM)[number]

const ativa = ref<IdEtapa>('dados')
const resultado = computed(() => calculoRescisao.value.resultado)

const errosPorEtapa = computed(() => {
  const contagem = { 1: 0, 2: 0 }

  for (const campo of Object.keys(leituraRescisao.value.erros)) {
    contagem[etapaDoCampo(campo)] += 1
  }

  return contagem
})

const etapas = computed<Etapa[]>(() => {
  const dadosOk = !leituraRescisao.value.pendentes.length && !errosPorEtapa.value[1]
  const semResultado = !resultado.value

  return [
    { id: 'dados', rotulo: 'Dados do funcionário', estado: errosPorEtapa.value[1] ? 'erro' : dadosOk ? 'concluida' : 'pendente' },
    {
      id: 'modalidade',
      rotulo: 'Tipo de rescisão',
      estado: errosPorEtapa.value[2] || calculoRescisao.value.erro ? 'erro' : dadosOk ? 'concluida' : 'pendente',
    },
    { id: 'calculo', rotulo: 'Cálculo rescisório', estado: resultado.value ? 'concluida' : 'pendente', bloqueada: semResultado },
    { id: 'folha', rotulo: 'Valores da folha', estado: folhaInformada.value ? 'concluida' : 'pendente', bloqueada: semResultado },
    {
      id: 'divergencias',
      rotulo: 'Divergências',
      estado: conferenciaRescisao.value?.divergentes ? 'erro' : folhaInformada.value ? 'concluida' : 'pendente',
      bloqueada: semResultado,
    },
  ]
})

const indice = computed(() => ORDEM.indexOf(ativa.value))
const anterior = computed(() => etapas.value[indice.value - 1])
const proxima = computed(() => etapas.value[indice.value + 1])

const topo = ref<HTMLElement | null>(null)

async function irPara(id: string) {
  ativa.value = id as IdEtapa
  await nextTick()
  topo.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

watch(resultado, (atual) => {
  // Se o calculo deixa de existir, volta para onde estao as pendencias.
  if (!atual && indice.value >= 2) ativa.value = 'dados'
})

/* Teclado ---------------------------------------------------------------- */

const conteudo = ref<HTMLElement | null>(null)

/** Campo do formulario -> id do input na tela. */
const IDS_CAMPOS: Record<string, string> = {
  salario: 'resc-salario',
  adicionais: 'resc-adicionais',
  medias: 'resc-medias',
  dependentes: 'resc-dependentes',
  admissao: 'resc-admissao',
  fimContrato: 'resc-fim-contrato',
  desligamento: 'resc-desligamento',
  pagamento: 'resc-pagamento',
  variaveisMes: 'resc-variaveis',
  faltasMes: 'resc-faltas-mes',
  faltasPeriodoAtual: 'resc-faltas-periodo',
  adiantamentoDecimo: 'resc-adiantamento',
  saldoFgts: 'resc-saldo-fgts',
  folhaRendimentos: 'resc-folha-rend',
  folhaInss: 'resc-folha-inss',
  folhaIrrf: 'resc-folha-irrf',
  competenciaRemuneracao: 'resc-comp-rem',
  competenciaInss: 'resc-comp-inss',
  diasAvisoNaoCumpridos: 'resc-dias-nao-cumpridos',
  indenizacao480: 'resc-480',
  outrosDescontos: 'resc-outros-descontos',
}

async function focarPrimeiroCampo() {
  await nextTick()

  if (conteudo.value) focarCampo(camposNavegaveis(conteudo.value)[0])
}

/** Leva a etapa e ao campo com erro ou dado obrigatorio pendente. */
async function focarPendencia() {
  const campo = Object.keys(leituraRescisao.value.erros)[0] ?? leituraRescisao.value.pendentes[0]

  if (!campo) return

  ativa.value = campo.startsWith('periodo-') ? 'dados' : etapaDoCampo(campo) === 2 ? 'modalidade' : 'dados'
  await nextTick()

  // Grupos recolhidos (ex.: pagamentos anteriores) se abrem para mostrar o campo.
  const id = IDS_CAMPOS[campo]
  let alvo = id ? document.getElementById(id) : null

  if (!alvo) alvo = conteudo.value?.querySelector<HTMLElement>('[aria-invalid="true"]') ?? null

  focarCampo(alvo)
  avisar('Complete o campo destacado para continuar.', 'info')
}

async function avancarOuPendencia() {
  const destino = proxima.value
  const dadosIncompletos =
    ativa.value === 'dados' && (leituraRescisao.value.pendentes.length > 0 || errosPorEtapa.value[1] > 0)

  if (dadosIncompletos) {
    focarPendencia()
  } else if (destino && !destino.bloqueada) {
    await irPara(destino.id)
    if (['modalidade', 'folha'].includes(destino.id)) focarPrimeiroCampo()
  } else if (!resultado.value) {
    focarPendencia()
  }
}

useAtalhos([
  { tecla: 's', ctrl: true, acao: () => salvar() },
  { tecla: 'Enter', ctrl: true, shift: false, acao: () => avancarOuPendencia() },
  { tecla: 'Enter', ctrl: true, shift: true, acao: () => anterior.value && irPara(anterior.value.id) },
])

const pendentesTexto = computed(() =>
  leituraRescisao.value.pendentes.map((campo) => ROTULOS_PENDENTES[campo] ?? campo).join(', '),
)

function limpar() {
  Object.assign(form, formularioRescisaoPadrao())
  ativa.value = 'dados'
}

function salvar() {
  const r = resultado.value

  if (!r) return

  conferencias.salvar({
    tipo: 'rescisao',
    referencia: form.referencia.trim() || 'Sem identificação',
    formulario: JSON.parse(JSON.stringify(form)),
    resumo: {
      detalhe: `${obterModalidade(form.modalidade).rotulo} · ${formatarData(r.entrada.desligamento)}`,
      bruto: r.totalProventos,
      inss: r.inssMensalDevido + r.inssDecimo.total,
      irrf: r.irrfMensalDevido + r.irrfDecimo.escolhida.irrf,
      liquido: r.liquido,
      inssInformado: null,
      diferencaInss: null,
      divergencias: folhaInformada.value ? (conferenciaRescisao.value?.divergentes ?? 0) : null,
    },
  })

  avisar('Conferência salva em Registros.')
}

watch(
  () => route.query.conferencia,
  (id) => {
    if (typeof id !== 'string') return

    const salva = conferencias.obter(id)

    if (salva?.tipo === 'rescisao') {
      Object.assign(form, formularioRescisaoPadrao(), JSON.parse(JSON.stringify(salva.formulario)))
      ativa.value = 'calculo'
      avisar(`Conferência "${salva.referencia}" carregada.`, 'info')
    }

    router.replace({ name: 'rescisao' })
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

  <div ref="topo" class="scroll-mt-20 space-y-6">
    <UiStepper :model-value="ativa" :etapas="etapas" @update:model-value="irPara" />

    <div class="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div ref="conteudo" v-navegar-enter="avancarOuPendencia" class="min-w-0 space-y-6">
        <UiAlert v-if="calculoRescisao.erro" tom="perigo">{{ calculoRescisao.erro }}</UiAlert>

        <EtapaDados v-if="ativa === 'dados'" />
        <EtapaModalidade v-else-if="ativa === 'modalidade'" />
        <template v-else-if="resultado">
          <EtapaCalculo v-if="ativa === 'calculo'" :resultado="resultado" />
          <EtapaFolha v-else-if="ativa === 'folha'" />
          <EtapaDivergencias v-else @ir-para-folha="irPara('folha')" />
        </template>

        <div class="flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
          <UiButton v-if="anterior" @click="irPara(anterior.id)">Voltar: {{ anterior.rotulo }}</UiButton>
          <span v-else />

          <div class="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            <p v-if="proxima?.bloqueada && pendentesTexto" class="text-xs text-muted sm:text-right">
              Para calcular, informe: {{ pendentesTexto }}.
            </p>
            <UiButton
              v-if="proxima"
              variante="primario"
              aria-keyshortcuts="Control+Enter"
              title="Ctrl+Enter"
              @click="avancarOuPendencia"
            >
              Avançar: {{ proxima.rotulo }}
            </UiButton>
          </div>
        </div>
      </div>

      <aside class="xl:sticky xl:top-8" aria-label="Resumo da rescisão">
        <ResumoRescisao />
      </aside>
    </div>
  </div>
</template>
