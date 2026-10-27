<script lang="ts">
import type { IconName } from '@/components/exattus/icons'

/**
 * Vocabulario de icones do app -> nomes do design system (components/exattus/icons.ts).
 * Icone novo entra primeiro em icons.ts e depois aqui.
 */
const MAPA = {
  folha: 'folha',
  ferias: 'ferias',
  rescisao: 'desligamento',
  arquivo: 'arquivo',
  ajustes: 'ajustes',
  menu: 'menu',
  fechar: 'close',
  adicionar: 'add',
  salvar: 'salvar',
  reiniciar: 'limpar',
  lixeira: 'excluir',
  baixar: 'download',
  buscar: 'search',
  seta: 'chevron-right',
  anterior: 'chevron-left',
  info: 'info',
  alerta: 'alert',
  ok: 'check',
  sucesso: 'success',
  externo: 'externo',
  abrir: 'abrir',
  calculadora: 'calculadora',
  calendario: 'calendario',
  dinheiro: 'dinheiro',
  relogio: 'ponto',
  paleta: 'paleta',
  recolher: 'recolher',
  expandir: 'expandir',
  sol: 'sun',
  lua: 'moon',
} as const satisfies Record<string, IconName>

export type NomeIcone = keyof typeof MAPA
</script>

<script setup lang="ts">
import ExIcon from '@/components/exattus/ExIcon.vue'

withDefaults(defineProps<{ nome: NomeIcone; tamanho?: number }>(), { tamanho: 18 })
</script>

<template>
  <ExIcon :name="MAPA[nome]" :size="tamanho" />
</template>
