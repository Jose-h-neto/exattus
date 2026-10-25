import { ref, watch } from 'vue'

import { gravarJson, lerJson } from '@/lib/armazenamento'

/*
 * Tema do design system: `data-theme="dark"` no <html> troca todos os tokens.
 * Na primeira visita segue o sistema operacional; depois, a escolha da pessoa.
 */

export type Tema = 'light' | 'dark'

const CHAVE = 'exattus:tema'

function temaInicial(): Tema {
  const salvo = lerJson(CHAVE, (valor): valor is Tema => valor === 'light' || valor === 'dark')

  if (salvo) return salvo

  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const tema = ref<Tema>(temaInicial())

function aplicar(valor: Tema) {
  document.documentElement.dataset.theme = valor
}

aplicar(tema.value)

watch(tema, aplicar)

export function useTema() {
  return {
    tema,

    alternar() {
      tema.value = tema.value === 'dark' ? 'light' : 'dark'
      gravarJson(CHAVE, tema.value)
    },
  }
}
