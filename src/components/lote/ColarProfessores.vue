<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import UiAlert from '@/components/ui/UiAlert.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiModal from '@/components/ui/UiModal.vue'

import { formatarMoeda } from '@/domain/dinheiro'
import { formatarAulas, RUBRICAS_HORA_AULA_PADRAO, type TabelaHoraAula } from '@/domain/horaAula'
import {
  lerTabelaColada,
  montarProfessores,
  PREFIXO_NOVA_RUBRICA,
  type DestinoColuna,
  type ProfessorColado,
} from '@/features/lote/colarProfessores'
import { mesmaRubrica } from '@/domain/horaAula'

const props = defineProps<{
  aberto: boolean
  tabela: TabelaHoraAula
  /** Ja existem professores cadastrados (oferece substituir ou mesclar). */
  existentes: number
  /** Ha alteracoes nao salvas no editor (serao descartadas). */
  rascunhoAlterado: boolean
  /** Conteudo ja carregado (ex.: arquivo importado que precisa de ligacao manual de colunas). */
  textoInicial?: string
}>()

const emit = defineEmits<{
  fechar: []
  importar: [dados: { professores: ProfessorColado[]; tabela: TabelaHoraAula; modo: 'substituir' | 'mesclar' }]
}>()

const texto = ref('')
const destinos = ref<DestinoColuna[]>([])
const modo = ref<'substituir' | 'mesclar'>('mesclar')

watch(
  () => props.aberto,
  (aberto) => {
    if (!aberto) return
    texto.value = props.textoInicial ?? ''
    destinos.value = []
    modo.value = props.existentes ? 'mesclar' : 'substituir'
  },
)

const colada = computed(() => (texto.value.trim() ? lerTabelaColada(texto.value, props.tabela) : null))

// Novo texto colado: volta para as sugestoes automaticas.
watch(colada, (leitura) => {
  destinos.value = leitura?.colunas.map((coluna) => coluna.sugestao) ?? []
})

const faltantes = computed(() =>
  RUBRICAS_HORA_AULA_PADRAO.filter((padrao) => !props.tabela.tipos.some((tipo) => mesmaRubrica(tipo.descricao, padrao.descricao))),
)

const opcoes = computed(() => [
  { valor: '', rotulo: 'Ignorar esta coluna' },
  ...props.tabela.tipos.map((tipo) => ({ valor: tipo.id, rotulo: `${tipo.descricao} · ${formatarMoeda(tipo.valor)}` })),
  ...faltantes.value.map((padrao) => ({
    valor: `${PREFIXO_NOVA_RUBRICA}${padrao.id}`,
    rotulo: `+ Criar rubrica: ${padrao.descricao} · ${formatarMoeda(padrao.valor)}`,
  })),
])

const resultado = computed(() => (colada.value ? montarProfessores(colada.value, destinos.value, props.tabela) : null))

function totalAulas(professor: ProfessorColado): number {
  return Object.values(professor.aulas).reduce((soma, valor) => soma + valor, 0)
}

const comAulas = computed(() => resultado.value?.professores.filter((professor) => totalAulas(professor) > 0).length ?? 0)

function confirmar() {
  if (!resultado.value?.professores.length) return

  emit('importar', { professores: resultado.value.professores, tabela: resultado.value.tabela, modo: modo.value })
}
</script>

