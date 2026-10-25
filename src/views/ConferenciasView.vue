<script setup lang="ts">
import { computed, ref } from 'vue'

import PageHeader from '@/components/layout/PageHeader.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiEmptyState from '@/components/ui/UiEmptyState.vue'
import UiIcon from '@/components/ui/UiIcon.vue'
import UiModal from '@/components/ui/UiModal.vue'

import { formatarDataHora } from '@/domain/datas'
import { formatarDecimal, formatarMoeda } from '@/domain/dinheiro'
import { useAvisos } from '@/stores/avisos'
import { useConferencias, type Conferencia, type TipoConferencia } from '@/stores/conferencias'

const { conferencias, excluir, limpar } = useConferencias()
const { avisar } = useAvisos()

type Filtro = 'todos' | TipoConferencia

const busca = ref('')
const filtro = ref<Filtro>('todos')

const filtros: { valor: Filtro; rotulo: string }[] = [
  { valor: 'todos', rotulo: 'Todas' },
  { valor: 'folha', rotulo: 'Folha mensal' },
  { valor: 'ferias', rotulo: 'Férias' },
  { valor: 'rescisao', rotulo: 'Rescisão' },
]

const rotuloTipo: Record<TipoConferencia, string> = { folha: 'Folha mensal', ferias: 'Férias', rescisao: 'Rescisão' }

const contagem = computed(() => ({
  todos: conferencias.value.length,
  folha: conferencias.value.filter((item) => item.tipo === 'folha').length,
  ferias: conferencias.value.filter((item) => item.tipo === 'ferias').length,
  rescisao: conferencias.value.filter((item) => item.tipo === 'rescisao').length,
}))

const visiveis = computed(() => {
  const termo = busca.value.trim().toLocaleLowerCase('pt-BR')

  return conferencias.value.filter(
    (item) =>
      (filtro.value === 'todos' || item.tipo === filtro.value) &&
      (!termo || `${item.referencia} ${item.resumo.detalhe}`.toLocaleLowerCase('pt-BR').includes(termo)),
  )
})

const paraExcluir = ref<Conferencia | null>(null)
const confirmarLimpeza = ref(false)

function confirmarExclusao() {
  if (!paraExcluir.value) return

  excluir(paraExcluir.value.id)
  avisar('Conferência excluída.')
  paraExcluir.value = null
}

function limparTudo() {
  limpar()
  confirmarLimpeza.value = false
  avisar('Todas as conferências foram excluídas.')
}

function situacao(item: Conferencia) {
  const { divergencias, diferencaInss: diferenca } = item.resumo

  if (item.tipo === 'rescisao') {
    if (divergencias === null || divergencias === undefined) return null
    return divergencias
      ? { texto: `${divergencias} ${divergencias === 1 ? 'divergência' : 'divergências'}`, tom: 'perigo' as const }
      : { texto: 'Confere', tom: 'sucesso' as const }
  }

  if (diferenca === null) return null
  if (diferenca === 0) return { texto: 'Confere', tom: 'sucesso' as const }

  return { texto: `${diferenca > 0 ? '+' : ''}${formatarMoeda(diferenca)}`, tom: 'atencao' as const }
}

