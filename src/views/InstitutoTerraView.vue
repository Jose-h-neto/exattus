<script setup lang="ts">
import { computed, reactive, ref, shallowRef } from 'vue'

import RubricasEventosModal from '@/components/eventos/RubricasEventosModal.vue'
import PageHeader from '@/components/layout/PageHeader.vue'
import UiAlert from '@/components/ui/UiAlert.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiIcon from '@/components/ui/UiIcon.vue'
import UiModal from '@/components/ui/UiModal.vue'

import { formatarData } from '@/domain/datas'
import { formatarCompetencia, lerCompetencia } from '@/domain/lote/tipos'
import { lerResumoEventos, type ResumoEventos } from '@/features/eventos/leitura'
import {
  formatarQuantidade,
  lerQuantidade,
  montarEventos,
  paraPlanilha,
  type EdicoesEventos,
  type LancamentoEvento,
} from '@/features/eventos/montagem'
import { competenciaDoArquivo, formatarDuracao, IGNORAR, ROTULO_UNIDADE } from '@/features/eventos/regras'
import { gerarPlanilhaLancamentos, primeiroDia } from '@/features/lote/lancamentos'
import { baixarArquivo } from '@/lib/arquivos'
import { useAtalhos } from '@/lib/teclado'
import { useAvisos } from '@/stores/avisos'
import { useInstitutoTerra } from '@/stores/institutoTerra'

const { avisar } = useAvisos()
const { config, mapearColuna, ligarRubrica } = useInstitutoTerra()

/* ---------- Arquivo ---------- */

const resumo = shallowRef<ResumoEventos | null>(null)
const nomeArquivo = ref('')
const lendo = ref(false)
const erroArquivo = ref('')
const arrastando = ref(false)
const entrada = ref<HTMLInputElement | null>(null)
const competenciaTexto = ref('')

const edicoes = reactive<EdicoesEventos>({ quantidades: {}, manuais: [] })

function competenciaPadrao(): string {
  const hoje = new Date()

  return `${String(hoje.getMonth() + 1).padStart(2, '0')}/${hoje.getFullYear()}`
}

async function escolher(arquivo: File | undefined) {
  if (!arquivo || lendo.value) return

  erroArquivo.value = ''

  if (!/\.xlsx$/i.test(arquivo.name)) {
    erroArquivo.value = 'Envie o resumo de eventos em .xlsx.'
    return
  }

  lendo.value = true

  try {
    resumo.value = await lerResumoEventos(arquivo)
    nomeArquivo.value = arquivo.name
    edicoes.quantidades = {}
    edicoes.manuais = []
    filtroAba.value = ''
    filtroRubrica.value = ''
    busca.value = ''
    soRevisar.value = false

    const competencia = competenciaDoArquivo(arquivo.name)

    competenciaTexto.value = competencia ? formatarCompetencia(competencia) : competenciaPadrao()
  } catch (causa) {
    erroArquivo.value = causa instanceof Error ? causa.message : 'Não foi possível ler a planilha.'
  } finally {
    lendo.value = false
    if (entrada.value) entrada.value.value = ''
  }
}

function soltar(evento: DragEvent) {
  arrastando.value = false
  void escolher(evento.dataTransfer?.files?.[0])
}

const trocando = ref(false)
const temEdicoes = computed(() => Object.keys(edicoes.quantidades).length > 0 || edicoes.manuais.length > 0)

function trocarArquivo() {
  if (temEdicoes.value && !trocando.value) {
    trocando.value = true
    return
  }

  trocando.value = false
  resumo.value = null
  nomeArquivo.value = ''
}

/* ---------- Resultado ---------- */

const resultado = computed(() => (resumo.value ? montarEventos(resumo.value, config.value, edicoes) : null))
const lancamentos = computed(() => resultado.value?.lancamentos ?? [])
const linhasPlanilha = computed(() => paraPlanilha(lancamentos.value))
const aRevisar = computed(() => lancamentos.value.filter((lancamento) => lancamento.revisar))
const semValor = computed(() => lancamentos.value.filter((lancamento) => lancamento.quantidade === null))

