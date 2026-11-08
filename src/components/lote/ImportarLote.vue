<script setup lang="ts">
import { computed, reactive, ref, shallowRef, watch } from 'vue'
import { useRouter } from 'vue-router'

import UiAlert from '@/components/ui/UiAlert.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiField from '@/components/ui/UiField.vue'
import UiIcon from '@/components/ui/UiIcon.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiModal from '@/components/ui/UiModal.vue'
import UiMoneyInput from '@/components/ui/UiMoneyInput.vue'

import { paraCentavos } from '@/domain/dinheiro'
import {
  formatarCnpj,
  formatarCompetencia,
  lerCompetencia,
  normalizarCnpj,
  resumirLinhas,
} from '@/domain/lote/tipos'
import { useBaixarModelo } from '@/features/lote/acoes'
import { NOME_ABA } from '@/features/lote/colunas'
import { lerPlanilha, type DadosAbaLote, type PlanilhaLida } from '@/features/lote/leitura'
import { processarRegistros } from '@/features/lote/processar'
import { useAvisos } from '@/stores/avisos'
import { useCofre } from '@/stores/cofre'
import { useParametros } from '@/stores/parametros'

/** empresaId: importacao feita de dentro de uma pasta (o destino fica fixo). */
const props = defineProps<{ aberto: boolean; empresaId?: string }>()

const emit = defineEmits<{ fechar: [] }>()

const NOVA = '__nova__'

const router = useRouter()
const { avisar } = useAvisos()
const { tabelaInss, tabelaIrrf } = useParametros()
const { empresas, obterEmpresa, empresaPorCnpj, criarEmpresa, salvarLote } = useCofre()
const { gerandoModelo, baixarModelo } = useBaixarModelo()

const entrada = ref<HTMLInputElement | null>(null)
const arrastando = ref(false)
const lendo = ref(false)
const salvando = ref(false)
const erroArquivo = ref<string | null>(null)
const arquivo = shallowRef<File | null>(null)
const lida = shallowRef<PlanilhaLida | null>(null)

const form = reactive({ destino: NOVA, nome: '', cnpj: '', competencia: '', descricao: '', tolerancia: '' })

/** CNPJ que veio na aba Lote, para avisar quando difere da pasta escolhida. */
const cnpjPlanilha = ref('')

function reiniciar() {
  arrastando.value = false
  lendo.value = false
  salvando.value = false
  erroArquivo.value = null
  arquivo.value = null
  lida.value = null
  cnpjPlanilha.value = ''
  Object.assign(form, { destino: props.empresaId ?? NOVA, nome: '', cnpj: '', competencia: '', descricao: '', tolerancia: '' })
}

watch(() => props.aberto, (aberto) => aberto && reiniciar(), { immediate: true })

function mesmoNome(a: string, b: string) {
  return a.trim().localeCompare(b.trim(), 'pt-BR', { sensitivity: 'base' }) === 0
}

function preencher(lote: DadosAbaLote) {
  const competencia = lerCompetencia(lote.competencia)

  form.competencia = competencia ? formatarCompetencia(competencia) : lote.competencia
  form.descricao = lote.descricao
  form.tolerancia = lote.tolerancia
  form.nome = lote.empresa
  form.cnpj = normalizarCnpj(lote.cnpj).length === 14 ? formatarCnpj(normalizarCnpj(lote.cnpj)) : lote.cnpj
  cnpjPlanilha.value = normalizarCnpj(lote.cnpj)

  if (props.empresaId) {
    form.destino = props.empresaId
    return
  }

  const existente =
    empresaPorCnpj(lote.cnpj) ?? (lote.empresa ? empresas.value.find((empresa) => mesmoNome(empresa.nome, lote.empresa)) : undefined)

  form.destino = existente?.id ?? NOVA
}

async function escolher(novo: File | undefined) {
  if (!novo) return

  if (!/\.xlsx$/i.test(novo.name)) {
    erroArquivo.value = 'Envie um arquivo .xlsx. Planilhas .xls antigas precisam ser salvas como .xlsx no Excel.'
    return
  }

  lendo.value = true
  erroArquivo.value = null

  try {
    const resultado = await lerPlanilha(novo)

    arquivo.value = novo
    lida.value = resultado
    preencher(resultado.lote)
  } catch (causa) {
    erroArquivo.value = causa instanceof Error ? causa.message : 'Não foi possível ler a planilha.'
  } finally {
    lendo.value = false
    if (entrada.value) entrada.value.value = ''
  }
}

