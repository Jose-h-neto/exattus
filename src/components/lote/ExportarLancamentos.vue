<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import UiAlert from '@/components/ui/UiAlert.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiField from '@/components/ui/UiField.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiModal from '@/components/ui/UiModal.vue'

import { formatarData } from '@/domain/datas'
import { formatarAulas } from '@/domain/horaAula'
import { formatarCompetencia, lerCompetencia, type Empresa } from '@/domain/lote/tipos'
import { gerarPlanilhaLancamentos, montarLancamentos, primeiroDia, type OrigemLancamento } from '@/features/lote/lancamentos'
import { baixarArquivo, nomeDeArquivo } from '@/lib/arquivos'
import { useAvisos } from '@/stores/avisos'
import { useCofre } from '@/stores/cofre'

/**
 * Planilha de lancamentos para o sistema da folha: codigo da empresa, matricula,
 * codigo da rubrica, quantidade de aulas e o 1o dia da competencia.
 */
const props = defineProps<{
  aberto: boolean
  empresa: Empresa
  /** Professores e aulas do mes (cadastro padrao ou um lote). */
  origens: OrigemLancamento[]
  /** "AAAA-MM": fixa quando vem de um lote. */
  competencia?: string
  /** Texto curto da origem, ex.: "aulas padrão dos professores". */
  origemDescricao: string
}>()

const emit = defineEmits<{ fechar: [] }>()

const { avisar } = useAvisos()
const { atualizarEmpresa } = useCofre()

const competenciaTexto = ref('')
const codigoEmpresa = ref('')
const gerando = ref(false)

/** Sugestao: o mes atual. */
function competenciaPadrao(): string {
  const hoje = new Date()

  return `${String(hoje.getMonth() + 1).padStart(2, '0')}/${hoje.getFullYear()}`
}

watch(
  () => props.aberto,
  (aberto) => {
    if (!aberto) return

    competenciaTexto.value = props.competencia ? formatarCompetencia(props.competencia) : competenciaPadrao()
    codigoEmpresa.value = props.empresa.codigoFolha ?? ''
  },
  { immediate: true },
)

const competencia = computed(() => lerCompetencia(competenciaTexto.value))
const tabela = computed(() => props.empresa.horaAula ?? { tipos: [], horaAtividade: 0, divisorDsr: 6 })
const resultado = computed(() => montarLancamentos(props.origens, tabela.value))
const professores = computed(() => new Set(resultado.value.linhas.map((linha) => linha.matricula)).size)

const erroCompetencia = computed(() => (competencia.value ? undefined : 'Use MM/AAAA, ex.: 10/2026.'))
const erroCodigo = computed(() => (/^\d+$/.test(codigoEmpresa.value.trim()) ? undefined : 'Informe o código da empresa (só números).'))

const pode = computed(() => !erroCompetencia.value && !erroCodigo.value && resultado.value.linhas.length > 0 && !gerando.value)

async function baixar() {
  if (!pode.value || !competencia.value) return

  gerando.value = true

  try {
    const codigo = codigoEmpresa.value.trim()

    // Guarda o codigo da empresa na pasta para as proximas exportacoes.
    if (codigo !== (props.empresa.codigoFolha ?? '')) {
      await atualizarEmpresa(props.empresa.id, { nome: props.empresa.nome, cnpj: props.empresa.cnpj, codigoFolha: codigo })
    }

    const blob = await gerarPlanilhaLancamentos(resultado.value.linhas, codigo, competencia.value)
    const [ano, mes] = competencia.value.split('-')

    baixarArquivo(blob, `${nomeDeArquivo(props.empresa.nome).toUpperCase()}_LANCAMENTOS_HORA_AULA_${mes}.${ano}.xlsx`)
    avisar(`Planilha com ${resultado.value.linhas.length} lançamentos gerada.`)
    emit('fechar')
  } catch (causa) {
    avisar(causa instanceof Error ? causa.message : 'Não foi possível gerar a planilha.', 'erro')
  } finally {
    gerando.value = false
  }
}
</script>

