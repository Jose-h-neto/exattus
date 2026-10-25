<script lang="ts">
/** fixo: ocupa espaco ao lado do conteudo; flutuante: recolhido, aparece por cima; gaveta: telas estreitas. */
export type ModoMenu = 'fixo' | 'flutuante' | 'gaveta'
</script>

<script setup lang="ts">
import { computed } from 'vue'

import { NAVEGACAO } from '@/app/navegacao'
import { ANO_VIGENCIA } from '@/domain/parametros'
import { useConferencias } from '@/stores/conferencias'
import { useParametros } from '@/stores/parametros'
import { useTema } from '@/stores/tema'
import UiIcon from '@/components/ui/UiIcon.vue'
import { abrirAjudaAtalhos } from './AjudaAtalhos.vue'
import AppLogo from './AppLogo.vue'

const props = defineProps<{ modo: ModoMenu }>()

const emit = defineEmits<{ navegar: []; alternar: [] }>()

const botaoMenu = computed(() => {
  if (props.modo === 'fixo') return { icone: 'recolher' as const, rotulo: 'Recolher menu' }
  if (props.modo === 'flutuante') return { icone: 'expandir' as const, rotulo: 'Fixar menu' }
  return { icone: 'fechar' as const, rotulo: 'Fechar menu' }
})

const { total } = useConferencias()
const { personalizada } = useParametros()
const { tema, alternar: alternarTema } = useTema()
</script>

<template>
  <!-- Estrutura e classes do componente Sidebar do design system (ex-sidebar, ex-nav-item). -->
  <nav class="ex-sidebar !w-full" aria-label="Navegação principal">
    <div class="flex items-center justify-between gap-2 pb-6 pl-2">
      <span class="flex items-center gap-2.5">
        <AppLogo :tamanho="30" class="text-[#5D3BCC] dark:text-primary" />
        <span class="text-xl leading-none font-extrabold tracking-[-0.03em] text-ink">Exattus</span>
      </span>

      <button
        type="button"
        class="ex-btn ex-btn--secondary ex-btn--sm ex-btn--icon"
        :title="modo === 'gaveta' ? botaoMenu.rotulo : `${botaoMenu.rotulo} (Ctrl+\\)`"
        @click="emit('alternar')"
      >
        <UiIcon :nome="botaoMenu.icone" :tamanho="16" />
        <span class="ex-sr">{{ botaoMenu.rotulo }}</span>
      </button>
    </div>

    <div class="flex-1 overflow-y-auto">
      <template v-for="grupo in NAVEGACAO" :key="grupo.titulo">
        <div class="ex-sidebar__section">{{ grupo.titulo }}</div>
        <RouterLink v-for="item in grupo.itens" :key="item.rota" v-slot="{ href, navigate, isActive }" :to="{ name: item.rota }" custom>
          <a
            :href="href"
            class="ex-nav-item"
            :aria-current="isActive ? 'page' : undefined"
            @click="navigate($event); emit('navegar')"
          >
            <UiIcon :nome="item.icone" :tamanho="20" />
            <span class="ex-nav-item__label truncate">{{ item.rotulo }}</span>
            <span v-if="item.rota === 'conferencias' && total > 0" class="ex-nav-item__badge">
              {{ total }}<span class="ex-sr"> salvas</span>
            </span>
            <span
              v-if="item.rota === 'parametros' && personalizada"
              class="size-2 rounded-full bg-warning"
              title="Tabela INSS personalizada"
            >
              <span class="ex-sr">Tabela INSS personalizada</span>
            </span>
          </a>
        </RouterLink>
      </template>
    </div>

    <div class="ex-sidebar__footer space-y-3">
      <div class="text-xs leading-4 text-ink-muted">
        <p class="font-semibold text-ink">Parâmetros {{ ANO_VIGENCIA }}</p>
        <p class="mt-0.5">INSS · IRRF · Lei nº 15.270/2025</p>
        <RouterLink
          v-if="personalizada"
          :to="{ name: 'parametros' }"
          class="mt-2 inline-flex items-center gap-1.5 font-semibold text-warning hover:underline"
          @click="emit('navegar')"
        >
          <UiIcon nome="alerta" :tamanho="14" />
          Tabela INSS personalizada
        </RouterLink>
      </div>

      <button type="button" class="ex-nav-item" aria-keyshortcuts="Shift+?" @click="abrirAjudaAtalhos">
        <kbd class="inline-grid size-5 place-items-center rounded-xs border border-line-strong font-mono text-[11px]">?</kbd>
        <span class="ex-nav-item__label">Atalhos de teclado</span>
      </button>

      <button type="button" class="ex-nav-item" :aria-pressed="tema === 'dark'" @click="alternarTema">
        <UiIcon :nome="tema === 'dark' ? 'sol' : 'lua'" :tamanho="20" />
        <span class="ex-nav-item__label">{{ tema === 'dark' ? 'Tema claro' : 'Tema escuro' }}</span>
      </button>
    </div>
  </nav>
</template>