<template>
  <UiModal
    :aberto="aberto"
    titulo="Colar professores do Excel"
    icone="planilha"
    largura="larga"
    descricao="No Excel, selecione a tabela com o cabeçalho (nome, turma e as colunas de aulas), copie com Ctrl+C e cole abaixo com Ctrl+V."
    @fechar="emit('fechar')"
  >
    <div class="space-y-4 text-ink">
      <label class="block">
        <span class="sr-only">Tabela copiada do Excel</span>
        <textarea
          v-model="texto"
          rows="5"
          spellcheck="false"
          placeholder="Cole aqui (Ctrl+V)…"
          class="num w-full resize-y rounded-md border border-line-strong bg-surface px-3 py-2 font-mono text-xs outline-none placeholder:font-sans placeholder:text-sm placeholder:text-ink-subtle focus:border-primary focus:ring-3 focus:ring-primary-soft"
        />
      </label>

      <template v-if="colada">
        <UiAlert v-if="colada.avisos.length" tom="atencao">
          <p v-for="aviso in colada.avisos" :key="aviso">{{ aviso }}</p>
        </UiAlert>

        <section v-if="colada.colunas.length" aria-labelledby="titulo-colunas">
          <h3 id="titulo-colunas" class="text-sm font-bold">Colunas de aulas → rubrica</h3>
          <p class="mb-2 text-xs text-muted">Colunas ligadas à mesma rubrica são somadas (ex.: Fund. I + Fund. II).</p>
          <ul class="divide-y divide-line rounded-md border border-line">
            <li v-for="(coluna, indice) in colada.colunas" :key="coluna.indice" class="grid items-center gap-2 px-3 py-2 sm:grid-cols-[10rem_minmax(0,1fr)]">
              <label :for="`coluna-${coluna.indice}`" class="truncate text-sm font-semibold" :title="coluna.cabecalho">{{ coluna.cabecalho }}</label>
              <div class="ex-control h-9">
                <select :id="`coluna-${coluna.indice}`" v-model="destinos[indice]" class="ex-input cursor-pointer bg-transparent text-sm" :class="!destinos[indice] && 'text-muted'">
                  <option v-for="opcao in opcoes" :key="opcao.valor" :value="opcao.valor">{{ opcao.rotulo }}</option>
                </select>
              </div>
            </li>
          </ul>
        </section>

        <section v-if="resultado?.professores.length" aria-labelledby="titulo-previa">
          <h3 id="titulo-previa" class="text-sm font-bold">
            {{ resultado.professores.length }} {{ resultado.professores.length === 1 ? 'professor' : 'professores' }}
            <span class="font-normal text-muted">· {{ comAulas }} com aulas</span>
          </h3>
          <ul class="mt-2 max-h-44 divide-y divide-line overflow-y-auto rounded-md border border-line text-xs">
            <li v-for="(professor, indice) in resultado.professores" :key="indice" class="flex items-center justify-between gap-3 px-3 py-1.5">
              <span class="min-w-0 truncate">
                <span class="font-medium text-ink">{{ professor.nome }}</span>
                <span v-if="professor.turma" class="text-muted"> · {{ professor.turma }}</span>
              </span>
              <span class="num shrink-0 text-ink-2">{{ formatarAulas(totalAulas(professor)) }} aulas</span>
            </li>
          </ul>
          <p v-if="colada.invalidas" class="mt-1 text-xs text-warning">{{ colada.invalidas }} células não numéricas foram ignoradas.</p>
          <p v-if="resultado.criadas.length" class="mt-1 text-xs text-info">
            Rubricas que serão criadas na tabela: {{ resultado.criadas.map((tipo) => `${tipo.descricao} (${formatarMoeda(tipo.valor)})`).join(', ') }}.
          </p>
        </section>

        <fieldset v-if="existentes && resultado?.professores.length" class="space-y-1.5 text-sm">
          <legend class="mb-1 font-bold">Já há {{ existentes }} professores cadastrados</legend>
          <label class="flex items-start gap-2">
            <input v-model="modo" type="radio" value="mesclar" class="mt-1 accent-[var(--primary)]" />
            <span><span class="font-medium">Atualizar e adicionar</span> <span class="text-muted">· mesmo nome: troca as aulas; nomes novos entram na lista</span></span>
          </label>
          <label class="flex items-start gap-2">
            <input v-model="modo" type="radio" value="substituir" class="mt-1 accent-[var(--primary)]" />
            <span><span class="font-medium">Substituir a lista</span> <span class="text-muted">· remove os atuais e usa só a tabela colada</span></span>
          </label>
        </fieldset>

        <UiAlert v-if="rascunhoAlterado && resultado?.professores.length" tom="atencao">
          Há alterações não salvas na lista de professores. Elas serão descartadas ao importar.
        </UiAlert>
      </template>
    </div>

    <template #acoes>
      <UiButton @click="emit('fechar')">Cancelar</UiButton>
      <UiButton variante="primario" icone="salvar" :disabled="!resultado?.professores.length" @click="confirmar">
        {{ resultado?.professores.length ? `Importar ${resultado.professores.length} professores` : 'Importar' }}
      </UiButton>
    </template>
  </UiModal>
</template>