<template>
  <UiModal
    :aberto="aberto"
    titulo="Planilha de lançamentos"
    icone="planilha"
    largura="larga"
    :descricao="`Gera a planilha de upload do sistema da folha com as ${origemDescricao}: uma linha por professor e rubrica, com a quantidade de aulas.`"
    @fechar="emit('fechar')"
  >
    <div class="space-y-4 text-ink">
      <div class="grid gap-x-4 sm:grid-cols-2">
        <UiField id="lancamentos-competencia" rotulo="Competência" :erro="erroCompetencia" ajuda="A data do movimento é sempre o 1º dia da competência.">
          <template #default="{ id, descricao, invalido }">
            <UiInput
              :id="id"
              v-model="competenciaTexto"
              placeholder="10/2026"
              inputmode="numeric"
              :disabled="Boolean(props.competencia)"
              :invalido="invalido"
              :aria-describedby="descricao"
              autocomplete="off"
            />
          </template>
        </UiField>
        <UiField id="lancamentos-empresa" rotulo="Código da empresa" :erro="erroCodigo" ajuda="Código da empresa no sistema da folha. Fica salvo na pasta.">
          <template #default="{ id, descricao, invalido }">
            <UiInput :id="id" v-model="codigoEmpresa" mono inputmode="numeric" placeholder="97834" :invalido="invalido" :aria-describedby="descricao" autocomplete="off" />
          </template>
        </UiField>
      </div>

      <dl class="grid grid-cols-3 overflow-hidden rounded-lg border border-line">
        <div class="px-4 py-3">
          <dt class="text-xs text-muted">Lançamentos</dt>
          <dd class="num text-xl font-semibold">{{ resultado.linhas.length }}</dd>
        </div>
        <div class="border-l border-line px-4 py-3">
          <dt class="text-xs text-muted">Professores</dt>
          <dd class="num text-xl font-semibold">{{ professores }}</dd>
        </div>
        <div class="border-l border-line px-4 py-3">
          <dt class="text-xs text-muted">Data do movimento</dt>
          <dd class="num text-xl font-semibold">{{ competencia ? formatarData(primeiroDia(competencia)) : '—' }}</dd>
        </div>
      </dl>

      <UiAlert v-if="resultado.semCodigo.length" tom="atencao" titulo="Rubricas sem código: aulas não lançadas">
        <ul class="list-disc space-y-0.5 pl-4">
          <li v-for="item in resultado.semCodigo" :key="item.descricao">
            <span class="font-medium">{{ item.descricao }}</span> · {{ item.professores.join(', ') }}
          </li>
        </ul>
        <p class="mt-1">Cadastre o código na aba Hora-aula da pasta.</p>
      </UiAlert>

      <UiAlert v-if="resultado.semMatricula.length" tom="atencao" titulo="Professores sem matrícula: não lançados">
        {{ resultado.semMatricula.join(', ') }}. Informe a matrícula na aba Professores.
      </UiAlert>

      <section v-if="resultado.linhas.length" aria-labelledby="titulo-previa-lancamentos">
        <h3 id="titulo-previa-lancamentos" class="mb-1.5 text-sm font-bold">Prévia</h3>
        <div class="max-h-60 overflow-y-auto rounded-md border border-line">
          <table class="w-full text-xs">
            <thead class="sticky top-0 bg-subtle text-muted">
              <tr>
                <th scope="col" class="px-3 py-1.5 text-left font-medium">Matrícula</th>
                <th scope="col" class="px-3 py-1.5 text-left font-medium">Professor</th>
                <th scope="col" class="px-3 py-1.5 text-left font-medium">Rubrica</th>
                <th scope="col" class="px-3 py-1.5 text-right font-medium">Aulas</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(linha, indice) in resultado.linhas" :key="indice" class="border-t border-line">
                <td class="num px-3 py-1">{{ linha.matricula }}</td>
                <td class="max-w-56 truncate px-3 py-1">{{ linha.nome }}</td>
                <td class="px-3 py-1"><span class="num font-semibold">{{ linha.rubrica }}</span> <span class="text-muted">{{ linha.descricao }}</span></td>
                <td class="num px-3 py-1 text-right">{{ formatarAulas(Math.round(linha.quantidade * 100)) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      <p v-else class="text-sm text-muted">Nenhum lançamento: não há professores com aulas, matrícula e rubrica com código.</p>
    </div>

    <template #acoes>
      <UiButton @click="emit('fechar')">Cancelar</UiButton>
      <UiButton variante="primario" icone="baixar" :disabled="!pode" @click="baixar">
        {{ gerando ? 'Gerando…' : 'Baixar planilha de lançamentos' }}
      </UiButton>
    </template>
  </UiModal>
</template>
