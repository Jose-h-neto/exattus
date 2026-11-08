<script lang="ts">
/** fixo: ocupa espaco ao lado do conteudo; flutuante: recolhido, aparece por cima; gaveta: telas estreitas. */
export type ModoMenu = 'fixo' | 'flutuante' | 'gaveta'
</script>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { ITENS_COM_ATALHO, NAVEGACAO } from '@/app/navegacao'
import type { Empresa } from '@/domain/lote/tipos'
import { useAtalhos } from '@/lib/teclado'
import { useCofre } from '@/stores/cofre'
import { useConferencias } from '@/stores/conferencias'
import { useParametros } from '@/stores/parametros'
import UiIcon from '@/components/ui/UiIcon.vue'
import { abrirAjudaAtalhos } from './AjudaAtalhos.vue'
import AppAparencia from './AppAparencia.vue'
import AppLogo from './AppLogo.vue'

const props = defineProps<{ modo: ModoMenu }>()

/** aparencia: painel de Aparencia aberto ou fechado (o menu recolhido nao some enquanto aberto). */
const emit = defineEmits<{ navegar: []; alternar: []; aparencia: [aberto: boolean] }>()

const botaoMenu = computed(() => {
  if (props.modo === 'fixo') return { icone: 'recolher' as const, rotulo: 'Recolher menu' }
  if (props.modo === 'flutuante') return { icone: 'expandir' as const, rotulo: 'Fixar menu' }
  return { icone: 'fechar' as const, rotulo: 'Fechar menu' }
})

const route = useRoute()
const router = useRouter()
const { total } = useConferencias()
const { empresas, totalEmpresas, instituicoes, lotesDa } = useCofre()
const { algumaPersonalizada: personalizada } = useParametros()

/* Atalhos Alt+1, Alt+2... para cada tela do menu. */
const teclaDe = Object.fromEntries(ITENS_COM_ATALHO.map((item) => [item.rota, item.tecla]))

useAtalhos(
  ITENS_COM_ATALHO.map((item) => ({
    tecla: item.tecla,
    codigo: `Digit${item.tecla}`,
    alt: true,
    acao: () => {
      void router.push({ name: item.rota })
      emit('navegar')
    },
  })),
)

/* Arvore do cofre: pastas por empresa e, na pasta aberta, Lotes / Hora-aula / Professores. */
const LIMITE_PASTAS = 6

const empresaAtiva = computed(() => (route.meta.navegacao === 'cofre' ? String(route.params.empresaId ?? '') : ''))
const abaAtiva = computed(() => String(route.query.aba ?? 'lotes'))

const pastasVisiveis = computed(() => {
  const lista = empresas.value.slice(0, LIMITE_PASTAS)
  const ativa = empresas.value.find((empresa) => empresa.id === empresaAtiva.value)

  return ativa && !lista.includes(ativa) ? [...lista, ativa] : lista
})

const expandidas = ref(new Set<string>())

watch(
  empresaAtiva,
  (id) => {
    if (id) expandidas.value = new Set([...expandidas.value, id])
  },
  { immediate: true },
)

function alternarPasta(id: string) {
  const novas = new Set(expandidas.value)

  if (novas.has(id)) novas.delete(id)
  else novas.add(id)

  expandidas.value = novas
}

function secoes(empresa: Empresa) {
  return [
    { aba: 'lotes', rotulo: 'Lotes', icone: 'planilha' as const, contador: lotesDa(empresa.id).length },
    { aba: 'hora-aula', rotulo: 'Hora-aula', icone: 'relogio' as const, contador: empresa.horaAula?.tipos.length ?? 0 },
    ...(empresa.horaAula?.tipos.length
      ? [{ aba: 'professores', rotulo: 'Professores', icone: 'colaboradores' as const, contador: empresa.professores?.length ?? 0 }]
      : []),
  ]
}

function destinoSecao(empresa: Empresa, aba: string) {
  return { name: 'cofre-empresa', params: { empresaId: empresa.id }, query: aba === 'lotes' ? {} : { aba } }
}

