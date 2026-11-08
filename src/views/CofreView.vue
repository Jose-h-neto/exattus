<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import PageHeader from '@/components/layout/PageHeader.vue'
import EmpresaModal from '@/components/lote/EmpresaModal.vue'
import ImportarLote from '@/components/lote/ImportarLote.vue'
import UiAlert from '@/components/ui/UiAlert.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiEmptyState from '@/components/ui/UiEmptyState.vue'
import UiIcon from '@/components/ui/UiIcon.vue'

import { formatarCnpj, formatarCompetencia, normalizarCnpj } from '@/domain/lote/tipos'
import { useBaixarModelo } from '@/features/lote/acoes'
import { useCofre } from '@/stores/cofre'

const { empresas, carregado, erro, lotesDa } = useCofre()
const { gerandoModelo, baixarModelo } = useBaixarModelo()
const route = useRoute()
const router = useRouter()

const importando = ref(false)

/** Ação rápida "Importar planilha" da barra lateral: /cofre?importar=1 */
watch(
  () => route.query.importar,
  (importar) => {
    if (!importar) return

    importando.value = true
    void router.replace({ query: {} })
  },
  { immediate: true },
)
const criando = ref(false)
const busca = ref('')

const pastas = computed(() =>
  empresas.value.map((empresa) => {
    const lotes = lotesDa(empresa.id)

    return { empresa, lotes: lotes.length, ultimo: lotes[0] ?? null }
  }),
)

const visiveis = computed(() => {
  const termo = busca.value.trim().toLocaleLowerCase('pt-BR')
  const digitos = normalizarCnpj(termo)

  if (!termo) return pastas.value

  return pastas.value.filter(
    ({ empresa }) => empresa.nome.toLocaleLowerCase('pt-BR').includes(termo) || (digitos && empresa.cnpj.includes(digitos)),
  )
})

function situacaoUltimo(pasta: (typeof pastas.value)[number]) {
  const resumo = pasta.ultimo?.resumo

  if (!resumo) return { texto: 'Sem lotes', tom: 'neutro' as const }
  if (resumo.divergente) return { texto: `${resumo.divergente} ${resumo.divergente === 1 ? 'divergente' : 'divergentes'}`, tom: 'perigo' as const }
  if (resumo.erro) return { texto: `${resumo.erro} com erro`, tom: 'atencao' as const }
  if (resumo.confere) return { texto: 'Tudo confere', tom: 'sucesso' as const }

  return { texto: 'Sem valores conferidos', tom: 'neutro' as const }
}
</script>

<template>
  <PageHeader>
    <template #acoes>
      <UiButton variante="discreto" icone="baixar" :disabled="gerandoModelo" @click="baixarModelo()">
        {{ gerandoModelo ? 'Gerando…' : 'Baixar modelo' }}
      </UiButton>
      <UiButton icone="adicionar" @click="criando = true">Nova pasta</UiButton>
      <UiButton variante="primario" icone="enviar" @click="importando = true">Importar planilha</UiButton>
    </template>
  </PageHeader>

  <UiAlert v-if="erro" tom="perigo" titulo="Não foi possível abrir o cofre" class="mb-6">{{ erro }}</UiAlert>

  <section v-if="carregado && !empresas.length" class="vidro rounded-lg">
    <UiEmptyState
      icone="pasta"
      titulo="O cofre está vazio"
      descricao="Importe uma planilha de conferência em lote. O lote vai para a pasta da empresa, criada pelo CNPJ da aba Lote."
    >
      <div class="flex flex-wrap justify-center gap-2">
        <UiButton variante="primario" icone="enviar" @click="importando = true">Importar planilha</UiButton>
        <UiButton icone="baixar" :disabled="gerandoModelo" @click="baixarModelo()">Baixar modelo</UiButton>
      </div>
    </UiEmptyState>
  </section>

  <template v-else-if="empresas.length">
    <div class="mb-4 flex items-center justify-between gap-3">
      <p class="text-sm text-ink-2">
        <span class="num font-semibold">{{ empresas.length }}</span> {{ empresas.length === 1 ? 'empresa' : 'empresas' }}
      </p>
      <label class="relative block w-full max-w-72">
        <span class="sr-only">Buscar empresas</span>
        <UiIcon nome="buscar" :tamanho="16" class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
        <input
          v-model="busca"
          type="search"
          placeholder="Buscar por nome ou CNPJ"
          class="h-9 w-full rounded-md border border-line-strong bg-surface pr-3 pl-9 text-sm outline-none placeholder:text-ink-subtle focus:border-primary focus:ring-3 focus:ring-primary-soft"
        />
      </label>
    </div>

    <ul class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <li v-for="pasta in visiveis" :key="pasta.empresa.id">
        <RouterLink
          :to="{ name: 'cofre-empresa', params: { empresaId: pasta.empresa.id } }"
          class="vidro group flex h-full flex-col gap-4 rounded-lg p-5 transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <div class="flex items-start gap-3">
            <span class="grid size-11 shrink-0 place-items-center rounded-md bg-primary-soft text-primary">
              <UiIcon nome="pasta" :tamanho="22" />
            </span>
            <div class="min-w-0 flex-1">
              <h2 class="truncate text-base font-bold text-ink group-hover:text-primary">{{ pasta.empresa.nome }}</h2>
              <p class="num truncate text-xs text-muted">{{ pasta.empresa.cnpj ? formatarCnpj(pasta.empresa.cnpj) : 'CNPJ não informado' }}</p>
              <UiBadge v-if="pasta.empresa.horaAula?.tipos.length" tom="info" class="mt-1.5">
                Hora-aula · {{ pasta.empresa.horaAula.tipos.length }} {{ pasta.empresa.horaAula.tipos.length === 1 ? 'tipo' : 'tipos' }}
              </UiBadge>
            </div>
            <UiIcon nome="seta" :tamanho="18" class="mt-1 shrink-0 text-muted group-hover:text-primary" />
          </div>

          <div class="mt-auto flex items-end justify-between gap-3 border-t border-line pt-3">
            <div class="text-xs text-muted">
              <p>
                <span class="num font-semibold text-ink">{{ pasta.lotes }}</span> {{ pasta.lotes === 1 ? 'lote' : 'lotes' }}
              </p>
              <p v-if="pasta.ultimo">Último: <span class="num font-medium text-ink-2">{{ formatarCompetencia(pasta.ultimo.competencia) }}</span></p>
            </div>
            <UiBadge :tom="situacaoUltimo(pasta).tom">{{ situacaoUltimo(pasta).texto }}</UiBadge>
          </div>
        </RouterLink>
      </li>
    </ul>

    <p v-if="!visiveis.length" class="vidro rounded-lg py-10 text-center text-sm text-muted">Nenhuma empresa corresponde à busca.</p>
  </template>

  <ImportarLote :aberto="importando" @fechar="importando = false" />
  <EmpresaModal :aberto="criando" @fechar="criando = false" />
</template>
