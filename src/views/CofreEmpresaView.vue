<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import PageHeader from '@/components/layout/PageHeader.vue'
import EmpresaModal from '@/components/lote/EmpresaModal.vue'
import ImportarLote from '@/components/lote/ImportarLote.vue'
import ProfessoresHoraAulaEditor from '@/components/lote/ProfessoresHoraAulaEditor.vue'
import TabelaHoraAulaEditor from '@/components/lote/TabelaHoraAulaEditor.vue'
import UiTabs from '@/components/ui/UiTabs.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiEmptyState from '@/components/ui/UiEmptyState.vue'
import UiModal from '@/components/ui/UiModal.vue'

import { formatarDataHora } from '@/domain/datas'
import { formatarCnpj, formatarCompetencia, type CabecalhoLote } from '@/domain/lote/tipos'
import { useBaixarModelo } from '@/features/lote/acoes'
import { useAvisos } from '@/stores/avisos'
import { useCofre } from '@/stores/cofre'

const route = useRoute()
const router = useRouter()
const { avisar } = useAvisos()
const { carregado, obterEmpresa, lotesDa, excluirLote, excluirEmpresa } = useCofre()
const { gerandoModelo, baixarModelo } = useBaixarModelo()

const empresaId = computed(() => String(route.params.empresaId ?? ''))
const empresa = computed(() => obterEmpresa(empresaId.value))
const lotes = computed(() => lotesDa(empresaId.value))

/** Aba aberta: lotes, tabela de hora-aula ou professores (/cofre/:id?aba=hora-aula, vindo da Folha). */
const aba = ref(['hora-aula', 'professores'].includes(String(route.query.aba)) ? String(route.query.aba) : 'lotes')

const abas = computed(() => [
  { id: 'lotes', rotulo: 'Lotes', contador: lotes.value.length },
  { id: 'hora-aula', rotulo: 'Hora-aula', contador: empresa.value?.horaAula?.tipos.length || undefined },
  { id: 'professores', rotulo: 'Professores', contador: empresa.value?.professores?.length || undefined },
])

const importando = ref(false)
const editando = ref(false)
const excluindoPasta = ref(false)
const loteParaExcluir = ref<CabecalhoLote | null>(null)

function tipos(lote: CabecalhoLote): string {
  return [lote.resumo.folha ? `Folha ${lote.resumo.folha}` : '', lote.resumo.ferias ? `Férias ${lote.resumo.ferias}` : '']
    .filter(Boolean)
    .join(' · ')
}

async function confirmarExclusaoLote() {
  const lote = loteParaExcluir.value

  if (!lote) return

  try {
    await excluirLote(lote.id)
    avisar('Lote excluído.')
  } catch (causa) {
    avisar(causa instanceof Error ? causa.message : 'Não foi possível excluir o lote.', 'erro')
  } finally {
    loteParaExcluir.value = null
  }
}

async function confirmarExclusaoPasta() {
  if (!empresa.value) return

  const nome = empresa.value.nome

  try {
    await excluirEmpresa(empresa.value.id)
    avisar(`Pasta “${nome}” excluída.`)
    await router.push({ name: 'cofre' })
  } catch (causa) {
    avisar(causa instanceof Error ? causa.message : 'Não foi possível excluir a pasta.', 'erro')
  } finally {
    excluindoPasta.value = false
  }
}
</script>

