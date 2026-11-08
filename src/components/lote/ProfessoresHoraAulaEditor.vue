<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import ColarProfessores from '@/components/lote/ColarProfessores.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiEmptyState from '@/components/ui/UiEmptyState.vue'
import UiIcon from '@/components/ui/UiIcon.vue'

import { formatarMoeda, paraCentavos } from '@/domain/dinheiro'
import {
  aulasParaTexto,
  calcularHoraAula,
  formatarAulas,
  LIMITE_AULAS,
  type ProfessorHoraAula,
  type TabelaHoraAula,
} from '@/domain/horaAula'
import type { Empresa } from '@/domain/lote/tipos'
import { lerTabelaColada, montarProfessores, type ProfessorColado } from '@/features/lote/colarProfessores'
import { completarTabela, exportarProfessores, lerArquivoProfessores } from '@/features/lote/professoresArquivo'
import { baixarArquivo, nomeDeArquivo } from '@/lib/arquivos'
import { useAvisos } from '@/stores/avisos'
import { useCofre } from '@/stores/cofre'

const props = defineProps<{ empresa: Empresa }>()

const emit = defineEmits<{ irParaTabela: [] }>()

const { avisar } = useAvisos()
const { salvarProfessores } = useCofre()

interface LinhaRascunho {
  id: string
  nome: string
  turma: string
  matricula: string
  /** Texto digitado por tipo de aula ("36", "31,5"). */
  aulas: Record<string, string>
}

function novoId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function paraRascunho(professores: ProfessorHoraAula[] | undefined): LinhaRascunho[] {
  return (professores ?? []).map((professor) => ({
    id: professor.id,
    nome: professor.nome,
    turma: professor.turma,
    matricula: professor.matricula,
    aulas: Object.fromEntries(Object.entries(professor.aulas).map(([tipoId, valor]) => [tipoId, aulasParaTexto(valor)])),
  }))
}

const rascunho = ref<LinhaRascunho[]>(paraRascunho(props.empresa.professores))
const busca = ref('')
const todosOsTipos = ref(false)
const colando = ref(false)
const salvando = ref(false)

watch(
  () => props.empresa.professores,
  (professores) => {
    rascunho.value = paraRascunho(professores)
  },
)

const tabela = computed<TabelaHoraAula | null>(() => (props.empresa.horaAula?.tipos.length ? props.empresa.horaAula : null))

function quantidade(texto: string | undefined): number | null {
  const valor = paraCentavos(texto ?? '')

  return valor === null ? 0 : Number.isNaN(valor) || valor > LIMITE_AULAS ? null : valor
}

/** Lista convertida; erros por linha/tipo quando o texto nao e numero. */
const convertido = computed(() => {
  const erros = new Set<string>()
  const professores: ProfessorHoraAula[] = rascunho.value.map((linha) => {
    const aulas: Record<string, number> = {}

    for (const [tipoId, texto] of Object.entries(linha.aulas)) {
      const valor = quantidade(texto)

      if (valor === null) erros.add(`${linha.id}:${tipoId}`)
      else if (valor > 0) aulas[tipoId] = valor
    }

    return { id: linha.id, nome: linha.nome.trim(), turma: linha.turma.trim(), matricula: linha.matricula.trim(), aulas }
  })

  return { professores, erros }
})

const semNome = computed(() => convertido.value.professores.filter((professor) => !professor.nome).length)
const valido = computed(() => convertido.value.erros.size === 0 && semNome.value === 0)

const alterado = computed(() => JSON.stringify(convertido.value.professores) !== JSON.stringify(props.empresa.professores ?? []))

/** So os tipos usados por algum professor (menos colunas), salvo se pedir todos. */
const tiposVisiveis = computed(() => {
  const tipos = tabela.value?.tipos ?? []

  if (todosOsTipos.value) return tipos

  const usados = tipos.filter((tipo) => rascunho.value.some((linha) => (quantidade(linha.aulas[tipo.id]) ?? 0) > 0))

  return usados.length ? usados : tipos
})

const ocultos = computed(() => (tabela.value?.tipos.length ?? 0) - tiposVisiveis.value.length)

const visiveis = computed(() => {
  const termo = busca.value.trim().toLocaleLowerCase('pt-BR')

  return rascunho.value.filter((linha) => !termo || `${linha.nome} ${linha.turma} ${linha.matricula}`.toLocaleLowerCase('pt-BR').includes(termo))
})

function resumoDe(linha: LinhaRascunho) {
  if (!tabela.value) return null

  const quantidades: Record<string, number> = {}

  for (const [tipoId, texto] of Object.entries(linha.aulas)) quantidades[tipoId] = quantidade(texto) ?? 0

  return calcularHoraAula(tabela.value, quantidades)
}

