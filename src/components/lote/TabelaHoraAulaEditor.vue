<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import UiAlert from '@/components/ui/UiAlert.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiEmptyState from '@/components/ui/UiEmptyState.vue'
import UiField from '@/components/ui/UiField.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiModal from '@/components/ui/UiModal.vue'
import UiMoneyInput from '@/components/ui/UiMoneyInput.vue'

import { formatarDecimal, formatarMoeda, formatarPercentual, paraCentavos, paraInteiro } from '@/domain/dinheiro'
import {
  calcularHoraAula,
  LIMITE_DIVISOR_DSR,
  mesmaRubrica,
  RUBRICAS_HORA_AULA_PADRAO,
  tabelaHoraAulaPadrao,
  validarTabelaHoraAula,
  type TabelaHoraAula,
  type TipoAula,
} from '@/domain/horaAula'
import type { Empresa } from '@/domain/lote/tipos'
import { useAvisos } from '@/stores/avisos'
import { useCofre } from '@/stores/cofre'

const props = defineProps<{ empresa: Empresa }>()

const { avisar } = useAvisos()
const { instituicoes, salvarHoraAula } = useCofre()

interface LinhaRascunho {
  id: string
  descricao: string
  valor: string
}

interface Rascunho {
  tipos: LinhaRascunho[]
  horaAtividade: string
  divisorDsr: string
}

function novoId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function paraRascunho(tabela: TabelaHoraAula | undefined): Rascunho | null {
  if (!tabela) return null

  return {
    tipos: tabela.tipos.map((tipo) => ({ id: tipo.id, descricao: tipo.descricao, valor: formatarDecimal(tipo.valor) })),
    horaAtividade: formatarDecimal(tabela.horaAtividade).replace(/,00$/, ''),
    divisorDsr: String(tabela.divisorDsr),
  }
}

const rascunho = ref<Rascunho | null>(paraRascunho(props.empresa.horaAula))
const salvando = ref(false)
const removendo = ref(false)

watch(
  () => props.empresa.horaAula,
  (tabela) => {
    rascunho.value = paraRascunho(tabela)
  },
)

/** Rascunho convertido; null quando algum campo nao e numero. */
const tabela = computed<TabelaHoraAula | null>(() => {
  const r = rascunho.value

  if (!r) return null

  const horaAtividade = r.horaAtividade.trim() ? paraCentavos(r.horaAtividade) : 0
  const divisor = paraInteiro(r.divisorDsr, 1, LIMITE_DIVISOR_DSR)

  return {
    tipos: r.tipos.map((tipo) => ({ id: tipo.id, descricao: tipo.descricao.trim(), valor: paraCentavos(tipo.valor) ?? 0 })),
    horaAtividade: horaAtividade === null || Number.isNaN(horaAtividade) ? -1 : horaAtividade,
    divisorDsr: divisor === null || Number.isNaN(divisor) ? 0 : divisor,
  }
})

const erros = computed(() => (tabela.value ? validarTabelaHoraAula(tabela.value) : []))

const alterado = computed(() => JSON.stringify(rascunho.value) !== JSON.stringify(paraRascunho(props.empresa.horaAula)))

/** Exemplo ao vivo: 10 aulas do primeiro tipo, com as regras da tabela. */
const exemplo = computed(() => {
  const t = tabela.value
  const primeiro = t?.tipos[0]

  if (!t || !primeiro || erros.value.length) return null

  return { tipo: primeiro, resultado: calcularHoraAula(t, { [primeiro.id]: 1000 }) }
})

const outrasInstituicoes = computed(() => instituicoes.value.filter((empresa) => empresa.id !== props.empresa.id))

function comecar(base?: TabelaHoraAula) {
  rascunho.value = paraRascunho(base) ?? {
    tipos: [{ id: novoId(), descricao: '', valor: '' }],
    horaAtividade: '5',
    divisorDsr: '6',
  }

  // Copia de outra instituicao: ids novos para nao misturar as tabelas.
  if (base && rascunho.value) rascunho.value.tipos = rascunho.value.tipos.map((tipo) => ({ ...tipo, id: novoId() }))
}

function adicionar() {
  rascunho.value?.tipos.push({ id: novoId(), descricao: '', valor: '' })
}

/** Rubricas padrao que esta instituicao ainda nao tem (comparadas pela descricao). */
const sugeridas = computed(() =>
  RUBRICAS_HORA_AULA_PADRAO.filter((padrao) => !rascunho.value?.tipos.some((tipo) => mesmaRubrica(tipo.descricao, padrao.descricao))),
)

