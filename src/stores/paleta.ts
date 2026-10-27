import { ref, watch } from 'vue'

import { DEFAULT_PALETTE, palettes, type PaletteId } from '@/components/exattus/palettes'
import { gravarJson, lerJson } from '@/lib/armazenamento'

/*
 * Paleta de destaque (design system "Exattus Temas"): `data-palette` no <html>
 * troca so a cor principal e a de destaque; fundo, textos e status nao mudam.
 * A escolha fica neste navegador; o index.html a aplica antes da primeira pintura.
 */

const CHAVE = 'exattus:paleta'

const ehPaleta = (valor: unknown): valor is PaletteId => palettes.some((paleta) => paleta.id === valor)

const paleta = ref<PaletteId>(lerJson(CHAVE, ehPaleta) ?? DEFAULT_PALETTE)

function aplicar(valor: PaletteId) {
  document.documentElement.dataset.palette = valor
}

aplicar(paleta.value)

watch(paleta, (valor) => {
  aplicar(valor)
  gravarJson(CHAVE, valor)
})

export function usePaleta() {
  return { paleta, paletas: palettes }
}