<template>
  <template v-if="empresa">
    <PageHeader :titulo="empresa.nome" :trilha="[{ rotulo: empresa.nome }]">
      <template #subtitulo>
        <span class="num">{{ empresa.cnpj ? `CNPJ ${formatarCnpj(empresa.cnpj)}` : 'CNPJ não informado' }}</span>
        · {{ lotes.length }} {{ lotes.length === 1 ? 'lote' : 'lotes' }}
      </template>
      <template #acoes>
        <UiButton variante="discreto" icone="baixar" :disabled="gerandoModelo" @click="baixarModelo(empresa)">
          {{ gerandoModelo ? 'Gerando…' : 'Baixar modelo' }}
        </UiButton>
        <UiButton variante="discreto" icone="ajustes" @click="editando = true">Editar pasta</UiButton>
        <UiButton variante="discreto" icone="lixeira" so-icone @click="excluindoPasta = true">Excluir pasta</UiButton>
        <UiButton variante="primario" icone="enviar" @click="importando = true">Nova conferência em lote</UiButton>
      </template>
    </PageHeader>

    <section class="vidro rounded-lg">
      <UiTabs v-model="aba" :abas="abas" rotulo="Conteúdo da pasta">
        <template #default="{ ativa }">
          <TabelaHoraAulaEditor v-if="ativa === 'hora-aula'" :empresa="empresa" />
          <ProfessoresHoraAulaEditor v-else-if="ativa === 'professores'" :empresa="empresa" @ir-para-tabela="aba = 'hora-aula'" />
          <template v-else>
      <UiEmptyState
        v-if="!lotes.length"
        icone="planilha"
        titulo="Nenhuma conferência em lote nesta pasta"
        descricao="Preencha o modelo de planilha com os funcionários da empresa e importe aqui."
      >
        <div class="flex flex-wrap justify-center gap-2">
          <UiButton variante="primario" icone="enviar" @click="importando = true">Importar planilha</UiButton>
          <UiButton icone="baixar" :disabled="gerandoModelo" @click="baixarModelo(empresa)">Baixar modelo</UiButton>
        </div>
      </UiEmptyState>

      <div v-else class="overflow-x-auto">
        <table class="tabela min-w-[880px]">
          <thead>
            <tr>
              <th scope="col" class="pl-5">Competência</th>
              <th scope="col">Funcionários</th>
              <th scope="col" class="num">Conferem</th>
              <th scope="col" class="num">Divergentes</th>
              <th scope="col" class="num">Com erro</th>
              <th scope="col">Importado em</th>
              <th scope="col" class="pr-5"><span class="sr-only">Ações</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="lote in lotes" :key="lote.id" class="hover:bg-subtle/50">
              <td class="pl-5">
                <RouterLink
                  :to="{ name: 'cofre-lote', params: { empresaId: empresa.id, loteId: lote.id } }"
                  class="num font-semibold text-ink hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
                >
                  {{ formatarCompetencia(lote.competencia) }}
                </RouterLink>
                <span class="mt-0.5 block max-w-72 truncate text-xs text-muted" :title="lote.arquivo">{{ lote.descricao || lote.arquivo }}</span>
              </td>
              <td>
                <span class="num font-medium text-ink">{{ lote.resumo.total }}</span>
                <span class="mt-0.5 block text-xs text-muted">{{ tipos(lote) }}</span>
              </td>
              <td class="num">
                <UiBadge v-if="lote.resumo.confere" tom="sucesso">{{ lote.resumo.confere }}</UiBadge>
                <span v-else class="text-muted">0</span>
              </td>
              <td class="num">
                <UiBadge v-if="lote.resumo.divergente" tom="perigo">{{ lote.resumo.divergente }}</UiBadge>
                <span v-else class="text-muted">0</span>
              </td>
              <td class="num">
                <UiBadge v-if="lote.resumo.erro" tom="atencao">{{ lote.resumo.erro }}</UiBadge>
                <span v-else class="text-muted">0</span>
              </td>
              <td class="num text-left text-muted">{{ formatarDataHora(lote.criadoEm) }}</td>
              <td class="pr-5">
                <div class="flex justify-end gap-1">
                  <RouterLink
                    :to="{ name: 'cofre-lote', params: { empresaId: empresa.id, loteId: lote.id } }"
                    class="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium text-primary hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    Abrir
                    <span class="sr-only">lote {{ formatarCompetencia(lote.competencia) }}</span>
                  </RouterLink>
                  <UiButton variante="discreto" tamanho="sm" icone="lixeira" so-icone @click="loteParaExcluir = lote">
                    Excluir lote {{ formatarCompetencia(lote.competencia) }}
                  </UiButton>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
          </template>
        </template>
      </UiTabs>
    </section>

    <ImportarLote :aberto="importando" :empresa-id="empresa.id" @fechar="importando = false" />
    <EmpresaModal :aberto="editando" :empresa="empresa" @fechar="editando = false" />

    <UiModal
      tom="perigo"
      :aberto="loteParaExcluir !== null"
      titulo="Excluir lote?"
      :descricao="loteParaExcluir ? `O lote ${formatarCompetencia(loteParaExcluir.competencia)} (${loteParaExcluir.resumo.total} funcionários) será removido permanentemente.` : undefined"
      @fechar="loteParaExcluir = null"
    >
      <template #acoes>
        <UiButton data-foco-inicial @click="loteParaExcluir = null">Cancelar</UiButton>
        <UiButton variante="perigo" @click="confirmarExclusaoLote">Excluir</UiButton>
      </template>
    </UiModal>

    <UiModal
      tom="perigo"
      :aberto="excluindoPasta"
      titulo="Excluir pasta?"
      :descricao="
        !lotes.length
          ? `A pasta “${empresa.nome}” será removida permanentemente.`
          : `A pasta “${empresa.nome}” e ${lotes.length === 1 ? 'o lote dela serão removidos' : `os ${lotes.length} lotes dela serão removidos`} permanentemente. Exporte o resultado dos lotes antes, se precisar guardar.`
      "
      @fechar="excluindoPasta = false"
    >
      <template #acoes>
        <UiButton data-foco-inicial @click="excluindoPasta = false">Cancelar</UiButton>
        <UiButton variante="perigo" @click="confirmarExclusaoPasta">Excluir pasta</UiButton>
      </template>
    </UiModal>
  </template>

  <template v-else-if="carregado">
    <PageHeader titulo="Pasta não encontrada" :trilha="[{ rotulo: 'Pasta não encontrada' }]" />
    <section class="vidro rounded-lg">
      <UiEmptyState icone="pasta" titulo="Esta pasta não existe mais" descricao="Ela pode ter sido excluída, ou os dados deste navegador foram apagados.">
        <RouterLink :to="{ name: 'cofre' }" class="ex-btn ex-btn--secondary">Voltar ao cofre</RouterLink>
      </UiEmptyState>
    </section>
  </template>
</template>
