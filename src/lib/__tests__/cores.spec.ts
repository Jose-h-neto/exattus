import { describe, expect, it } from 'vitest'

import {
  CONTRASTE_DESTAQUE,
  CONTRASTE_TEXTO,
  contraste,
  corVivida,
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

      // Texto na cor principal (links, item ativo) e texto sobre o preenchimento (botoes).
      expect(contraste(claro.primary, SUPERFICIE_CLARA)).toBeGreaterThanOrEqual(CONTRASTE_TEXTO)
      expect(contraste(claro.on, claro.fill)).toBeGreaterThanOrEqual(CONTRASTE_TEXTO)
      expect(contraste(claro.on, claro.hover)).toBeGreaterThanOrEqual(CONTRASTE_TEXTO - 0.5)
      expect(contraste(claro.accent, SUPERFICIE_CLARA)).toBeGreaterThanOrEqual(CONTRASTE_DESTAQUE)

      expect(contraste(escuro.primary, SUPERFICIE_ESCURA)).toBeGreaterThanOrEqual(CONTRASTE_TEXTO)
      expect(contraste(escuro.on, escuro.fill)).toBeGreaterThanOrEqual(CONTRASTE_TEXTO)
      expect(contraste(escuro.accent, SUPERFICIE_ESCURA)).toBeGreaterThanOrEqual(CONTRASTE_DESTAQUE)

      // Texto do item selecionado no menu, sobre a superficie.
      expect(contraste(claro.textoForte, SUPERFICIE_CLARA)).toBeGreaterThanOrEqual(CONTRASTE_TEXTO)
      expect(contraste(escuro.textoForte, SUPERFICIE_ESCURA)).toBeGreaterThanOrEqual(CONTRASTE_TEXTO)

      // O preenchimento nunca some no fundo (ex.: branco no branco).
      expect(contraste(claro.fill, SUPERFICIE_CLARA)).toBeGreaterThanOrEqual(1.3)
      expect(contraste(escuro.fill, SUPERFICIE_ESCURA)).toBeGreaterThanOrEqual(2.4)
    })
  }

  for (const [nome, cor] of [['amarelo', '#ffd400'], ['laranja', '#ff8000']] as const) {
    it(`${nome} vivo fica exatamente como escolhido nos botões, com texto legível por cima`, () => {
      const { claro, escuro } = gerarPaletaPersonalizada(cor)

      expect(claro.fill).toBe(cor)
      expect(escuro.fill).toBe(cor)
      expect(contraste(claro.on, cor)).toBeGreaterThanOrEqual(CONTRASTE_TEXTO)
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

  it('vermelhão: botão com texto branco, escurecendo só um pouco e mantendo o tom', () => {
    const { claro } = gerarPaletaPersonalizada('#e8261b')
    const escolhida = hexParaOklch('#e8261b')
    const usada = hexParaOklch(claro.fill)

    expect(claro.on).toBe('#ffffff')
    expect(contraste('#ffffff', claro.fill)).toBeGreaterThanOrEqual(CONTRASTE_TEXTO)
    expect(escolhida.l - usada.l).toBeLessThan(0.05)
    expect(Math.abs(usada.h - escolhida.h)).toBeLessThan(5)
  })

  it('roda de cores: cada tom na versão mais viva (amarelo claro e brilhante, vermelho forte)', () => {
    const amarelo = hexParaOklch(corVivida(105))
    const laranja = hexParaOklch(corVivida(55))
    const vermelho = hexParaOklch(corVivida(29))

    expect(amarelo.l).toBeGreaterThan(0.85)
    expect(amarelo.c).toBeGreaterThan(0.15)
    expect(laranja.c).toBeGreaterThan(0.17)
    expect(vermelho.c).toBeGreaterThan(0.2)
    // Ida e volta pelo hex: a cor da roda existe no monitor.
    expect(oklchParaHex(hexParaOklch(corVivida(200)))).toBe(corVivida(200))
  })

  it('gera o CSS da paleta e da miniatura do seletor', () => {
    const css = paraCss(gerarPaletaPersonalizada('#0b6a80'))

    expect(css).toContain('html[data-palette="personalizada"] {')
    expect(css).toContain('html[data-palette="personalizada"][data-theme="dark"] {')
    expect(css).toContain('--primary: #0b6a80')
    expect(css).toContain('--primary-fill: #0b6a80')
    expect(css).toContain('.ex-palette--personalizada {')
  })
})
