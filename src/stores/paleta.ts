import { computed, ref, watch } from 'vue'

import { DEFAULT_PALETTE, palettes, type PaletteId } from '@/components/exattus/palettes'
import { gravarJson, lerJson } from '@/lib/armazenamento'
import { corVivida, gerarPaletaPersonalizada, hexParaOklch, normalizarHex, paraCss } from '@/lib/cores'

/*
 * Paleta de destaque (design system "Exattus Temas"): `data-palette` no <html>
 * troca so a cor principal e a de destaque; fundo, textos e status nao mudam.
 * A escolha fica neste navegador; o index.html a aplica antes da primeira pintura.
 *
 * Paleta "personalizada": a pessoa escolhe a cor principal e o resto e gerado
 * (lib/cores.ts), com ajuste automatico de legibilidade. As regras ficam num
 * <style> proprio; o CSS gerado tambem e gravado para o index.html aplicar.
 */

const CHAVE = 'exattus:paleta'
const CHAVE_COR = 'exattus:paleta-cor'
const CHAVE_CSS = 'exattus:paleta-css'
const ID_ESTILO = 'exattus-paleta-personalizada'
export const COR_PADRAO = '#5a3fc0'

const ehPaleta = (valor: unknown): valor is PaletteId => palettes.some((paleta) => paleta.id === valor)
const ehCor = (valor: unknown): valor is string => typeof valor === 'string' && normalizarHex(valor) === valor

const paleta = ref<PaletteId>(lerJson(CHAVE, ehPaleta) ?? DEFAULT_PALETTE)
const cor = ref<string>(lerJson(CHAVE_COR, ehCor) ?? COR_PADRAO)
const personalizada = computed(() => gerarPaletaPersonalizada(cor.value))

function aplicar(valor: PaletteId) {
  document.documentElement.dataset.palette = valor
}

/** Regras da paleta personalizada (sempre presentes: a miniatura do seletor usa as cores). */
function aplicarPersonalizada(css: string) {
  let estilo = document.getElementById(ID_ESTILO)

  if (!estilo) {
    estilo = document.createElement('style')
    estilo.id = ID_ESTILO
    document.head.append(estilo)
  }

  estilo.textContent = css
}

aplicar(paleta.value)

watch(paleta, (valor) => {
  aplicar(valor)
  gravarJson(CHAVE, valor)
})

watch(
  personalizada,
  (gerada) => {
    const css = paraCss(gerada)

    aplicarPersonalizada(css)
    gravarJson(CHAVE_CSS, css)
  },
  { immediate: true },
)

watch(cor, (valor) => gravarJson(CHAVE_COR, valor))

export function usePaleta() {
  return {
    paleta,
    paletas: palettes,
    cor,

    /** Tom (0 a 359) da cor personalizada, para a roda de cores. */
    tomAtual: (): number => hexParaOklch(cor.value).h,

    /** Roda de cores: o tom escolhido, na sua versao mais viva (a cor que aparece no anel). */
    escolherTom(tom: number) {
      cor.value = corVivida(tom)
      paleta.value = 'personalizada'
    },

    /** Define a cor personalizada (hex valido) e ja seleciona a paleta Personalizada. */
    escolherCor(valor: string): boolean {
      const hex = normalizarHex(valor)

      if (!hex) return false

      cor.value = hex
      paleta.value = 'personalizada'

      return true
    },
  }
}
