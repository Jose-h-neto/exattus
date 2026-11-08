<script setup lang="ts">
import { computed, watch } from 'vue'

import UiIcon from '@/components/ui/UiIcon.vue'
import UiInfo from '@/components/ui/UiInfo.vue'

import { formatarMoeda, formatarPercentual, paraCentavos } from '@/domain/dinheiro'
import { aulasParaTexto, formatarAulas } from '@/domain/horaAula'
import type { Empresa } from '@/domain/lote/tipos'
import type { LeituraHoraAula } from '@/features/folha'

/**
 * Lancamento por hora-aula: escolhe a instituicao (pasta do cofre com tabela de
 * hora-aula) e informa a quantidade de aulas do mes de cada tipo.
 */
const instituicaoId = defineModel<string>('instituicao', { required: true })
const professorId = defineModel<string>('professor', { required: true })
const aulas = defineModel<Record<string, string>>('aulas', { required: true })
/** Funcionario ou referencia da folha: recebe o nome do professor escolhido. */
const referencia = defineModel<string>('referencia', { required: true })

const props = defineProps<{
  instituicoes: Empresa[]
  leitura: LeituraHoraAula | null
  erro?: string
  carregado: boolean
}>()

const instituicao = computed(() => props.instituicoes.find((empresa) => empresa.id === instituicaoId.value))
const tabela = computed(() => instituicao.value?.horaAula ?? null)

// Sem escolha (ou instituicao excluida): assume a primeira da lista.
watch(
  () => [props.instituicoes, instituicaoId.value] as const,
  ([lista, atual]) => {
    if (!lista.some((empresa) => empresa.id === atual) && lista[0]) instituicaoId.value = lista[0].id
  },
  { immediate: true },
)

const resultado = computed(() => props.leitura?.resultado ?? null)

const professores = computed(() =>
  [...(instituicao.value?.professores ?? [])].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
)
const professor = computed(() => professores.value.find((item) => item.id === professorId.value))

/** Aulas padrao do professor, no formato dos campos. */
function aulasPadrao(id: string): Record<string, string> {
  const escolhido = professores.value.find((item) => item.id === id)

  return Object.fromEntries((tabela.value?.tipos ?? []).map((tipo) => [tipo.id, aulasParaTexto(escolhido?.aulas[tipo.id])]))
}

/** Normaliza para comparar: "36,0", "36" e "" vs. ausente. */
function mesmasAulas(a: Record<string, string>, b: Record<string, string>): boolean {
  return (tabela.value?.tipos ?? []).every((tipo) => (paraCentavos(a[tipo.id] ?? '') ?? 0) === (paraCentavos(b[tipo.id] ?? '') ?? 0))
}

const alteradoDoPadrao = computed(() => Boolean(professor.value) && !mesmasAulas(aulas.value, aulasPadrao(professorId.value)))

function escolherProfessor(id: string) {
  const anterior = professor.value
  const novo = professores.value.find((item) => item.id === id)

  professorId.value = id

  if (!novo) return

  aulas.value = aulasPadrao(id)

  // So troca a referencia se estava vazia ou era o professor anterior.
  if (!referencia.value.trim() || referencia.value === anterior?.nome) referencia.value = novo.nome
}

function restaurarPadrao() {
  aulas.value = aulasPadrao(professorId.value)
}

// Trocou de instituicao: o professor escolhido nao vale mais.
watch(instituicaoId, () => {
  if (professorId.value && !professor.value) professorId.value = ''
})

function totalDoTipo(tipoId: string): number | null {
  return resultado.value?.linhas.find((linha) => linha.tipoId === tipoId)?.total ?? null
}

function atualizar(tipoId: string, valor: string) {
  aulas.value = { ...aulas.value, [tipoId]: valor }
}
</script>