function cadastrarSugeridas(lista: readonly TipoAula[]) {
  const r = rascunho.value

  if (!r) return

  // Linha em branco (recem-criada) da lugar as sugeridas.
  r.tipos = r.tipos.filter((tipo) => tipo.descricao.trim() || tipo.valor.trim())
  r.tipos.push(...lista.map((tipo) => ({ id: novoId(), descricao: tipo.descricao, valor: formatarDecimal(tipo.valor) })))
}

function remover(indice: number) {
  rascunho.value?.tipos.splice(indice, 1)
}

function descartar() {
  rascunho.value = paraRascunho(props.empresa.horaAula)
}

async function salvar() {
  if (!tabela.value || erros.value.length || salvando.value) return

  salvando.value = true

  try {
    await salvarHoraAula(props.empresa.id, tabela.value)
    avisar('Tabela de hora-aula salva.')
  } catch (causa) {
    avisar(causa instanceof Error ? causa.message : 'Não foi possível salvar a tabela.', 'erro')
  } finally {
    salvando.value = false
  }
}

async function removerTabela() {
  try {
    await salvarHoraAula(props.empresa.id, null)
    rascunho.value = null
    avisar('Tabela de hora-aula removida.')
  } catch (causa) {
    avisar(causa instanceof Error ? causa.message : 'Não foi possível remover a tabela.', 'erro')
  } finally {
    removendo.value = false
  }
}
</script>

