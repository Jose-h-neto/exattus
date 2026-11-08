<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import PageHeader from '@/components/layout/PageHeader.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiEmptyState from '@/components/ui/UiEmptyState.vue'
import UiIcon from '@/components/ui/UiIcon.vue'
import UiModal from '@/components/ui/UiModal.vue'

import { formatarDataHora } from '@/domain/datas'
import { formatarMoeda } from '@/domain/dinheiro'
import type { ItemConferenciaLote, SituacaoItemLote } from '@/domain/lote/conferencia'
import { formatarCompetencia, type LinhaLote, type Lote, type StatusLinhaLote, type TipoLinhaLote } from '@/domain/lote/tipos'
import { NOME_ABA } from '@/features/lote/colunas'
import { exportarLote, ROTULO_STATUS } from '@/features/lote/exportar'
import { baixarArquivo, nomeDeArquivo } from '@/lib/arquivos'
import { useAvisos } from '@/stores/avisos'
import { useCofre } from '@/stores/cofre'

const route = useRoute()
const router = useRouter()
const { avisar } = useAvisos()
const { carregado, obterEmpresa, obterLote, excluirLote } = useCofre()

const empresaId = computed(() => String(route.params.empresaId ?? ''))
const loteId = computed(() => String(route.params.loteId ?? ''))
const empresa = computed(() => obterEmpresa(empresaId.value))

const lote = shallowRef<Lote | null>(null)
const buscando = ref(true)

type Filtro = 'todos' | StatusLinhaLote

const filtro = ref<Filtro>('todos')
const filtroTipo = ref<'todos' | TipoLinhaLote>('todos')
const busca = ref('')
const aberta = ref<string | null>(null)
const exportando = ref(false)
const excluindo = ref(false)

watch(
  loteId,
  async (id) => {
    buscando.value = true
    lote.value = await obterLote(id).catch(() => null)
    buscando.value = false

    // Abre no filtro que pede atencao primeiro.
    const resumo = lote.value?.resumo

    filtro.value = resumo?.divergente ? 'divergente' : resumo?.erro ? 'erro' : 'todos'
  },
  { immediate: true },
)

const STATUS: Record<StatusLinhaLote, { tom: 'sucesso' | 'perigo' | 'atencao' | 'neutro' }> = {
  confere: { tom: 'sucesso' },
  divergente: { tom: 'perigo' },
  erro: { tom: 'atencao' },
  sem_informado: { tom: 'neutro' },
}

const SITUACAO_ITEM: Record<SituacaoItemLote, { texto: string; tom: 'sucesso' | 'perigo' | 'neutro' }> = {
  confere: { texto: 'Confere', tom: 'sucesso' },
  divergente: { texto: 'Divergente', tom: 'perigo' },
  nao_informado: { texto: 'Não informado', tom: 'neutro' },
}

const filtros = computed(() => {
  const resumo = lote.value?.resumo

  return [
    { valor: 'todos' as const, rotulo: 'Todos', total: resumo?.total ?? 0 },
    { valor: 'divergente' as const, rotulo: 'Divergentes', total: resumo?.divergente ?? 0 },
    { valor: 'erro' as const, rotulo: 'Com erro', total: resumo?.erro ?? 0 },
    { valor: 'confere' as const, rotulo: 'Conferem', total: resumo?.confere ?? 0 },
    { valor: 'sem_informado' as const, rotulo: 'Sem valores da folha', total: resumo?.semInformado ?? 0 },
  ].filter((opcao) => opcao.valor === 'todos' || opcao.total > 0)
})

const temDoisTipos = computed(() => Boolean(lote.value?.resumo.folha && lote.value.resumo.ferias))

function maiorDiferenca(linha: LinhaLote): number {
  return Math.max(0, ...linha.itens.map((item) => Math.abs(item.diferenca ?? 0)))
}

const visiveis = computed(() => {
  const termo = busca.value.trim().toLocaleLowerCase('pt-BR')
  const ordem: Record<StatusLinhaLote, number> = { divergente: 0, erro: 1, sem_informado: 2, confere: 3 }

  return (lote.value?.linhas ?? [])
    .filter(
      (linha) =>
        (filtro.value === 'todos' || linha.status === filtro.value) &&
        (filtroTipo.value === 'todos' || linha.tipo === filtroTipo.value) &&
        (!termo || `${linha.nome} ${linha.matricula} ${linha.cpf}`.toLocaleLowerCase('pt-BR').includes(termo)),
    )
    .sort((a, b) => ordem[a.status] - ordem[b.status] || maiorDiferenca(b) - maiorDiferenca(a) || a.linha - b.linha)
})