<template>
  <div class="col-span-2 space-y-3">
    <div v-if="carregado && !instituicoes.length" class="rounded-md border border-dashed border-line-strong px-4 py-5 text-center text-sm">
      <p class="font-semibold text-ink">Nenhuma instituição com tabela de hora-aula</p>
      <p class="mt-1 text-muted">Cadastre os valores na pasta da empresa, em Cofre de lotes.</p>
      <RouterLink :to="{ name: 'cofre' }" class="mt-3 inline-flex text-[13px] font-medium text-primary hover:underline">Abrir o cofre</RouterLink>
    </div>

    <template v-else-if="instituicoes.length">
      <div class="ex-field campo-alinhado">
        <div class="flex min-w-0 flex-1 items-end gap-1.5">
          <label for="folha-instituicao" class="ex-label">Instituição</label>
          <RouterLink
            v-if="instituicao"
            :to="{ name: 'cofre-empresa', params: { empresaId: instituicao.id }, query: { aba: 'hora-aula' } }"
            class="ml-auto shrink-0 text-xs font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary"
          >
            Editar valores
          </RouterLink>
        </div>
        <div :class="['ex-control', { 'ex-control--error': erro }]">
          <UiIcon nome="empresa" :tamanho="16" class="ml-3 shrink-0 text-muted" />
          <select id="folha-instituicao" v-model="instituicaoId" class="ex-input cursor-pointer bg-transparent">
            <option v-for="empresa in instituicoes" :key="empresa.id" :value="empresa.id">{{ empresa.nome }}</option>
          </select>
        </div>
        <p v-if="erro" class="ex-error campo-mensagem"><UiIcon nome="alerta" :tamanho="14" />{{ erro }}</p>
        <span v-else class="campo-mensagem" aria-hidden="true" />
      </div>

      <div class="ex-field campo-alinhado">
        <div class="flex min-w-0 flex-1 items-end gap-1.5">
          <label for="folha-professor" class="ex-label">Professor <span class="ex-label__opt">(aulas padrão)</span></label>
          <RouterLink
            v-if="instituicao"
            :to="{ name: 'cofre-empresa', params: { empresaId: instituicao.id }, query: { aba: 'professores' } }"
            class="ml-auto shrink-0 text-xs font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary"
          >
            {{ professores.length ? 'Editar professores' : 'Cadastrar professores' }}
          </RouterLink>
        </div>
        <div class="ex-control">
          <UiIcon nome="colaboradores" :tamanho="16" class="ml-3 shrink-0 text-muted" />
          <select
            id="folha-professor"
            :value="professorId"
            class="ex-input cursor-pointer bg-transparent"
            :disabled="!professores.length"
            @change="escolherProfessor(($event.target as HTMLSelectElement).value)"
          >
            <option value="">{{ professores.length ? 'Lançar as aulas manualmente' : 'Nenhum professor cadastrado' }}</option>
            <option v-for="item in professores" :key="item.id" :value="item.id">{{ item.nome }}{{ item.turma ? ` · ${item.turma}` : '' }}</option>
          </select>
        </div>
        <p v-if="alteradoDoPadrao" class="campo-mensagem flex items-center gap-2 text-xs text-warning">
          Aulas alteradas em relação ao padrão.
          <button type="button" class="font-medium text-primary hover:underline" @click="restaurarPadrao">Restaurar padrão</button>
        </p>
        <p v-else-if="professor" class="campo-mensagem text-xs text-muted">Aulas padrão de {{ professor.nome }}. Altere só o que mudou no mês.</p>
        <span v-else class="campo-mensagem" aria-hidden="true" />
      </div>

      <div v-if="tabela" class="overflow-hidden rounded-md border border-line">
        <table class="w-full text-sm">
          <caption class="sr-only">Aulas do mês por tipo de aula</caption>
          <thead class="bg-subtle text-xs text-muted">
            <tr>
              <th scope="col" class="px-3 py-2 text-left font-medium">Tipo de aula</th>
              <th scope="col" class="w-28 px-2 py-2 text-left font-medium">Aulas no mês</th>
              <th scope="col" class="w-28 px-3 py-2 text-right font-medium">Valor</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="tipo in tabela.tipos" :key="tipo.id" class="border-t border-line">
              <th scope="row" class="px-3 py-1.5 text-left font-normal">
                <label :for="`aula-${tipo.id}`" class="block font-medium text-ink">{{ tipo.descricao }}</label>
                <span class="num text-xs text-muted">{{ formatarMoeda(tipo.valor) }} / aula</span>
              </th>
              <td class="px-2 py-1.5">
                <div :class="['ex-control h-9', { 'ex-control--error': leitura?.erros[tipo.id] }]">
                  <input
                    :id="`aula-${tipo.id}`"
                    :value="aulas[tipo.id] ?? ''"
                    inputmode="decimal"
                    placeholder="0"
                    autocomplete="off"
                    class="ex-input ex-num text-right"
                    :aria-invalid="Boolean(leitura?.erros[tipo.id]) || undefined"
                    :title="leitura?.erros[tipo.id]"
                    @input="atualizar(tipo.id, ($event.target as HTMLInputElement).value)"
                  />
                </div>
              </td>
              <td class="num px-3 py-1.5 text-right" :class="totalDoTipo(tipo.id) ? 'text-ink' : 'text-muted'">
                {{ totalDoTipo(tipo.id) === null ? '—' : formatarMoeda(totalDoTipo(tipo.id)!) }}
              </td>
            </tr>
          </tbody>
          <tfoot v-if="resultado && resultado.quantidade > 0" class="border-t border-line bg-subtle/60 text-[13px]">
            <tr>
              <th scope="row" class="px-3 pt-2 text-left font-medium text-ink-2">Total das aulas</th>
              <td class="num px-2 pt-2 text-ink-2">{{ formatarAulas(resultado.quantidade) }}</td>
              <td class="num px-3 pt-2 text-right">{{ formatarMoeda(resultado.totalAulas) }}</td>
            </tr>
            <tr>
              <th scope="row" class="px-3 pt-1 text-left font-medium text-ink-2">
                Hora-atividade
                <span class="num font-normal text-muted">{{ formatarPercentual(resultado.percentualHoraAtividade) }}</span>
              </th>
              <td />
              <td class="num px-3 pt-1 text-right">{{ formatarMoeda(resultado.horaAtividade) }}</td>
            </tr>
            <tr>
              <th scope="row" class="px-3 pt-1 text-left font-medium text-ink-2">
                <span class="inline-flex items-center gap-1">
                  DSR <span class="num font-normal text-muted">÷ {{ resultado.divisorDsr }}</span>
                  <UiInfo texto="(Total das aulas + hora-atividade) dividido pelo divisor da instituição." rotulo="Sobre o DSR da hora-aula" />
                </span>
              </th>
              <td />
              <td class="num px-3 pt-1 text-right">{{ formatarMoeda(resultado.dsr) }}</td>
            </tr>
            <tr>
              <th scope="row" class="px-3 pt-1.5 pb-2 text-left font-bold text-ink">Total hora-aula</th>
              <td />
              <td class="num px-3 pt-1.5 pb-2 text-right font-bold text-ink">{{ formatarMoeda(resultado.total) }}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </template>
  </div>
</template>