function soltar(evento: DragEvent) {
  arrastando.value = false
  void escolher(evento.dataTransfer?.files[0])
}

const tolerancia = computed(() => paraCentavos(form.tolerancia))

const linhas = computed(() =>
  lida.value
    ? processarRegistros(lida.value.registros, tolerancia.value !== null && !Number.isNaN(tolerancia.value) ? tolerancia.value : 0, {
        inss: tabelaInss.value,
        irrf: tabelaIrrf.value,
      })
    : [],
)

const resumo = computed(() => resumirLinhas(linhas.value))
const comErro = computed(() => linhas.value.filter((linha) => linha.status === 'erro'))

const empresaFixa = computed(() => (props.empresaId ? obterEmpresa(props.empresaId) : undefined))

const opcoesDestino = computed(() => [
  ...empresas.value.map((empresa) => ({
    valor: empresa.id,
    rotulo: empresa.cnpj ? `${empresa.nome} · ${formatarCnpj(empresa.cnpj)}` : empresa.nome,
  })),
  { valor: NOVA, rotulo: 'Criar nova pasta' },
])

/** Pasta escolhida tem outro CNPJ que o da planilha. */
const cnpjDiferente = computed(() => {
  const destino = form.destino === NOVA ? undefined : obterEmpresa(form.destino)

  return Boolean(destino?.cnpj && cnpjPlanilha.value && destino.cnpj !== cnpjPlanilha.value)
})

const erros = computed(() => {
  const lista: Partial<Record<'nome' | 'cnpj' | 'competencia' | 'tolerancia', string>> = {}
  const cnpj = normalizarCnpj(form.cnpj)

  if (form.destino === NOVA) {
    if (!form.nome.trim()) lista.nome = 'Informe o nome da empresa.'
    if (cnpj && cnpj.length !== 14) lista.cnpj = 'O CNPJ tem 14 dígitos.'
    else if (cnpj && empresaPorCnpj(cnpj)) lista.cnpj = `Já existe a pasta “${empresaPorCnpj(cnpj)!.nome}” com este CNPJ.`
  }

  if (!lerCompetencia(form.competencia)) lista.competencia = 'Use MM/AAAA, ex.: 06/2026.'
  if (tolerancia.value !== null && Number.isNaN(tolerancia.value)) lista.tolerancia = 'Informe um valor válido.'

  return lista
})

const podeImportar = computed(
  () => Boolean(lida.value && linhas.value.length && Object.keys(erros.value).length === 0 && !salvando.value),
)