/* Acoes rapidas. */
function importarPlanilha() {
  // Dentro de uma pasta, importa nela; fora, no cofre (a pasta e escolhida pelo CNPJ).
  if (empresaAtiva.value) void router.push({ name: 'cofre-empresa', params: { empresaId: empresaAtiva.value }, query: { importar: '1' } })
  else void router.push({ name: 'cofre', query: { importar: '1' } })

  emit('navegar')
}

function folhaHoraAula() {
  void router.push({ name: 'folha', query: { remuneracao: 'hora_aula' } })
  emit('navegar')
}
</script>

<template>
  <!-- Estrutura e classes do componente Sidebar do design system (ex-sidebar, ex-nav-item). -->
  <nav class="ex-sidebar !w-full" aria-label="Navegação principal">
    <div class="flex items-center justify-between gap-2 pb-6 pl-2">
      <span class="flex items-center gap-2.5">
        <AppLogo :tamanho="30" class="text-primary" />
        <span class="text-xl leading-none font-extrabold tracking-[-0.03em] text-ink">Exattus</span>
      </span>

      <button
        type="button"
        class="ex-btn ex-btn--ghost ex-btn--sm ex-btn--icon"
        :title="modo === 'gaveta' ? botaoMenu.rotulo : `${botaoMenu.rotulo} (Ctrl+\\)`"
        @click="emit('alternar')"
      >
        <UiIcon :nome="botaoMenu.icone" :tamanho="20" />
        <span class="ex-sr">{{ botaoMenu.rotulo }}</span>
      </button>
    </div>

    <div class="-mx-1 flex-1 overflow-y-auto px-1">
      <template v-for="grupo in NAVEGACAO" :key="grupo.titulo">
        <div class="ex-sidebar__section">{{ grupo.titulo }}</div>
        <template v-for="item in grupo.itens" :key="item.rota">
          <RouterLink v-slot="{ href, navigate, isExactActive }" :to="{ name: item.rota }" custom>
            <a
              :href="href"
              class="ex-nav-item group"
              :aria-current="isExactActive || (route.meta.navegacao === item.rota && item.rota !== 'cofre') ? 'page' : undefined"
              :aria-keyshortcuts="`Alt+${teclaDe[item.rota]}`"
              :title="`${item.rotulo} (Alt+${teclaDe[item.rota]})`"
              @click="navigate($event); emit('navegar')"
            >
              <UiIcon :nome="item.icone" :tamanho="20" />
              <span class="ex-nav-item__label truncate">{{ item.rotulo }}</span>
              <kbd class="atalho" aria-hidden="true">Alt {{ teclaDe[item.rota] }}</kbd>
              <span v-if="item.rota === 'conferencias' && total > 0" class="ex-nav-item__badge">
                {{ total }}<span class="ex-sr"> salvas</span>
              </span>
              <span v-if="item.rota === 'cofre' && totalEmpresas > 0" class="ex-nav-item__badge">
                {{ totalEmpresas }}<span class="ex-sr"> {{ totalEmpresas === 1 ? 'empresa' : 'empresas' }}</span>
              </span>
              <span
                v-if="item.rota === 'parametros' && personalizada"
                class="size-2 rounded-full bg-warning"
                title="Tabela personalizada em uso"
              >
                <span class="ex-sr">Tabela personalizada em uso</span>
              </span>
            </a>
          </RouterLink>

          <!-- Pastas do cofre, com atalhos para as abas da pasta. -->
          <ul v-if="item.rota === 'cofre' && pastasVisiveis.length" class="arvore" aria-label="Pastas do cofre">
            <li v-for="pasta in pastasVisiveis" :key="pasta.id">
              <div class="flex items-center gap-0.5">
                <button
                  type="button"
                  class="alternar"
                  :aria-expanded="expandidas.has(pasta.id)"
                  :aria-label="`${expandidas.has(pasta.id) ? 'Recolher' : 'Mostrar'} atalhos de ${pasta.nome}`"
                  @click="alternarPasta(pasta.id)"
                >
                  <UiIcon nome="seta" :tamanho="12" class="transition-transform" :class="expandidas.has(pasta.id) && 'rotate-90'" />
                </button>
                <RouterLink
                  :to="{ name: 'cofre-empresa', params: { empresaId: pasta.id } }"
                  class="subitem flex-1"
                  :class="empresaAtiva === pasta.id && 'subitem--pasta-ativa'"
                  :title="pasta.nome"
                  @click="emit('navegar')"
                >
                  <UiIcon :nome="pasta.horaAula?.tipos.length ? 'empresa' : 'pasta'" :tamanho="15" class="shrink-0" />
                  <span class="truncate">{{ pasta.nome }}</span>
                </RouterLink>
              </div>

              <ul v-if="expandidas.has(pasta.id)" class="ml-[26px] border-l border-line pl-1.5">
                <li v-for="secao in secoes(pasta)" :key="secao.aba">
                  <RouterLink
                    :to="destinoSecao(pasta, secao.aba)"
                    class="subitem subitem--secao"
                    :aria-current="empresaAtiva === pasta.id && abaAtiva === secao.aba ? 'page' : undefined"
                    @click="emit('navegar')"
                  >
                    <UiIcon :nome="secao.icone" :tamanho="14" class="shrink-0" />
                    <span class="flex-1 truncate">{{ secao.rotulo }}</span>
                    <span v-if="secao.contador" class="num text-[11px] text-ink-subtle">{{ secao.contador }}</span>
                    <span v-else-if="secao.aba !== 'lotes'" class="text-[11px] text-warning">configurar</span>
                  </RouterLink>
                </li>
              </ul>
            </li>
            <li v-if="empresas.length > pastasVisiveis.length">
              <RouterLink :to="{ name: 'cofre' }" class="subitem pl-[26px] text-primary" @click="emit('navegar')">
                Ver todas as {{ empresas.length }} pastas
              </RouterLink>
            </li>
          </ul>
        </template>
      </template>

      <div class="ex-sidebar__section">Ações rápidas</div>
      <button type="button" class="ex-nav-item" @click="importarPlanilha">
        <UiIcon nome="enviar" :tamanho="20" />
        <span class="ex-nav-item__label truncate">Importar planilha</span>
      </button>
      <button v-if="instituicoes.length" type="button" class="ex-nav-item" @click="folhaHoraAula">
        <UiIcon nome="relogio" :tamanho="20" />
        <span class="ex-nav-item__label truncate">Folha por hora-aula</span>
      </button>
    </div>

    <div class="ex-sidebar__footer space-y-1">
      <button type="button" class="ex-nav-item" aria-keyshortcuts="Shift+?" @click="abrirAjudaAtalhos">
        <kbd class="inline-grid size-5 place-items-center rounded-xs border border-line-strong font-mono text-[11px]">?</kbd>
        <span class="ex-nav-item__label">Atalhos de teclado</span>
      </button>

      <AppAparencia @aberto="(valor) => emit('aparencia', valor)" />
    </div>
  </nav>
</template>

<style scoped>
/* Dica do atalho: aparece ao passar o mouse ou focar o item. */
.atalho {
  display: none;
  padding: 2px 5px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-xs);
  font: 500 10px/1 var(--font-mono);
  color: var(--ink-subtle);
  white-space: nowrap;
}

.ex-nav-item:hover .atalho,
.ex-nav-item:focus-visible .atalho {
  display: inline-block;
}

.arvore {
  margin: 2px 0 6px 18px;
}

.alternar {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  border-radius: var(--radius-xs);
  color: var(--ink-subtle);
}

.alternar:hover {
  background: var(--surface-hover);
  color: var(--ink);
}

.alternar:focus-visible,
.subitem:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.subitem {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  height: 30px;
  padding: 0 8px;
  border-radius: var(--radius-sm);
  font: 600 13px/1 var(--font-sans);
  color: var(--ink-muted);
  text-decoration: none;
}

.subitem:hover {
  background: var(--surface-hover);
  color: var(--ink);
}

.subitem--secao {
  height: 28px;
  font-weight: 500;
}

.subitem--pasta-ativa {
  color: var(--ink);
}

.subitem[aria-current='page'] {
  background: var(--primary-soft);
  color: var(--primary);
}
</style>