<template>
  <UiEmptyState
    v-if="!rascunho"
    icone="relogio"
    titulo="Sem tabela de hora-aula"
    descricao="Para instituições de ensino: cadastre o valor de cada tipo de aula, a hora-atividade e o divisor do DSR."
  >
    <div class="flex flex-col items-center gap-2">
      <UiButton variante="primario" icone="adicionar" @click="comecar(tabelaHoraAulaPadrao())">Usar as rubricas padrão ({{ RUBRICAS_HORA_AULA_PADRAO.length }})</UiButton>
      <UiButton variante="discreto" tamanho="sm" @click="comecar()">Começar em branco</UiButton>
      <template v-if="outrasInstituicoes.length">
        <span class="text-xs text-muted">ou copie de outra instituição</span>
        <div class="flex flex-wrap justify-center gap-1.5">
          <UiButton v-for="outra in outrasInstituicoes" :key="outra.id" tamanho="sm" @click="comecar(outra.horaAula)">{{ outra.nome }}</UiButton>
        </div>
      </template>
    </div>
  </UiEmptyState>

  <div v-else class="grid gap-6 p-5 xl:grid-cols-[minmax(0,1fr)_320px]">
    <div class="min-w-0 space-y-4">
      <div class="overflow-hidden rounded-md border border-line">
        <table class="w-full text-sm">
          <caption class="sr-only">Tipos de aula e valor da hora-aula</caption>
          <thead class="bg-subtle text-xs text-muted">
            <tr>
              <th scope="col" class="px-3 py-2 text-left font-medium">Tipo de aula</th>
              <th scope="col" class="w-44 px-2 py-2 text-left font-medium">Valor da hora-aula</th>
              <th scope="col" class="w-12 px-2 py-2"><span class="sr-only">Remover</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(tipo, indice) in rascunho.tipos" :key="tipo.id" class="border-t border-line">
              <td class="px-2 py-1.5">
                <UiInput v-model="tipo.descricao" :aria-label="`Descrição do tipo de aula ${indice + 1}`" placeholder="Ex.: Ensino Médio" autocomplete="off" />
              </td>
              <td class="px-2 py-1.5">
                <UiMoneyInput v-model="tipo.valor" :aria-label="`Valor da hora-aula de ${tipo.descricao || `tipo ${indice + 1}`}`" placeholder="0,00" />
              </td>
              <td class="px-2 py-1.5 text-center">
                <UiButton variante="discreto" tamanho="sm" icone="lixeira" so-icone :disabled="rascunho.tipos.length === 1" @click="remover(indice)">
                  Remover {{ tipo.descricao || `tipo ${indice + 1}` }}
                </UiButton>
              </td>
            </tr>
          </tbody>
        </table>
        <div class="border-t border-line px-2 py-1.5">
          <UiButton variante="discreto" tamanho="sm" icone="adicionar" @click="adicionar">Adicionar tipo de aula</UiButton>
        </div>
      </div>

      <section v-if="sugeridas.length" class="rounded-md border border-dashed border-line-strong px-3 py-3" aria-labelledby="titulo-sugeridas">
        <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 id="titulo-sugeridas" class="text-[13px] font-semibold text-ink">Rubricas sugeridas</h3>
            <p class="text-xs text-muted">Tipos de aula padrão que esta instituição ainda não tem. Clique para cadastrar.</p>
          </div>
          <UiButton tamanho="sm" icone="adicionar" @click="cadastrarSugeridas(sugeridas)">Cadastrar todas ({{ sugeridas.length }})</UiButton>
        </div>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="sugerida in sugeridas"
            :key="sugerida.id"
            type="button"
            class="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[13px] text-ink-2 transition-colors hover:border-primary hover:bg-primary-soft hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
            @click="cadastrarSugeridas([sugerida])"
          >
            <span aria-hidden="true">+</span>
            {{ sugerida.descricao }}
            <span class="num text-xs text-muted">{{ formatarMoeda(sugerida.valor) }}</span>
          </button>
        </div>
      </section>

      <div class="grid gap-x-4 sm:grid-cols-2">
        <UiField id="hora-atividade" rotulo="Hora-atividade" ajuda="Adicional sobre o total das aulas do mês. Ex.: 5%.">
          <template #default="{ id }">
            <UiInput :id="id" v-model="rascunho.horaAtividade" inputmode="decimal" sufixo="% das aulas" alinhamento="direita" />
          </template>
        </UiField>
        <UiField id="divisor-dsr" rotulo="Divisor do DSR" ajuda="DSR = (total das aulas + hora-atividade) ÷ divisor. Ex.: 6.">
          <template #default="{ id }">
            <UiInput :id="id" v-model="rascunho.divisorDsr" inputmode="numeric" prefixo="÷" alinhamento="direita" />
          </template>
        </UiField>
      </div>

      <UiAlert v-if="erros.length && alterado" tom="atencao">
        <ul class="list-disc space-y-0.5 pl-4">
          <li v-for="mensagem in erros" :key="mensagem">{{ mensagem }}</li>
        </ul>
      </UiAlert>

      <div class="flex flex-wrap items-center gap-2">
        <UiButton variante="primario" icone="salvar" :disabled="!alterado || erros.length > 0 || salvando" @click="salvar">
          {{ salvando ? 'Salvando…' : 'Salvar tabela' }}
        </UiButton>
        <UiButton v-if="alterado && empresa.horaAula" variante="discreto" icone="reiniciar" @click="descartar">Descartar alterações</UiButton>
        <UiButton v-if="empresa.horaAula" variante="discreto" icone="lixeira" class="ml-auto" @click="removendo = true">Remover tabela</UiButton>
        <span v-if="!alterado && empresa.horaAula" class="text-xs text-muted">Tudo salvo</span>
      </div>
    </div>

    <aside class="h-fit rounded-md border border-line bg-subtle/60 p-4 text-[13px]" aria-label="Exemplo de cálculo">
      <p class="mb-2 font-semibold text-ink">Como fica o cálculo</p>
      <template v-if="exemplo">
        <p class="mb-3 text-muted">Exemplo com 10 aulas de {{ exemplo.tipo.descricao }}:</p>
        <dl class="space-y-1.5">
          <div class="flex justify-between gap-3">
            <dt class="text-ink-2">10 × {{ formatarMoeda(exemplo.tipo.valor) }}</dt>
            <dd class="num">{{ formatarMoeda(exemplo.resultado.totalAulas) }}</dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-ink-2">Hora-atividade {{ formatarPercentual(exemplo.resultado.percentualHoraAtividade) }}</dt>
            <dd class="num">{{ formatarMoeda(exemplo.resultado.horaAtividade) }}</dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-ink-2">DSR ÷ {{ exemplo.resultado.divisorDsr }}</dt>
            <dd class="num">{{ formatarMoeda(exemplo.resultado.dsr) }}</dd>
          </div>
          <div class="flex justify-between gap-3 border-t border-line pt-1.5 font-bold text-ink">
            <dt>Total</dt>
            <dd class="num">{{ formatarMoeda(exemplo.resultado.total) }}</dd>
          </div>
        </dl>
        <p class="mt-3 text-xs text-muted">O total entra nos proventos da folha e é base do INSS e do IRRF.</p>
      </template>
      <p v-else class="text-muted">Preencha os tipos de aula e os valores para ver um exemplo.</p>
    </aside>
  </div>

  <UiModal
    tom="perigo"
    :aberto="removendo"
    titulo="Remover tabela de hora-aula?"
    :descricao="`${empresa.nome} deixa de aparecer como instituição na Folha mensal. Os lotes já importados não mudam.`"
    @fechar="removendo = false"
  >
    <template #acoes>
      <UiButton data-foco-inicial @click="removendo = false">Cancelar</UiButton>
      <UiButton variante="perigo" @click="removerTabela">Remover</UiButton>
    </template>
  </UiModal>
</template>