function item(linha: LinhaLote, chave: ItemConferenciaLote['chave']) {
  return linha.itens.find((candidato) => candidato.chave === chave)
}

function divergentes(linha: LinhaLote): number {
  return linha.itens.filter((candidato) => candidato.situacao === 'divergente').length
}

function moedaSinal(centavos: number): string {
  return `${centavos > 0 ? '+' : ''}${formatarMoeda(centavos)}`
}

async function exportar() {
  if (!lote.value || !empresa.value || exportando.value) return

  exportando.value = true

  try {
    const blob = await exportarLote(lote.value, empresa.value)

    baixarArquivo(blob, `conferencia-${nomeDeArquivo(empresa.value.nome)}-${lote.value.competencia}.xlsx`)
  } catch {
    avisar('Não foi possível exportar o resultado.', 'erro')
  } finally {
    exportando.value = false
  }
}

async function confirmarExclusao() {
  if (!lote.value) return

  try {
    await excluirLote(lote.value.id)
    avisar('Lote excluído.')
    await router.push({ name: 'cofre-empresa', params: { empresaId: empresaId.value } })
  } catch (causa) {
    avisar(causa instanceof Error ? causa.message : 'Não foi possível excluir o lote.', 'erro')
  } finally {
    excluindo.value = false
  }
}
</script>