const colunasSemRubrica = computed(() => (resultado.value?.colunas ?? []).filter((coluna) => coluna.destino.tipo === 'sem-rubrica' && coluna.preenchidas > 0))
const colaboradores = computed(() => resultado.value?.colaboradores ?? [])
const totalColaboradores = computed(() => new Set(colaboradores.value.map((colaborador) => colaborador.matricula)).size)
const anotacoes = computed(() => [
  ...colaboradores.value.filter((colaborador) => colaborador.notas.length).map((colaborador) => ({ onde: `${colaborador.nome} · mat. ${colaborador.matricula}`, textos: colaborador.notas })),
  ...(resumo.value?.abas ?? []).filter((aba) => aba.anotacoes.length).map((aba) => ({ onde: `Aba ${aba.nome}`, textos: aba.anotacoes })),
])

const competencia = computed(() => lerCompetencia(competenciaTexto.value))
const erroCompetencia = computed(() => (competencia.value ? '' : 'Use MM/AAAA, ex.: 10/2026.'))

/** Lancamentos e total por rubrica (com as rubricas desligadas, para religar). */
const porRubrica = computed(() =>
  config.value.rubricas.map((rubrica) => {
    const daRubrica = lancamentos.value.filter((lancamento) => lancamento.rubrica.id === rubrica.id && lancamento.quantidade)

    return {
      rubrica,
      ligada: !config.value.desligadas.includes(rubrica.id),
      quantidade: daRubrica.length,
      total: daRubrica.reduce((soma, lancamento) => soma + (lancamento.quantidade ?? 0), 0),
    }
  }),
)

/* ---------- Filtros ---------- */

const filtroAba = ref('')
const filtroRubrica = ref('')
const busca = ref('')
const soRevisar = ref(false)

const abas = computed(() => [...new Set(lancamentos.value.map((lancamento) => lancamento.aba))])

const visiveis = computed(() => {
  const termo = busca.value.trim().toLowerCase()

  return lancamentos.value.filter(
    (lancamento) =>
      (!soRevisar.value || lancamento.revisar || lancamento.quantidade === null) &&
      (!filtroAba.value || lancamento.aba === filtroAba.value) &&
      (!filtroRubrica.value || lancamento.rubrica.id === filtroRubrica.value) &&
      (!termo || lancamento.nome.toLowerCase().includes(termo) || lancamento.matricula.includes(termo)),
  )
})

/* ---------- Edicao ---------- */

const errosEdicao = reactive<Record<string, string>>({})

function alterarQuantidade(lancamento: LancamentoEvento, texto: string) {
  const quantidade = lerQuantidade(texto, lancamento.rubrica.unidade)

  if (quantidade !== null && Number.isNaN(quantidade)) {
    errosEdicao[lancamento.id] = lancamento.rubrica.unidade === 'horas' ? 'Use horas,minutos (ex.: 2,20 ou 2:20).' : 'Valor inválido.'
    return
  }

  delete errosEdicao[lancamento.id]

  if (lancamento.manual) {
    const manual = edicoes.manuais.find((item) => item.id === lancamento.id)

    if (manual && quantidade) manual.quantidade = quantidade
    else if (manual) edicoes.manuais = edicoes.manuais.filter((item) => item.id !== lancamento.id)

    return
  }

  // Vazio ou zero: a linha sai da planilha.
  edicoes.quantidades[lancamento.id] = quantidade || null
}

function confirmar(lancamento: LancamentoEvento) {
  if (lancamento.quantidade !== null) edicoes.quantidades[lancamento.id] = lancamento.quantidade
}

function remover(lancamento: LancamentoEvento) {
  if (lancamento.manual) edicoes.manuais = edicoes.manuais.filter((item) => item.id !== lancamento.id)
  else edicoes.quantidades[lancamento.id] = null
}

function restaurar(lancamento: LancamentoEvento) {
  delete edicoes.quantidades[lancamento.id]
  delete errosEdicao[lancamento.id]
}

/* Incluir lancamento */
const novo = reactive({ matricula: '', rubricaId: '', quantidade: '' })
const erroNovo = ref('')
const rubricasLigadas = computed(() => config.value.rubricas.filter((rubrica) => !config.value.desligadas.includes(rubrica.id)))
const nomeDaMatricula = computed(() => colaboradores.value.find((colaborador) => colaborador.matricula === novo.matricula.trim())?.nome ?? '')