async function importar() {
  if (!podeImportar.value || !arquivo.value) return

  salvando.value = true

  try {
    const empresaId = form.destino === NOVA ? (await criarEmpresa({ nome: form.nome, cnpj: form.cnpj })).id : form.destino

    const lote = await salvarLote({
      empresaId,
      competencia: lerCompetencia(form.competencia)!,
      descricao: form.descricao.trim(),
      tolerancia: tolerancia.value ?? 0,
      arquivo: arquivo.value.name,
      linhas: linhas.value,
    })

    avisar(`Lote importado: ${lote.resumo.total} ${lote.resumo.total === 1 ? 'funcionário' : 'funcionários'}.`)
    emit('fechar')
    await router.push({ name: 'cofre-lote', params: { empresaId, loteId: lote.id } })
  } catch (causa) {
    avisar(causa instanceof Error ? causa.message : 'Não foi possível salvar o lote.', 'erro')
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <UiModal
    :aberto="aberto"
    titulo="Importar planilha"
    icone="planilha"
    largura="larga"
    :descricao="
      lida
        ? 'Confira os dados do lote antes de importar. Cada funcionário é calculado com as tabelas de Parâmetros.'
        : 'Envie a planilha preenchida no modelo do Exattus. O cálculo usa as tabelas de INSS e IRRF de Parâmetros.'
    "
    @fechar="emit('fechar')"
  >
    <!-- Etapa 1: escolher o arquivo -->
    <div v-if="!lida" class="space-y-3">
      <label
        class="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors focus-within:outline-2 focus-within:outline-primary"
        :class="arrastando ? 'border-primary bg-primary-soft' : 'border-line-strong hover:border-primary hover:bg-subtle'"
        @dragover.prevent="arrastando = true"
        @dragleave="arrastando = false"
        @drop.prevent="soltar"
      >
        <span class="grid size-11 place-items-center rounded-md bg-primary-soft text-primary">
          <UiIcon :nome="lendo ? 'relogio' : 'enviar'" :tamanho="22" />
        </span>
        <span class="text-sm font-semibold text-ink">{{ lendo ? 'Lendo a planilha…' : 'Arraste a planilha aqui ou clique para escolher' }}</span>
        <span class="text-xs text-muted">Arquivo .xlsx no modelo do Exattus (abas Lote, Folha e Férias)</span>
        <input
          ref="entrada"
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          class="sr-only"
          :disabled="lendo"
          @change="escolher(($event.target as HTMLInputElement).files?.[0])"
        />
      </label>

      <p v-if="erroArquivo" class="ex-error" role="alert"><UiIcon nome="alerta" :tamanho="14" />{{ erroArquivo }}</p>

      <p class="text-xs text-muted">
        Ainda não tem o modelo?
        <button
          type="button"
          class="font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-60"
          :disabled="gerandoModelo"
          @click="baixarModelo"
        >
          {{ gerandoModelo ? 'Gerando…' : 'Baixar modelo de planilha' }}
        </button>
      </p>
    </div>

    <!-- Etapa 2: revisar e importar -->
    <div v-else class="space-y-5 text-ink">
      <div class="flex items-center gap-3 rounded-md border border-line bg-subtle px-3 py-2">
        <UiIcon nome="planilha" :tamanho="20" class="shrink-0 text-positive" />
        <span class="min-w-0 flex-1 truncate text-sm font-medium">{{ arquivo?.name }}</span>
        <UiButton variante="discreto" tamanho="sm" @click="reiniciar">Trocar arquivo</UiButton>
      </div>

      <UiAlert v-if="lida.avisos.length" tom="atencao" titulo="Atenção na estrutura da planilha">
        <ul class="list-disc space-y-0.5 pl-4">
          <li v-for="aviso in lida.avisos" :key="aviso">{{ aviso }}</li>
        </ul>
      </UiAlert>

      <div class="grid gap-x-4 gap-y-1 sm:grid-cols-2">
        <div v-if="empresaFixa" class="ex-field campo-alinhado sm:col-span-2">
          <span class="ex-label">Pasta</span>
          <p class="flex items-center gap-2 text-sm font-semibold"><UiIcon nome="pasta" :tamanho="16" class="text-primary" />{{ empresaFixa.nome }}</p>
          <span class="campo-mensagem" aria-hidden="true" />
        </div>

        <UiField v-else id="lote-destino" rotulo="Pasta da empresa" ajuda="Pasta do cofre onde o lote fica guardado. Escolhida pelo CNPJ da aba Lote, quando já existe." class="sm:col-span-2">
          <template #default="{ id }">
            <div class="ex-control">
              <select :id="id" v-model="form.destino" class="ex-input cursor-pointer bg-transparent">
                <option v-for="opcao in opcoesDestino" :key="opcao.valor" :value="opcao.valor">{{ opcao.rotulo }}</option>
              </select>
            </div>
          </template>
        </UiField>

        <template v-if="form.destino === NOVA">
          <UiField id="lote-empresa" rotulo="Nome da empresa" :erro="erros.nome">
            <template #default="{ id, descricao, invalido }">
              <UiInput :id="id" v-model="form.nome" :invalido="invalido" :aria-describedby="descricao" autocomplete="off" />
            </template>
          </UiField>
          <UiField id="lote-cnpj" rotulo="CNPJ" opcional :erro="erros.cnpj">
            <template #default="{ id, descricao, invalido }">
              <UiInput :id="id" v-model="form.cnpj" mono placeholder="00.000.000/0000-00" :invalido="invalido" :aria-describedby="descricao" autocomplete="off" />
            </template>
          </UiField>
        </template>

        <UiField id="lote-competencia" rotulo="Competência" :erro="erros.competencia">
          <template #default="{ id, descricao, invalido }">
            <UiInput :id="id" v-model="form.competencia" placeholder="06/2026" inputmode="numeric" :invalido="invalido" :aria-describedby="descricao" autocomplete="off" />
          </template>
        </UiField>

        <UiField id="lote-tolerancia" rotulo="Tolerância" ajuda="Diferença aceita como “Confere”, para arredondamentos de centavos. Em branco = R$ 0,00." :erro="erros.tolerancia">
          <template #default="{ id, descricao, invalido }">
            <UiMoneyInput :id="id" v-model="form.tolerancia" placeholder="0,00" :invalido="invalido" :aria-describedby="descricao" />
          </template>
        </UiField>

        <UiField id="lote-descricao" rotulo="Descrição" opcional class="sm:col-span-2">
          <template #default="{ id }">
            <UiInput :id="id" v-model="form.descricao" placeholder="Folha de junho, pré-fechamento" autocomplete="off" />
          </template>
        </UiField>
      </div>

      <UiAlert v-if="cnpjDiferente" tom="atencao">
        O CNPJ da planilha é diferente do CNPJ desta pasta. Confira se é a empresa certa.
      </UiAlert>

      <dl class="grid grid-cols-2 overflow-hidden rounded-lg border border-line sm:grid-cols-4">
        <div class="px-4 py-3">
          <dt class="text-xs text-muted">Funcionários</dt>
          <dd class="num text-xl font-semibold">{{ resumo.total }}</dd>
        </div>
        <div class="border-l border-line px-4 py-3">
          <dt class="text-xs text-muted">{{ NOME_ABA.folha }}</dt>
          <dd class="num text-xl font-semibold">{{ resumo.folha }}</dd>
        </div>
        <div class="border-t border-line px-4 py-3 sm:border-t-0 sm:border-l">
          <dt class="text-xs text-muted">{{ NOME_ABA.ferias }}</dt>
          <dd class="num text-xl font-semibold">{{ resumo.ferias }}</dd>
        </div>
        <div class="border-t border-l border-line px-4 py-3 sm:border-t-0" :class="resumo.erro > 0 && 'bg-warning-soft'">
          <dt class="text-xs text-muted">Com erro</dt>
          <dd class="num text-xl font-semibold" :class="resumo.erro ? 'text-warning' : 'text-ink'">{{ resumo.erro }}</dd>
        </div>
      </dl>

      <p v-if="!linhas.length" class="ex-error"><UiIcon nome="alerta" :tamanho="14" />Nenhum funcionário encontrado nas abas Folha e Férias.</p>

      <section v-if="comErro.length" aria-labelledby="titulo-erros-importacao">
        <h3 id="titulo-erros-importacao" class="text-sm font-bold">
          {{ comErro.length }} {{ comErro.length === 1 ? 'linha precisa' : 'linhas precisam' }} de correção
        </h3>
        <p class="mt-0.5 mb-2 text-xs text-muted">Elas entram no lote marcadas como “Com erro”. Corrija na planilha e importe de novo, se preferir.</p>
        <ul class="max-h-52 divide-y divide-line overflow-y-auto rounded-md border border-line text-xs">
          <li v-for="linha in comErro" :key="linha.id" class="px-3 py-2">
            <p class="font-semibold text-ink">
              <span class="num text-muted">Linha {{ linha.linha }} · {{ NOME_ABA[linha.tipo] }} ·</span> {{ linha.nome }}
            </p>
            <ul class="mt-0.5 space-y-0.5 text-ink-2">
              <li v-for="mensagem in linha.erros" :key="mensagem">{{ mensagem }}</li>
            </ul>
          </li>
        </ul>
      </section>
    </div>

    <template #acoes>
      <UiButton @click="emit('fechar')">Cancelar</UiButton>
      <UiButton v-if="lida" variante="primario" icone="enviar" :disabled="!podeImportar" @click="importar">
        {{ salvando ? 'Importando…' : `Importar ${resumo.total} ${resumo.total === 1 ? 'funcionário' : 'funcionários'}` }}
      </UiButton>
    </template>
  </UiModal>
</template>