function exportarCsv() {
  const valor = (centavos: number | null) => (centavos === null ? '' : formatarDecimal(centavos))
  const texto = (conteudo: string) => `"${conteudo.replace(/"/g, '""')}"`

  const linhas = [
    ['Referência', 'Tipo', 'Detalhe', 'Bruto', 'INSS', 'IRRF', 'Líquido', 'INSS informado', 'Diferença INSS', 'Divergências', 'Salvo em'],
    ...visiveis.value.map((item) => [
      texto(item.referencia),
      rotuloTipo[item.tipo],
      texto(item.resumo.detalhe),
      valor(item.resumo.bruto),
      valor(item.resumo.inss),
      valor(item.resumo.irrf),
      valor(item.resumo.liquido),
      valor(item.resumo.inssInformado),
      valor(item.resumo.diferencaInss),
      item.resumo.divergencias ?? '',
      formatarDataHora(item.salvoEm),
    ]),
  ]

  const conteudo = '﻿' + linhas.map((linha) => linha.join(';')).join('\r\n')
  const url = URL.createObjectURL(new Blob([conteudo], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')

  link.href = url
  link.download = `exattus-conferencias-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <PageHeader>
    <template v-if="conferencias.length" #acoes>
      <UiButton icone="baixar" :disabled="!visiveis.length" @click="exportarCsv">Exportar CSV</UiButton>
      <UiButton variante="discreto" icone="lixeira" @click="confirmarLimpeza = true">Excluir todas</UiButton>
    </template>
  </PageHeader>

  <section class="vidro rounded-lg">
    <div v-if="!conferencias.length">
      <UiEmptyState
        icone="arquivo"
        titulo="Nenhuma conferência salva"
      >
        <div class="flex justify-center gap-2">
          <RouterLink
            :to="{ name: 'folha' }"
            class="ex-btn ex-btn--secondary"
          >
            Folha mensal
          </RouterLink>
          <RouterLink
            :to="{ name: 'ferias' }"
            class="ex-btn ex-btn--secondary"
          >
            Férias
          </RouterLink>
          <RouterLink :to="{ name: 'rescisao' }" class="ex-btn ex-btn--secondary">Rescisão</RouterLink>
        </div>
      </UiEmptyState>
    </div>

    <template v-else>
      <div class="flex flex-col gap-3 border-b border-line px-4 py-3 md:flex-row md:items-center md:justify-between">
        <div role="radiogroup" aria-label="Filtrar por tipo" class="flex gap-1 overflow-x-auto">
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
            <span class="num text-[11px] opacity-75">{{ contagem[opcao.valor] }}</span>
          </button>
        </div>

        <label class="relative block md:w-72">
          <span class="sr-only">Buscar conferências</span>
          <UiIcon nome="buscar" :tamanho="16" class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <input
            v-model="busca"
            type="search"
            placeholder="Buscar por referência ou período"
            class="h-9 w-full rounded-md border border-line-strong bg-surface pr-3 pl-9 text-sm outline-none placeholder:text-ink-subtle focus:border-primary focus:ring-3 focus:ring-primary-soft"
          />
        </label>
      </div>

      <div class="overflow-x-auto">
        <table class="tabela min-w-[960px]">
          <thead>
            <tr>
              <th scope="col" class="pl-5">Referência</th>
              <th scope="col">Tipo</th>
              <th scope="col" class="num">Bruto</th>
              <th scope="col" class="num">INSS</th>
              <th scope="col" class="num">IRRF</th>
              <th scope="col" class="num">Líquido</th>
              <th scope="col">Conferência</th>
              <th scope="col">Salvo em</th>
              <th scope="col" class="pr-5"><span class="sr-only">Ações</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in visiveis" :key="item.id" class="hover:bg-subtle/50">
              <td class="pl-5">
                <span class="font-medium text-ink">{{ item.referencia }}</span>
                <span class="mt-0.5 block text-xs text-muted">{{ item.resumo.detalhe }}</span>
              </td>
              <td class="whitespace-nowrap">
                <UiBadge :tom="item.tipo === 'folha' ? 'marca' : item.tipo === 'rescisao' ? 'atencao' : 'neutro'">{{ rotuloTipo[item.tipo] }}</UiBadge>
              </td>
              <td class="num">{{ formatarMoeda(item.resumo.bruto) }}</td>
              <td class="num">{{ formatarMoeda(item.resumo.inss) }}</td>
              <td class="num">{{ formatarMoeda(item.resumo.irrf) }}</td>
              <td class="num font-medium text-ink">{{ formatarMoeda(item.resumo.liquido) }}</td>
              <td>
                <UiBadge v-if="situacao(item)" :tom="situacao(item)!.tom" :title="item.tipo === 'rescisao' ? 'Itens divergentes da folha' : 'Diferença do INSS informado'">
                  {{ situacao(item)!.texto }}
                </UiBadge>
                <span v-else class="text-muted">—</span>
              </td>
              <td class="num text-left text-muted">{{ formatarDataHora(item.salvoEm) }}</td>
              <td class="pr-5">
                <div class="flex justify-end gap-1">
                  <RouterLink
                    :to="{ name: item.tipo, query: { conferencia: item.id } }"
                    class="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium text-primary hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    Abrir
                    <span class="sr-only">{{ item.referencia }}</span>
                  </RouterLink>
                  <UiButton variante="discreto" tamanho="sm" icone="lixeira" so-icone @click="paraExcluir = item">
                    Excluir {{ item.referencia }}
                  </UiButton>
                </div>
              </td>
            </tr>
            <tr v-if="!visiveis.length">
              <td colspan="9" class="py-10 text-center text-muted">Nenhuma conferência corresponde ao filtro.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </section>

  <UiModal
    tom="perigo"
    :aberto="paraExcluir !== null"
    titulo="Excluir conferência?"
    :descricao="paraExcluir ? `“${paraExcluir.referencia}” será removida permanentemente.` : undefined"
    @fechar="paraExcluir = null"
  >
    <template #acoes>
      <UiButton data-foco-inicial @click="paraExcluir = null">Cancelar</UiButton>
      <UiButton variante="perigo" @click="confirmarExclusao">Excluir</UiButton>
    </template>
  </UiModal>

  <UiModal
    tom="perigo"
    :aberto="confirmarLimpeza"
    titulo="Excluir todas as conferências?"
    :descricao="`${conferencias.length} ${conferencias.length === 1 ? 'conferência será removida' : 'conferências serão removidas'} permanentemente. Exporte um CSV antes, se precisar guardar os valores.`"
    @fechar="confirmarLimpeza = false"
  >
    <template #acoes>
      <UiButton data-foco-inicial @click="confirmarLimpeza = false">Cancelar</UiButton>
      <UiButton variante="perigo" @click="limparTudo">Excluir todas</UiButton>
    </template>
  </UiModal>
</template>