const totais = computed(() => {
  const porTipo: Record<string, number> = {}
  let aulas = 0
  let valor = 0

  for (const linha of rascunho.value) {
    const resumo = resumoDe(linha)

    if (!resumo) continue

    for (const item of resumo.linhas) porTipo[item.tipoId] = (porTipo[item.tipoId] ?? 0) + item.quantidade

    aulas += resumo.quantidade
    valor += resumo.total
  }

  return { porTipo, aulas, valor }
})

function adicionar() {
  rascunho.value = [...rascunho.value, { id: novoId(), nome: '', turma: '', matricula: '', aulas: {} }]
  busca.value = ''
  requestAnimationFrame(() => document.getElementById(`professor-nome-${rascunho.value.at(-1)?.id}`)?.focus())
}

function remover(id: string) {
  rascunho.value = rascunho.value.filter((linha) => linha.id !== id)
}

function descartar() {
  rascunho.value = paraRascunho(props.empresa.professores)
}

async function salvar() {
  if (!valido.value || salvando.value) return

  salvando.value = true

  try {
    await salvarProfessores(props.empresa.id, convertido.value.professores)
    avisar('Professores salvos.')
  } catch (causa) {
    avisar(causa instanceof Error ? causa.message : 'Não foi possível salvar os professores.', 'erro')
  } finally {
    salvando.value = false
  }
}

function mesmoNome(a: string, b: string) {
  return a.trim().localeCompare(b.trim(), 'pt-BR', { sensitivity: 'base' }) === 0
}

async function importar(dados: { professores: ProfessorColado[]; tabela: TabelaHoraAula; modo: 'substituir' | 'mesclar' }) {
  const atuais = props.empresa.professores ?? []
  const novos = dados.professores.map((colado) => ({ id: novoId(), ...colado }))

  const lista =
    dados.modo === 'substituir'
      ? novos
      : [
          ...atuais.map((atual) => {
            const colado = novos.find((novo) => mesmoNome(novo.nome, atual.nome))

            return colado
              ? { ...atual, turma: colado.turma || atual.turma, matricula: colado.matricula || atual.matricula, aulas: colado.aulas }
              : atual
          }),
          ...novos.filter((novo) => !atuais.some((atual) => mesmoNome(atual.nome, novo.nome))),
        ]

  try {
    const tabelaMudou = dados.tabela.tipos.length !== props.empresa.horaAula?.tipos.length

    await salvarProfessores(props.empresa.id, lista, tabelaMudou ? dados.tabela : undefined)
    colando.value = false
    avisar(`${novos.length} professores importados${tabelaMudou ? ' e rubricas novas criadas na tabela' : ''}.`)
  } catch (causa) {
    avisar(causa instanceof Error ? causa.message : 'Não foi possível importar os professores.', 'erro')
  }
}

/* Arquivo de professores: exportar e importar direto (sem escolher colunas). */
const entradaArquivo = ref<HTMLInputElement | null>(null)
const textoParaLigar = ref<string | undefined>(undefined)
const processandoArquivo = ref(false)

async function exportar() {
  try {
    baixarArquivo(await exportarProfessores(props.empresa), `professores-${nomeDeArquivo(props.empresa.nome)}.xlsx`)
  } catch {
    avisar('Não foi possível exportar os professores.', 'erro')
  }
}

async function importarArquivo(arquivo: File | undefined) {
  if (!arquivo || !tabela.value) return

  processandoArquivo.value = true

  try {
    const lido = await lerArquivoProfessores(arquivo)
    const { tabela: completa } = completarTabela(tabela.value, lido.rubricas)
    const colada = lerTabelaColada(lido.texto, completa)
    const destinos = colada.colunas.map((coluna) => coluna.sugestao)

    // Alguma coluna sem rubrica reconhecida: abre a ligacao manual com o conteudo do arquivo.
    if (colada.avisos.length || !colada.linhas.length || destinos.some((destino) => !destino)) {
      textoParaLigar.value = lido.texto
      colando.value = true
      avisar('Confira a ligação das colunas do arquivo com as rubricas.', 'info')
      return
    }

    const resultado = montarProfessores(colada, destinos, completa)

    await importar({ professores: resultado.professores, tabela: resultado.tabela, modo: props.empresa.professores?.length ? 'mesclar' : 'substituir' })
  } catch (causa) {
    avisar(causa instanceof Error ? causa.message : 'Não foi possível ler o arquivo.', 'erro')
  } finally {
    processandoArquivo.value = false
    if (entradaArquivo.value) entradaArquivo.value.value = ''
  }
}