<template>
  <template v-if="lote && empresa">
    <PageHeader
      :titulo="`Competência ${formatarCompetencia(lote.competencia)}`"
      :trilha="[
        { rotulo: empresa.nome, para: { name: 'cofre-empresa', params: { empresaId: empresa.id } } },
        { rotulo: formatarCompetencia(lote.competencia) },
      ]"
    >
      <template #subtitulo>
        {{ lote.descricao ? `${lote.descricao} · ` : '' }}{{ lote.arquivo }} · importado em {{ formatarDataHora(lote.criadoEm) }} · tolerância
        <span class="num">{{ formatarMoeda(lote.tolerancia) }}</span>
      </template>
      <template #acoes>
        <UiButton variante="discreto" icone="lixeira" @click="excluindo = true">Excluir lote</UiButton>
        <UiButton variante="primario" icone="planilha" :disabled="exportando" @click="exportar">
          {{ exportando ? 'Exportando…' : 'Exportar resultado' }}
        </UiButton>
      </template>
    </PageHeader>

    <div class="space-y-6">
      <div class="@container">
        <dl class="vidro grid grid-cols-2 overflow-hidden rounded-lg @xl:grid-cols-4">
          <div class="px-4 py-3">
            <dt class="text-xs text-muted">Funcionários</dt>
            <dd class="num text-xl font-semibold text-ink">{{ lote.resumo.total }}</dd>
            <dd class="text-xs text-muted">
              {{ [lote.resumo.folha ? `Folha ${lote.resumo.folha}` : '', lote.resumo.ferias ? `Férias ${lote.resumo.ferias}` : ''].filter(Boolean).join(' · ') }}
            </dd>
          </div>
          <div class="border-l border-line px-4 py-3">
            <dt class="text-xs text-muted">Conferem</dt>
            <dd class="num text-xl font-semibold text-positive">{{ lote.resumo.confere }}</dd>
          </div>
          <div class="border-t border-line px-4 py-3 @xl:border-t-0 @xl:border-l" :class="lote.resumo.divergente > 0 && 'bg-negative-soft'">
            <dt class="text-xs text-muted">Divergentes</dt>
            <dd class="num text-xl font-semibold" :class="lote.resumo.divergente ? 'text-negative' : 'text-ink'">{{ lote.resumo.divergente }}</dd>
          </div>
          <div class="border-t border-l border-line px-4 py-3 @xl:border-t-0" :class="lote.resumo.erro > 0 && 'bg-warning-soft'">
            <dt class="text-xs text-muted">Com erro</dt>
            <dd class="num text-xl font-semibold" :class="lote.resumo.erro ? 'text-warning' : 'text-ink'">{{ lote.resumo.erro }}</dd>
          </div>
        </dl>
      </div>

      <section class="vidro rounded-lg" aria-labelledby="titulo-funcionarios">
        <header class="flex flex-col gap-3 border-b border-line px-5 py-3 xl:flex-row xl:items-center xl:justify-between">
          <h2 id="titulo-funcionarios" class="text-base font-bold text-ink">Funcionários</h2>
          <div class="flex flex-col gap-2 md:flex-row md:items-center">
            <div role="radiogroup" aria-label="Filtrar por situação" class="flex gap-1 overflow-x-auto">
              <button
                v-for="opcao in filtros"
                :key="opcao.valor"
                type="button"
                role="radio"
                :aria-checked="filtro === opcao.valor"
                class="inline-flex h-8 items-center gap-2 rounded-md px-3 text-[13px] font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-primary"
                :class="filtro === opcao.valor ? 'bg-primary-soft text-primary' : 'text-muted hover:bg-subtle hover:text-ink'"
                @click="filtro = opcao.valor"
              >
                {{ opcao.rotulo }}
                <span class="num text-[11px] opacity-75">{{ opcao.total }}</span>
              </button>
            </div>
            <div v-if="temDoisTipos" role="radiogroup" aria-label="Filtrar por tipo" class="flex gap-1 md:border-l md:border-line md:pl-2">
              <button
                v-for="opcao in [{ valor: 'todos', rotulo: 'Todos' }, { valor: 'folha', rotulo: 'Folha' }, { valor: 'ferias', rotulo: 'Férias' }] as const"
                :key="opcao.valor"
                type="button"
                role="radio"
                :aria-checked="filtroTipo === opcao.valor"
                class="inline-flex h-8 items-center rounded-md px-3 text-[13px] font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-primary"
                :class="filtroTipo === opcao.valor ? 'bg-primary-soft text-primary' : 'text-muted hover:bg-subtle hover:text-ink'"
                @click="filtroTipo = opcao.valor"
              >
                {{ opcao.rotulo }}
              </button>
            </div>
            <label class="relative block md:w-64">
              <span class="sr-only">Buscar funcionários</span>
              <UiIcon nome="buscar" :tamanho="16" class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
              <input
                v-model="busca"
                type="search"
                placeholder="Nome, matrícula ou CPF"
                class="h-9 w-full rounded-md border border-line-strong bg-surface pr-3 pl-9 text-sm outline-none placeholder:text-ink-subtle focus:border-primary focus:ring-3 focus:ring-primary-soft"
              />
            </label>
          </div>
        </header>

        <div class="overflow-x-auto">
          <table class="tabela min-w-[980px]">
            <thead>
              <tr>
                <th scope="col" class="pl-5">Funcionário</th>
                <th scope="col">Tipo</th>
                <th scope="col">Situação</th>
                <th scope="col" class="num">Líquido calculado</th>
                <th scope="col" class="num">Líquido folha</th>
                <th scope="col" class="num">Diferença</th>
                <th scope="col" class="pr-5"><span class="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              <template v-for="linha in visiveis" :key="linha.id">
                <tr class="hover:bg-subtle/50">
                  <td class="pl-5">
                    <button
                      type="button"
                      class="-ml-1 flex items-start gap-1.5 rounded px-1 text-left focus-visible:outline-2 focus-visible:outline-primary"
                      :aria-expanded="aberta === linha.id"
                      @click="aberta = aberta === linha.id ? null : linha.id"
                    >
                      <UiIcon nome="seta" :tamanho="14" class="mt-0.5 shrink-0 text-muted transition-transform" :class="aberta === linha.id && 'rotate-90'" />
                      <span class="min-w-0">
                        <span class="block font-medium text-ink">{{ linha.nome }}</span>
                        <span class="mt-0.5 block text-xs text-muted">
                          <span class="num">{{ [linha.matricula && `Mat. ${linha.matricula}`, `linha ${linha.linha}`].filter(Boolean).join(' · ') }}</span>
                          · {{ linha.detalhe }}
                        </span>
                      </span>
                    </button>
                  </td>
                  <td><UiBadge :tom="linha.horaAula ? 'info' : linha.tipo === 'folha' ? 'marca' : 'neutro'">{{ linha.horaAula ? NOME_ABA.hora_aula : NOME_ABA[linha.tipo] }}</UiBadge></td>
                  <td>
                    <UiBadge :tom="STATUS[linha.status].tom">
                      {{ linha.status === 'divergente' ? `${divergentes(linha)} ${divergentes(linha) === 1 ? 'divergência' : 'divergências'}` : ROTULO_STATUS[linha.status] }}
                    </UiBadge>
                  </td>
                  <td class="num">{{ item(linha, 'liquido') ? formatarMoeda(item(linha, 'liquido')!.calculado) : '—' }}</td>
                  <td class="num">
                    {{ item(linha, 'liquido')?.informado != null ? formatarMoeda(item(linha, 'liquido')!.informado!) : '—' }}
                  </td>
                  <td
                    class="num"
                    :class="item(linha, 'liquido')?.situacao === 'divergente' ? 'font-semibold text-negative' : item(linha, 'liquido')?.situacao === 'confere' ? 'text-positive' : 'text-muted'"
                  >
                    {{ item(linha, 'liquido')?.diferenca != null ? moedaSinal(item(linha, 'liquido')!.diferenca!) : '—' }}
                  </td>
                  <td class="pr-5">
                    <div class="flex justify-end">
                      <RouterLink
                        :to="{ name: linha.tipo, query: { lote: lote.id, linha: linha.id } }"
                        class="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium whitespace-nowrap text-primary hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-primary"
                      >
                        Abrir no cálculo
                        <span class="sr-only">{{ linha.nome }}</span>
                      </RouterLink>
                    </div>
                  </td>
                </tr>
                <tr v-if="aberta === linha.id">
                  <td colspan="7" class="!border-t-0 bg-subtle/50 !py-3 pr-5 pl-12">
                    <div v-if="linha.erros.length" class="mb-3 text-xs">
                      <p class="mb-1 font-semibold text-warning">Corrija na planilha</p>
                      <ul class="list-disc space-y-0.5 pl-4 text-ink-2">
                        <li v-for="mensagem in linha.erros" :key="mensagem">{{ mensagem }}</li>
                      </ul>
                    </div>
                    <table v-if="linha.itens.length" class="w-full max-w-3xl text-xs">
                      <thead>
                        <tr class="text-left text-muted">
                          <th scope="col" class="py-1 pr-3 font-medium">Item</th>
                          <th scope="col" class="num py-1 pr-3 font-medium">Calculado</th>
                          <th scope="col" class="num py-1 pr-3 font-medium">Folha</th>
                          <th scope="col" class="num py-1 pr-3 font-medium">Diferença</th>
                          <th scope="col" class="py-1 font-medium">Situação</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="valor in linha.itens" :key="valor.chave" class="border-t border-line">
                          <td class="py-1.5 pr-3 font-medium text-ink">{{ valor.descricao }}</td>
                          <td class="num py-1.5 pr-3">{{ formatarMoeda(valor.calculado) }}</td>
                          <td class="num py-1.5 pr-3">{{ valor.informado === null ? 'Não informado' : formatarMoeda(valor.informado) }}</td>
                          <td class="num py-1.5 pr-3" :class="valor.situacao === 'divergente' ? 'font-semibold text-negative' : valor.situacao === 'confere' ? 'text-positive' : 'text-muted'">
                            {{ valor.diferenca === null ? '—' : moedaSinal(valor.diferenca) }}
                          </td>
                          <td class="py-1.5"><UiBadge :tom="SITUACAO_ITEM[valor.situacao].tom">{{ SITUACAO_ITEM[valor.situacao].texto }}</UiBadge></td>
                        </tr>
                      </tbody>
                    </table>
                    <p v-else class="text-xs text-muted">Sem cálculo: corrija os erros acima.</p>
                  </td>
                </tr>
              </template>
              <tr v-if="!visiveis.length">
                <td colspan="7" class="py-10 text-center text-muted">Nenhum funcionário neste filtro.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <UiModal
      tom="perigo"
      :aberto="excluindo"
      titulo="Excluir lote?"
      :descricao="`O lote ${formatarCompetencia(lote.competencia)} (${lote.resumo.total} funcionários) será removido permanentemente. Exporte o resultado antes, se precisar guardar.`"
      @fechar="excluindo = false"
    >
      <template #acoes>
        <UiButton data-foco-inicial @click="excluindo = false">Cancelar</UiButton>
        <UiButton variante="perigo" @click="confirmarExclusao">Excluir</UiButton>
      </template>
    </UiModal>
  </template>

  <template v-else-if="carregado && !buscando">
    <PageHeader titulo="Lote não encontrado" :trilha="[{ rotulo: 'Lote não encontrado' }]" />
    <section class="vidro rounded-lg">
      <UiEmptyState icone="planilha" titulo="Este lote não existe mais" descricao="Ele pode ter sido excluído, ou os dados deste navegador foram apagados.">
        <RouterLink :to="empresa ? { name: 'cofre-empresa', params: { empresaId: empresa.id } } : { name: 'cofre' }" class="ex-btn ex-btn--secondary">
          Voltar
        </RouterLink>
      </UiEmptyState>
    </section>
  </template>
</template>