function incluir() {
  const matricula = novo.matricula.trim()
  const rubrica = config.value.rubricas.find((item) => item.id === novo.rubricaId)
  const quantidade = rubrica ? lerQuantidade(novo.quantidade, rubrica.unidade) : null

  if (!/^\d+$/.test(matricula)) erroNovo.value = 'Informe a matrícula (só números).'
  else if (!rubrica) erroNovo.value = 'Escolha a rubrica.'
  else if (!quantidade || Number.isNaN(quantidade)) erroNovo.value = rubrica.unidade === 'horas' ? 'Informe as horas (ex.: 2,20 ou 2:20).' : 'Informe a quantidade ou valor.'
  else {
    edicoes.manuais.push({ id: `manual:${Date.now().toString(36)}`, matricula, nome: nomeDaMatricula.value || `Matrícula ${matricula}`, rubricaId: rubrica.id, quantidade })
    novo.matricula = ''
    novo.quantidade = ''
    erroNovo.value = ''
    avisar('Lançamento incluído.')
  }
}

/* ---------- Download ---------- */

const gerando = ref(false)
const confirmandoDownload = ref(false)
const podeBaixar = computed(() => Boolean(resumo.value && competencia.value && linhasPlanilha.value.length && config.value.codigoEmpresa) && !gerando.value)

function pedirDownload() {
  if (!podeBaixar.value) return

  // Pendencias: confirma antes de gerar.
  if ((aRevisar.value.length || semValor.value.length || colunasSemRubrica.value.length) && !confirmandoDownload.value) {
    confirmandoDownload.value = true
    return
  }

  void baixar()
}

async function baixar() {
  confirmandoDownload.value = false

  if (!competencia.value) return

  gerando.value = true

  try {
    const blob = await gerarPlanilhaLancamentos(linhasPlanilha.value, config.value.codigoEmpresa, competencia.value)
    const [ano, mes] = competencia.value.split('-')

    baixarArquivo(blob, `IT_LANÇAMENTOS FOPAG_${mes}.${ano}.xlsx`)
    avisar(`Planilha com ${linhasPlanilha.value.length} lançamentos gerada.`)
  } catch (causa) {
    avisar(causa instanceof Error ? causa.message : 'Não foi possível gerar a planilha.', 'erro')
  } finally {
    gerando.value = false
  }
}

const configurando = ref(false)

useAtalhos([
  { tecla: 's', ctrl: true, emCampos: true, acao: pedirDownload },
  { tecla: 'o', ctrl: true, emCampos: true, acao: () => entrada.value?.click() },
])

function descricaoUnidade(lancamento: LancamentoEvento): string {
  if (lancamento.rubrica.unidade === 'horas' && lancamento.quantidade) {
    const horas = Math.trunc(lancamento.quantidade)
    const minutos = Math.round((lancamento.quantidade - horas) * 100)

    return formatarDuracao(horas * 60 + minutos)
  }

  return ROTULO_UNIDADE[lancamento.rubrica.unidade]
}
</script>