function abrirColar() {
  textoParaLigar.value = undefined
  colando.value = true
}
</script>

<template>
  <UiEmptyState
    v-if="!tabela"
    icone="relogio"
    titulo="Cadastre a tabela de hora-aula primeiro"
    descricao="Os professores guardam a quantidade de aulas de cada tipo; os valores vêm da tabela de hora-aula da instituição."
  >
    <UiButton variante="primario" @click="emit('irParaTabela')">Ir para a tabela de hora-aula</UiButton>
  </UiEmptyState>

  <div v-else>
    <div class="flex flex-col gap-3 border-b border-line px-5 py-3 lg:flex-row lg:items-center lg:justify-between">
      <p class="text-sm text-ink-2">
        Aulas <span class="font-semibold">padrão do mês</span> de cada professor. Na Folha e no modelo do lote elas já vêm preenchidas; altere só o que mudou no mês.
      </p>
      <div class="flex shrink-0 flex-wrap items-center gap-2">
        <UiButton variante="discreto" icone="baixar" :disabled="!empresa.professores?.length" @click="exportar">Exportar</UiButton>
        <UiButton variante="discreto" icone="enviar" :disabled="processandoArquivo" @click="entradaArquivo?.click()">
          {{ processandoArquivo ? 'Importando…' : 'Importar arquivo' }}
        </UiButton>
        <UiButton icone="planilha" @click="abrirColar">Colar do Excel</UiButton>
        <UiButton icone="adicionar" @click="adicionar">Adicionar professor</UiButton>
        <input
          ref="entradaArquivo"
          type="file"
          accept=".xlsx,.tsv,.txt,.csv"
          class="sr-only"
          tabindex="-1"
          aria-label="Arquivo de professores"
          @change="importarArquivo(($event.target as HTMLInputElement).files?.[0])"
        />
      </div>
    </div>

    <UiEmptyState
      v-if="!rascunho.length"
      icone="colaboradores"
      titulo="Nenhum professor cadastrado"
      descricao="Importe o arquivo de professores exportado pelo Exattus, cole a tabela de aulas do Excel ou adicione um a um."
    >
      <div class="flex flex-wrap justify-center gap-2">
        <UiButton variante="primario" icone="enviar" @click="entradaArquivo?.click()">Importar arquivo</UiButton>
        <UiButton icone="planilha" @click="abrirColar">Colar do Excel</UiButton>
        <UiButton icone="adicionar" @click="adicionar">Adicionar professor</UiButton>
      </div>
    </UiEmptyState>

    <template v-else>
      <div class="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
        <label class="relative block w-full max-w-72">
          <span class="sr-only">Buscar professores</span>
          <UiIcon nome="buscar" :tamanho="16" class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <input
            v-model="busca"
            type="search"
            placeholder="Nome, turma ou matrícula"
            class="h-9 w-full rounded-md border border-line-strong bg-surface pr-3 pl-9 text-sm outline-none placeholder:text-ink-subtle focus:border-primary focus:ring-3 focus:ring-primary-soft"
          />
        </label>
        <label class="flex items-center gap-2 text-[13px] text-ink-2">
          <input v-model="todosOsTipos" type="checkbox" class="size-4 accent-[var(--primary)]" />
          Mostrar todos os tipos de aula
          <span v-if="!todosOsTipos && ocultos > 0" class="text-muted">({{ ocultos }} sem aulas ocultos)</span>
        </label>
      </div>

      <div class="overflow-x-auto">
        <table class="tabela-professores w-full min-w-max text-sm">
          <thead class="bg-subtle text-xs text-muted">
            <tr>
              <th scope="col" class="sticky left-0 z-10 min-w-56 bg-subtle px-3 py-2 text-left font-medium">Professor</th>
              <th scope="col" class="min-w-40 px-2 py-2 text-left font-medium">Turma / disciplina</th>
              <th scope="col" class="w-28 px-2 py-2 text-left font-medium">Matrícula</th>
              <th v-for="tipo in tiposVisiveis" :key="tipo.id" scope="col" class="w-24 px-1.5 py-2 text-right align-bottom font-medium">
                <span class="block leading-tight text-ink-2">{{ tipo.descricao }}</span>
                <span class="num block font-normal">{{ formatarMoeda(tipo.valor) }}</span>
              </th>
              <th scope="col" class="w-20 px-2 py-2 text-right font-medium">Aulas</th>
              <th scope="col" class="w-32 px-3 py-2 text-right font-medium">Valor do mês</th>
              <th scope="col" class="w-10 px-1"><span class="sr-only">Remover</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="linha in visiveis" :key="linha.id" class="group border-t border-line">
              <td class="sticky left-0 z-10 bg-surface px-2 py-1 group-hover:bg-hover">
                <input
                  :id="`professor-nome-${linha.id}`"
                  v-model="linha.nome"
                  placeholder="Nome do professor"
                  aria-label="Nome do professor"
                  autocomplete="off"
                  class="celula w-full font-medium"
                  :class="!linha.nome.trim() && 'celula--erro'"
                />
              </td>
              <td class="px-1 py-1">
                <input v-model="linha.turma" placeholder="—" :aria-label="`Turma de ${linha.nome}`" autocomplete="off" class="celula w-full" />
              </td>
              <td class="px-1 py-1">
                <input v-model="linha.matricula" placeholder="—" :aria-label="`Matrícula de ${linha.nome}`" autocomplete="off" class="celula num w-full" />
              </td>
              <td v-for="tipo in tiposVisiveis" :key="tipo.id" class="px-1 py-1">
                <input
                  v-model="linha.aulas[tipo.id]"
                  inputmode="decimal"
                  placeholder="·"
                  :aria-label="`Aulas de ${tipo.descricao} de ${linha.nome}`"
                  autocomplete="off"
                  class="celula num w-full text-right"
                  :class="convertido.erros.has(`${linha.id}:${tipo.id}`) && 'celula--erro'"
                />
              </td>
              <td class="num px-2 py-1 text-right text-ink-2">{{ formatarAulas(resumoDe(linha)?.quantidade ?? 0) }}</td>
              <td class="num px-3 py-1 text-right font-medium text-ink">{{ formatarMoeda(resumoDe(linha)?.total ?? 0) }}</td>
              <td class="px-1 py-1 text-center">
                <UiButton variante="discreto" tamanho="sm" icone="lixeira" so-icone @click="remover(linha.id)">Remover {{ linha.nome }}</UiButton>
              </td>
            </tr>
            <tr v-if="!visiveis.length">
              <td :colspan="6 + tiposVisiveis.length" class="py-8 text-center text-muted">Nenhum professor corresponde à busca.</td>
            </tr>
          </tbody>
          <tfoot class="border-t-2 border-line bg-subtle/60 text-[13px] font-semibold">
            <tr>
              <th scope="row" class="sticky left-0 bg-subtle px-3 py-2 text-left">{{ rascunho.length }} professores</th>
              <td colspan="2" />
              <td v-for="tipo in tiposVisiveis" :key="tipo.id" class="num px-2 py-2 text-right text-ink-2">{{ formatarAulas(totais.porTipo[tipo.id] ?? 0) }}</td>
              <td class="num px-2 py-2 text-right">{{ formatarAulas(totais.aulas) }}</td>
              <td class="num px-3 py-2 text-right">{{ formatarMoeda(totais.valor) }}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <p class="px-5 pt-2 text-xs text-muted">
        Valor do mês = aulas × valor da hora-aula + hora-atividade + DSR, com as regras da tabela da instituição.
      </p>
    </template>

    <div v-if="rascunho.length || alterado" class="sticky bottom-0 flex flex-wrap items-center gap-2 border-t border-line bg-surface/90 px-5 py-3 backdrop-blur">
      <UiButton variante="primario" icone="salvar" :disabled="!alterado || !valido || salvando" @click="salvar">
        {{ salvando ? 'Salvando…' : 'Salvar professores' }}
      </UiButton>
      <UiButton v-if="alterado" variante="discreto" icone="reiniciar" @click="descartar">Descartar alterações</UiButton>
      <span v-if="semNome" class="text-xs text-negative">{{ semNome }} sem nome</span>
      <span v-else-if="convertido.erros.size" class="text-xs text-negative">{{ convertido.erros.size }} quantidades inválidas</span>
      <span v-else-if="!alterado" class="text-xs text-muted">Tudo salvo</span>
    </div>

    <ColarProfessores
      :aberto="colando"
      :tabela="tabela"
      :existentes="empresa.professores?.length ?? 0"
      :rascunho-alterado="alterado"
      :texto-inicial="textoParaLigar"
      @fechar="colando = false"
      @importar="importar"
    />
  </div>
</template>

<style scoped>
.celula {
  height: 2rem;
  padding: 0 0.5rem;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--ink);
  outline: none;
}

.celula:hover {
  border-color: var(--line);
}

.celula:focus {
  border-color: var(--primary);
  background: var(--surface);
  box-shadow: 0 0 0 3px var(--primary-soft);
}

.celula::placeholder {
  color: var(--ink-subtle);
}

.celula--erro {
  border-color: var(--danger);
  background: var(--danger-soft);
}
</style>
