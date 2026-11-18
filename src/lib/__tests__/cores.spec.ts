import { describe, expect, it } from 'vitest'

import {
  CONTRASTE_DESTAQUE,
  CONTRASTE_TEXTO,
  contraste,
  gerarPaletaPersonalizada,
  hexParaOklch,
  normalizarHex,
  oklchParaHex,
  paraCss,
  SUPERFICIE_CLARA,
  SUPERFICIE_ESCURA,
} from '@/lib/cores'

const DIFICEIS = ['#ffd400', '#ffffff', '#000000', '#a6ff00', '#0a1a40', '#5a3fc0', '#ff0000', '#00ffff', '#808080']

describe('conversões de cor', () => {
  it('ida e volta hex -> OKLCH -> hex preserva a cor', () => {
    for (const cor of [...DIFICEIS, '#2456c4', '#b02a7c', '#0b6a80', '#123456']) {
      expect(oklchParaHex(hexParaOklch(cor))).toBe(cor)
    }
  })

  it('normaliza hex com e sem #, curto e em maiúsculas', () => {
    expect(normalizarHex('#ABC')).toBe('#aabbcc')
    expect(normalizarHex('5A3FC0')).toBe('#5a3fc0')
    expect(normalizarHex('#12345')).toBeNull()
    expect(normalizarHex('azul')).toBeNull()
  })

  it('contraste do WCAG: preto x branco = 21', () => {
    expect(contraste('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(contraste('#777777', '#777777')).toBeCloseTo(1, 5)
  })
})

describe('paleta personalizada', () => {
  for (const cor of DIFICEIS) {
    it(`${cor}: texto e botões legíveis nos dois temas`, () => {
      const { claro, escuro } = gerarPaletaPersonalizada(cor)

      expect(contraste(claro.primary, SUPERFICIE_CLARA)).toBeGreaterThanOrEqual(CONTRASTE_TEXTO)
      expect(contraste(claro.on, claro.primary)).toBeGreaterThanOrEqual(CONTRASTE_TEXTO)
      expect(contraste(claro.accent, SUPERFICIE_CLARA)).toBeGreaterThanOrEqual(CONTRASTE_DESTAQUE)

      expect(contraste(escuro.primary, SUPERFICIE_ESCURA)).toBeGreaterThanOrEqual(CONTRASTE_TEXTO)
      expect(contraste(escuro.on, escuro.primary)).toBeGreaterThanOrEqual(CONTRASTE_TEXTO)
      expect(contraste(escuro.accent, SUPERFICIE_ESCURA)).toBeGreaterThanOrEqual(CONTRASTE_DESTAQUE)
    })
  }

  it('cor já legível fica exatamente igual, sem ajuste', () => {
    const paleta = gerarPaletaPersonalizada('#5a3fc0')

    expect(paleta.claro.primary).toBe('#5a3fc0')
    expect(paleta.ajustada).toBe(false)
  })

  it('amarelo é escurecido mantendo o tom, e marcado como ajustado', () => {
    const paleta = gerarPaletaPersonalizada('#ffd400')
    const escolhida = hexParaOklch('#ffd400')
    const usada = hexParaOklch(paleta.claro.primary)

    expect(paleta.ajustada).toBe(true)
    expect(usada.l).toBeLessThan(escolhida.l)
    expect(Math.abs(usada.h - escolhida.h)).toBeLessThan(8)
  })

  it('gera o CSS da paleta e da miniatura do seletor', () => {
    const css = paraCss(gerarPaletaPersonalizada('#0b6a80'))

    expect(css).toContain('html[data-palette="personalizada"] {')
    expect(css).toContain('html[data-palette="personalizada"][data-theme="dark"] {')
    expect(css).toContain('--primary: #0b6a80')
    expect(css).toContain('.ex-palette--personalizada {')
  })
})