<template>
  <PageHeader>
    <template #subtitulo>
      Resumo de eventos do mês → planilha de lançamentos da folha · cód. empresa <span class="num font-medium text-ink-2">{{ config.codigoEmpresa }}</span>
    </template>
    <template #acoes>
      <UiButton variante="discreto" icone="ajustes" @click="configurando = true">Rubricas</UiButton>
      <template v-if="resumo">
        <UiButton variante="discreto" icone="enviar" @click="trocarArquivo">Trocar arquivo</UiButton>
        <UiButton variante="primario" icone="baixar" :disabled="!podeBaixar" @click="pedirDownload">
          {{ gerando ? 'Gerando…' : 'Baixar planilha de lançamentos' }}
        </UiButton>
      </template>
    </template>
  </PageHeader>

  <input
    ref="entrada"
    type="file"
    accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    class="sr-only"
    tabindex="-1"
    aria-hidden="true"
    @change="escolher(($event.target as HTMLInputElement).files?.[0])"
  />

  <!-- Etapa 1: enviar o resumo -->
  <section v-if="!resumo" class="vidro rounded-lg p-5 md:p-8">
    <button
      type="button"
      class="flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed px-6 py-12 text-center transition-colors focus-visible:outline-2 focus-visible:outline-primary"
      :class="arrastando ? 'border-primary bg-primary-soft' : 'border-line-strong hover:border-primary hover:bg-subtle'"
      :disabled="lendo"
      @click="entrada?.click()"
      @dragover.prevent="arrastando = true"
      @dragleave="arrastando = false"
      @drop.prevent="soltar"
    >
      <span class="grid size-12 place-items-center rounded-md bg-primary-soft text-primary">
        <UiIcon :nome="lendo ? 'relogio' : 'enviar'" :tamanho="24" />
      </span>
      <span class="text-base font-semibold text-ink">{{ lendo ? 'Lendo o resumo…' : 'Arraste o resumo de eventos do mês ou clique para escolher' }}</span>
      <span class="text-sm text-muted">Ex.: IT_RESUMO EVENTOS_10.2026.xlsx · uma aba por centro de custo, com a coluna COLABORADOR</span>
      <kbd class="mt-1 rounded border border-line bg-subtle px-1.5 py-0.5 text-[11px] text-muted">Ctrl + O</kbd>
    </button>

    <p v-if="erroArquivo" class="ex-error mt-3" role="alert"><UiIcon nome="alerta" :tamanho="14" />{{ erroArquivo }}</p>

    <ol class="mt-6 grid gap-3 text-sm md:grid-cols-3">
      <li v-for="(passo, indice) in [
        { titulo: 'Envie o resumo do mês', texto: 'Todas as abas visíveis são lidas. Abas ocultas, totais e anotações ficam de fora.' },
        { titulo: 'Revise e ajuste', texto: 'Altere horas e valores, remova linhas ou inclua lançamentos. Tudo antes de gerar o arquivo.' },
        { titulo: 'Baixe a planilha', texto: 'IT_LANÇAMENTOS FOPAG no layout de upload do sistema da folha, com data no 1º dia da competência.' },
      ]" :key="indice" class="flex gap-3 rounded-md border border-line bg-surface/60 p-3">
        <span class="num grid size-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-white">{{ indice + 1 }}</span>
        <span>
          <span class="block font-semibold text-ink">{{ passo.titulo }}</span>
          <span class="text-muted">{{ passo.texto }}</span>
        </span>
      </li>
    </ol>
  </section>

  <!-- Etapa 2: revisar e baixar -->
  <div v-else-if="resultado" class="space-y-6">
    <div class="vidro flex flex-col gap-3 rounded-lg px-4 py-3 md:flex-row md:items-center">
      <div class="flex min-w-0 flex-1 items-center gap-2">
        <UiIcon nome="planilha" :tamanho="20" class="shrink-0 text-positive" />
        <span class="min-w-0 truncate text-sm font-medium text-ink" :title="nomeArquivo">{{ nomeArquivo }}</span>
      </div>
      <label class="flex items-center gap-2 text-sm text-muted">
        Competência
        <input
          v-model="competenciaTexto"
          inputmode="numeric"
          placeholder="10/2026"
          :aria-invalid="Boolean(erroCompetencia)"
          class="num h-9 w-28 rounded-md border bg-surface px-2 text-sm text-ink outline-none focus:border-primary focus:ring-3 focus:ring-primary-soft"
          :class="erroCompetencia ? 'border-negative' : 'border-line-strong'"
        />
      </label>
      <span class="text-sm text-muted">
        Data do movimento <span class="num font-medium text-ink">{{ competencia ? formatarData(primeiroDia(competencia)) : '—' }}</span>
      </span>
    </div>
    <p v-if="erroCompetencia" class="ex-error -mt-4" role="alert"><UiIcon nome="alerta" :tamanho="14" />{{ erroCompetencia }}</p>

    <div class="@container">
      <dl class="vidro grid grid-cols-2 overflow-hidden rounded-lg @xl:grid-cols-4">
        <div class="px-4 py-3">
          <dt class="text-xs text-muted">Lançamentos</dt>
          <dd class="num text-xl font-semibold text-ink">{{ linhasPlanilha.length }}</dd>
        </div>
        <div class="border-l border-line px-4 py-3">
          <dt class="text-xs text-muted">Colaboradores</dt>
          <dd class="num text-xl font-semibold text-ink">{{ totalColaboradores }}</dd>
        </div>
        <div class="border-t border-line px-4 py-3 @xl:border-t-0 @xl:border-l">
          <dt class="text-xs text-muted">Centros de custo (abas)</dt>
          <dd class="num text-xl font-semibold text-ink">{{ resumo.abas.length }}</dd>
        </div>
        <div class="border-t border-l border-line px-4 py-3 @xl:border-t-0" :class="aRevisar.length + colunasSemRubrica.length > 0 && 'bg-warning-soft'">
          <dt class="text-xs text-muted">Para revisar</dt>
          <dd class="num text-xl font-semibold" :class="aRevisar.length + colunasSemRubrica.length ? 'text-warning' : 'text-positive'">
            {{ aRevisar.length + colunasSemRubrica.length }}
          </dd>
        </div>
      </dl>
    </div>

    <UiAlert v-if="colunasSemRubrica.length" tom="atencao" titulo="Colunas com valores e sem rubrica">
      <p>Escolha a rubrica de cada coluna ou marque “Não lançar”. A escolha fica salva para os próximos meses.</p>
      <ul class="mt-2 space-y-1.5">
        <li v-for="coluna in colunasSemRubrica" :key="coluna.chave" class="flex flex-wrap items-center gap-2">
          <span class="font-semibold">{{ coluna.cabecalho }}</span>
          <span class="text-xs">({{ coluna.preenchidas }} {{ coluna.preenchidas === 1 ? 'valor' : 'valores' }} · aba {{ coluna.abas.join(', ') }})</span>
          <select
            :aria-label="`Rubrica da coluna ${coluna.cabecalho}`"
            class="h-8 rounded-md border border-line-strong bg-surface px-2 text-sm text-ink outline-none focus:border-primary focus:ring-3 focus:ring-primary-soft"
            @change="mapearColuna(coluna.chave, ($event.target as HTMLSelectElement).value)"
          >
            <option value="">Escolher…</option>
            <option :value="IGNORAR">Não lançar</option>
            <option v-for="rubrica in config.rubricas" :key="rubrica.id" :value="rubrica.id">{{ rubrica.codigo }} · {{ rubrica.descricao }}</option>
          </select>
        </li>
      </ul>
    </UiAlert>

    <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <!-- Lancamentos -->
      <section class="vidro min-w-0 rounded-lg" aria-labelledby="titulo-lancamentos">
        <header class="flex flex-col gap-3 border-b border-line px-5 py-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h2 id="titulo-lancamentos" class="text-base font-bold text-ink">Lançamentos</h2>
            <span class="text-xs text-muted">Clique na quantidade para alterar. Vazio ou 0 tira a linha da planilha.</span>
          </div>
          <div class="flex flex-col gap-2 md:flex-row md:items-center">
            <label class="relative block md:w-56">
              <span class="sr-only">Buscar colaborador</span>
              <UiIcon nome="buscar" :tamanho="16" class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
              <input
                v-model="busca"
                type="search"
                placeholder="Nome ou matrícula"
                class="h-9 w-full rounded-md border border-line-strong bg-surface pr-3 pl-9 text-sm outline-none placeholder:text-ink-subtle focus:border-primary focus:ring-3 focus:ring-primary-soft"
              />
            </label>
            <select
              v-model="filtroAba"
              aria-label="Filtrar por aba"
              class="h-9 rounded-md border border-line-strong bg-surface px-2 text-sm text-ink outline-none focus:border-primary focus:ring-3 focus:ring-primary-soft"
            >
              <option value="">Todas as abas</option>
              <option v-for="aba in abas" :key="aba" :value="aba">{{ aba }}</option>
            </select>
            <select
              v-model="filtroRubrica"
              aria-label="Filtrar por rubrica"
              class="h-9 rounded-md border border-line-strong bg-surface px-2 text-sm text-ink outline-none focus:border-primary focus:ring-3 focus:ring-primary-soft"
            >
              <option value="">Todas as rubricas</option>
              <option v-for="rubrica in config.rubricas" :key="rubrica.id" :value="rubrica.id">{{ rubrica.codigo }} · {{ rubrica.descricao }}</option>
            </select>
            <button
              v-if="aRevisar.length || semValor.length"
              type="button"
              :aria-pressed="soRevisar"
              class="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-primary"
              :class="soRevisar ? 'bg-warning-soft text-warning' : 'text-muted hover:bg-subtle hover:text-ink'"
              @click="soRevisar = !soRevisar"
            >
              <UiIcon nome="alerta" :tamanho="14" />
              Só a revisar
              <span class="num text-[11px]">{{ aRevisar.length }}</span>
            </button>
          </div>
        </header>

        <div class="max-h-[640px] overflow-auto">
          <table class="tabela min-w-[760px]">
            <thead class="sticky top-0 z-10">
              <tr>
                <th scope="col" class="pl-5">Colaborador</th>
                <th scope="col">Rubrica</th>
                <th scope="col">Na planilha</th>
                <th scope="col" class="num">Quantidade/Valor</th>
                <th scope="col" class="pr-5"><span class="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="lancamento in visiveis"
                :key="lancamento.id"
                :class="lancamento.revisar || lancamento.quantidade === null ? 'bg-warning-soft/60' : 'hover:bg-subtle/50'"
              >
                <td class="pl-5">
                  <span class="block font-medium text-ink">{{ lancamento.nome }}</span>
                  <span class="num mt-0.5 block text-xs text-muted">mat. {{ lancamento.matricula }} · {{ lancamento.manual ? 'incluído' : `aba ${lancamento.aba}` }}</span>
                </td>
                <td>
                  <span class="num font-semibold text-ink">{{ lancamento.rubrica.codigo }}</span>
                  <span class="ml-1.5 text-muted">{{ lancamento.rubrica.descricao }}</span>
                </td>
                <td>
                  <span class="num text-ink-2">{{ lancamento.original }}</span>
                  <span v-if="lancamento.nota" class="mt-0.5 block max-w-64 text-xs" :class="lancamento.revisar ? 'text-warning' : 'text-muted'">{{ lancamento.nota }}</span>
                </td>
                <td class="num">
                  <div class="flex flex-col items-end">
                    <input
                      :value="lancamento.quantidade === null ? '' : formatarQuantidade(lancamento.quantidade)"
                      inputmode="decimal"
                      :placeholder="lancamento.rubrica.unidade === 'horas' ? '0,00' : '—'"
                      :aria-label="`Quantidade de ${lancamento.rubrica.descricao} de ${lancamento.nome}`"
                      :aria-invalid="Boolean(errosEdicao[lancamento.id])"
                      class="num h-8 w-28 rounded-md border bg-surface px-2 text-right text-sm text-ink outline-none focus:border-primary focus:ring-3 focus:ring-primary-soft"
                      :class="errosEdicao[lancamento.id] ? 'border-negative' : lancamento.editado ? 'border-primary bg-primary-soft' : 'border-line'"
                      @change="alterarQuantidade(lancamento, ($event.target as HTMLInputElement).value)"
                      @keydown.enter="($event.target as HTMLInputElement).blur()"
                    />
                    <span class="mt-0.5 text-[11px]" :class="errosEdicao[lancamento.id] ? 'text-negative' : 'text-muted'">
                      {{ errosEdicao[lancamento.id] || (lancamento.editado ? `editado · ${descricaoUnidade(lancamento)}` : descricaoUnidade(lancamento)) }}
                    </span>
                  </div>
                </td>
                <td class="pr-5">
                  <div class="flex justify-end gap-1">
                    <UiButton v-if="lancamento.revisar && lancamento.quantidade !== null" variante="discreto" tamanho="sm" icone="ok" @click="confirmar(lancamento)">
                      Confirmar
                    </UiButton>
                    <UiButton v-if="lancamento.editado" variante="discreto" tamanho="sm" icone="reiniciar" so-icone @click="restaurar(lancamento)">
                      Voltar ao valor da planilha
                    </UiButton>
                    <UiButton variante="discreto" tamanho="sm" icone="lixeira" so-icone @click="remover(lancamento)">
                      Remover lançamento de {{ lancamento.nome }}
                    </UiButton>
                  </div>
                </td>
              </tr>
              <tr v-if="!visiveis.length">
                <td colspan="5" class="px-5 py-8 text-center text-sm text-muted">Nenhum lançamento com esses filtros.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Incluir lancamento -->
        <form class="flex flex-col gap-2 border-t border-line px-5 py-3 md:flex-row md:items-start" @submit.prevent="incluir">
          <span class="pt-2 text-sm font-semibold whitespace-nowrap text-ink">Incluir lançamento</span>
          <div class="flex flex-1 flex-col gap-2 sm:flex-row">
            <div class="sm:w-36">
              <input
                v-model="novo.matricula"
                list="it-matriculas"
                inputmode="numeric"
                placeholder="Matrícula"
                aria-label="Matrícula"
                class="num h-9 w-full rounded-md border border-line-strong bg-surface px-2 text-sm text-ink outline-none focus:border-primary focus:ring-3 focus:ring-primary-soft"
              />
              <datalist id="it-matriculas">
                <option v-for="colaborador in colaboradores" :key="`${colaborador.aba}-${colaborador.matricula}`" :value="colaborador.matricula">{{ colaborador.nome }}</option>
              </datalist>
              <span v-if="nomeDaMatricula" class="mt-0.5 block truncate text-[11px] text-muted">{{ nomeDaMatricula }}</span>
            </div>
            <select
              v-model="novo.rubricaId"
              aria-label="Rubrica"
              class="h-9 rounded-md border border-line-strong bg-surface px-2 text-sm text-ink outline-none focus:border-primary focus:ring-3 focus:ring-primary-soft sm:flex-1"
            >
              <option value="" disabled>Rubrica…</option>
              <option v-for="rubrica in rubricasLigadas" :key="rubrica.id" :value="rubrica.id">{{ rubrica.codigo }} · {{ rubrica.descricao }}</option>
            </select>
            <input
              v-model="novo.quantidade"
              inputmode="decimal"
              placeholder="Qtd./valor"
              aria-label="Quantidade ou valor"
              class="num h-9 rounded-md border border-line-strong bg-surface px-2 text-right text-sm text-ink outline-none focus:border-primary focus:ring-3 focus:ring-primary-soft sm:w-28"
            />
            <UiButton type="submit" icone="adicionar">Incluir</UiButton>
          </div>
        </form>
        <p v-if="erroNovo" class="ex-error px-5 pb-3" role="alert"><UiIcon nome="alerta" :tamanho="14" />{{ erroNovo }}</p>

        <details v-if="resultado.removidos.length" class="border-t border-line px-5 py-3 text-sm">
          <summary class="cursor-pointer font-medium text-muted hover:text-ink">
            {{ resultado.removidos.length }} {{ resultado.removidos.length === 1 ? 'lançamento removido' : 'lançamentos removidos' }}
          </summary>
          <ul class="mt-2 space-y-1">
            <li v-for="lancamento in resultado.removidos" :key="lancamento.id" class="flex items-center justify-between gap-2">
              <span class="min-w-0 truncate">
                <span class="num">{{ lancamento.matricula }}</span> · {{ lancamento.nome }} ·
                <span class="num">{{ lancamento.rubrica.codigo }}</span> {{ lancamento.rubrica.descricao }} · {{ lancamento.original }}
              </span>
              <UiButton variante="discreto" tamanho="sm" icone="reiniciar" @click="restaurar(lancamento)">Restaurar</UiButton>
            </li>
          </ul>
        </details>
      </section>

      <aside class="space-y-6">
        <!-- Rubricas -->
        <section class="vidro rounded-lg" aria-labelledby="titulo-rubricas">
          <header class="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 id="titulo-rubricas" class="text-base font-bold text-ink">Rubricas</h2>
            <button type="button" class="text-xs font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary" @click="configurando = true">
              Editar códigos
            </button>
          </header>
          <ul>
            <li v-for="item in porRubrica" :key="item.rubrica.id" class="flex items-center gap-3 border-b border-line px-4 py-2 last:border-b-0" :class="!item.ligada && 'opacity-60'">
              <input
                type="checkbox"
                :checked="item.ligada"
                :aria-label="`Lançar ${item.rubrica.descricao}`"
                class="size-4 accent-[var(--ex-primary,#5a3fc0)]"
                @change="ligarRubrica(item.rubrica.id, ($event.target as HTMLInputElement).checked)"
              />
              <button
                type="button"
                class="min-w-0 flex-1 text-left focus-visible:outline-2 focus-visible:outline-primary"
                :title="`Filtrar por ${item.rubrica.descricao}`"
                @click="filtroRubrica = filtroRubrica === item.rubrica.id ? '' : item.rubrica.id"
              >
                <span class="block truncate text-sm text-ink" :class="filtroRubrica === item.rubrica.id && 'font-semibold text-primary'">
                  <span class="num font-semibold">{{ item.rubrica.codigo }}</span> {{ item.rubrica.descricao }}
                </span>
                <span class="num text-xs text-muted">
                  {{ item.ligada ? `${item.quantidade} ${item.quantidade === 1 ? 'lançamento' : 'lançamentos'}` : 'não lançada' }}
                  <template v-if="item.ligada && item.quantidade">
                    · {{ item.rubrica.unidade === 'valor' ? `R$ ${formatarQuantidade(item.total)}` : formatarQuantidade(item.total) }}
                  </template>
                </span>
              </button>
            </li>
          </ul>
        </section>

        <!-- Anotacoes da planilha -->
        <section v-if="anotacoes.length" class="vidro rounded-lg" aria-labelledby="titulo-anotacoes">
          <header class="border-b border-line px-4 py-3">
            <h2 id="titulo-anotacoes" class="text-base font-bold text-ink">Anotações da planilha</h2>
          </header>
          <ul class="max-h-80 space-y-2 overflow-y-auto px-4 py-3 text-sm">
            <li v-for="anotacao in anotacoes" :key="anotacao.onde">
              <span class="block text-xs font-semibold text-muted">{{ anotacao.onde }}</span>
              <span v-for="texto in anotacao.textos" :key="texto" class="block text-ink">{{ texto }}</span>
            </li>
          </ul>
        </section>

        <UiAlert v-if="resultado.repetidas.length" tom="info" titulo="Matrículas em mais de uma aba">
          <ul class="space-y-0.5">
            <li v-for="item in resultado.repetidas" :key="item.matricula"><span class="num">{{ item.matricula }}</span> · {{ item.nome }} ({{ item.abas.join(', ') }})</li>
          </ul>
        </UiAlert>

        <details class="vidro rounded-lg px-4 py-3 text-sm">
          <summary class="cursor-pointer font-medium text-ink">Colunas lidas do resumo</summary>
          <ul class="mt-2 space-y-1.5">
            <li v-for="coluna in resultado.colunas" :key="coluna.chave" class="flex items-center justify-between gap-2">
              <span class="min-w-0">
                <span class="block truncate text-ink">{{ coluna.cabecalho }}</span>
                <span class="text-xs text-muted">{{ coluna.preenchidas }} {{ coluna.preenchidas === 1 ? 'valor' : 'valores' }}</span>
              </span>
              <UiBadge v-if="coluna.destino.tipo === 'rubrica'" tom="marca">{{ coluna.destino.rubrica.codigo }}</UiBadge>
              <UiBadge v-else-if="coluna.destino.tipo === 'ignorada'" tom="neutro">não lança</UiBadge>
              <UiBadge v-else tom="atencao">sem rubrica</UiBadge>
            </li>
          </ul>
          <p v-if="resumo.ignoradas.length" class="mt-2 text-xs text-muted">Abas sem colaboradores: {{ resumo.ignoradas.join(', ') }}.</p>
        </details>
      </aside>
    </div>
  </div>

  <RubricasEventosModal :aberto="configurando" @fechar="configurando = false" />

  <UiModal :aberto="trocando" titulo="Trocar o arquivo?" descricao="As alterações feitas nos lançamentos deste resumo serão descartadas." @fechar="trocando = false">
    <template #acoes>
      <UiButton data-foco-inicial @click="trocando = false">Continuar revisando</UiButton>
      <UiButton variante="perigo" @click="trocarArquivo">Descartar e trocar</UiButton>
    </template>
  </UiModal>

  <UiModal :aberto="confirmandoDownload" titulo="Baixar com pendências?" icone="alert" @fechar="confirmandoDownload = false">
    <ul class="list-disc space-y-1 pl-5 text-sm text-ink">
      <li v-if="aRevisar.length">{{ aRevisar.length }} {{ aRevisar.length === 1 ? 'lançamento com valor sugerido' : 'lançamentos com valor sugerido' }} (texto na célula), não confirmados.</li>
      <li v-if="semValor.length">{{ semValor.length }} sem valor: ficam fora da planilha.</li>
      <li v-if="colunasSemRubrica.length">{{ colunasSemRubrica.length }} {{ colunasSemRubrica.length === 1 ? 'coluna' : 'colunas' }} sem rubrica: {{ colunasSemRubrica.map((coluna) => coluna.cabecalho).join(', ') }}. Não lançadas.</li>
    </ul>
    <template #acoes>
      <UiButton data-foco-inicial @click="confirmandoDownload = false; soRevisar = true">Revisar</UiButton>
      <UiButton variante="primario" icone="baixar" @click="baixar">Baixar assim mesmo</UiButton>
    </template>
  </UiModal>
</template>
