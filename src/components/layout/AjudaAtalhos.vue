<script lang="ts">
import { ref } from 'vue'

const aberta = ref(false)

/** Abre a lista de atalhos (tecla ? ou botao no menu). */
export function abrirAjudaAtalhos() {
  aberta.value = true
}
</script>

<script setup lang="ts">
import UiButton from '@/components/ui/UiButton.vue'
import UiModal from '@/components/ui/UiModal.vue'
import { useAtalhos } from '@/lib/teclado'

useAtalhos([{ tecla: '?', acao: () => (aberta.value = true) }])

const GRUPOS = [
  {
    titulo: 'Preenchimento',
    itens: [
      { teclas: ['Enter'], acao: 'Próximo campo' },
      { teclas: ['Shift', 'Enter'], acao: 'Campo anterior' },
      { teclas: ['Esc'], acao: 'Desfazer a edição do campo' },
      { teclas: ['↑', '↓'], acao: 'Valor em R$: ± 1,00 (com Shift, ± 100,00)' },
      { teclas: ['←', '→'], acao: 'Trocar opção em grupos (vínculo, tipo de contrato)' },
    ],
  },
  {
    titulo: 'Datas',
    itens: [
      { teclas: ['↑', '↓'], acao: 'Dia seguinte / anterior' },
      { teclas: ['PgUp', 'PgDn'], acao: 'Mês seguinte / anterior (com Shift, ano)' },
      { teclas: ['H'], acao: 'Data de hoje' },
      { teclas: ['Alt', '↓'], acao: 'Abrir o calendário (setas, Enter e Esc dentro dele)' },
    ],
  },
  {
    titulo: 'Ações',
    itens: [
      { teclas: ['Ctrl', 'S'], acao: 'Salvar conferência' },
      { teclas: ['Ctrl', 'Enter'], acao: 'Rescisão: avançar etapa (ou ir ao campo pendente)' },
      { teclas: ['Ctrl', 'Shift', 'Enter'], acao: 'Rescisão: voltar etapa' },
      { teclas: ['Ctrl', '\\'], acao: 'Recolher ou mostrar o menu' },
      { teclas: ['?'], acao: 'Mostrar esta lista' },
    ],
  },
]
</script>

<template>
  <UiModal :aberto="aberta" titulo="Atalhos de teclado" largura="larga" @fechar="aberta = false">
    <!-- Duas colunas em telas largas: o modal fica com metade da altura. -->
    <div class="-mt-1 gap-x-8 md:columns-2">
      <section v-for="grupo in GRUPOS" :key="grupo.titulo" class="mb-4 break-inside-avoid last:mb-0">
        <h3 class="mb-1.5 text-[11px] font-bold tracking-[0.06em] text-ink-subtle uppercase">{{ grupo.titulo }}</h3>
        <dl class="divide-y divide-line">
          <div v-for="item in grupo.itens" :key="item.acao" class="flex items-center justify-between gap-4 py-1.5">
            <dt class="text-[13px] text-ink">{{ item.acao }}</dt>
            <dd class="flex shrink-0 gap-1">
              <kbd
                v-for="tecla in item.teclas"
                :key="tecla"
                class="inline-grid h-6 min-w-6 place-items-center rounded-xs border border-line-strong bg-sunken px-1.5 font-mono text-[11px] font-medium text-ink"
              >
                {{ tecla }}
              </kbd>
            </dd>
          </div>
        </dl>
      </section>
    </div>
    <template #acoes>
      <UiButton variante="primario" @click="aberta = false">Entendi</UiButton>
    </template>
  </UiModal>
</template>
