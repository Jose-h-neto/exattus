/*
 * Cores do tema personalizado: a pessoa escolhe so a cor principal e daqui sai
 * o resto da paleta (hover, tom suave, destaque, modo escuro e fundo).
 *
 * Trabalha em OKLCH (luminosidade, saturacao e tom percebidos): mudar a
 * luminosidade nao distorce o tom. A legibilidade segue o contraste do WCAG:
 * texto e botoes com pelo menos 4,5:1 sobre a superficie de cada tema.
 */

export interface Oklch {
  l: number
  c: number
  /** Tom em graus (0 a 360). */
  h: number
}

type Rgb = [number, number, number]

/** Superficies dos temas (tokens.css): a cor principal precisa contrastar com elas. */
export const SUPERFICIE_CLARA = '#ffffff'
export const SUPERFICIE_ESCURA = '#171624'

export const CONTRASTE_TEXTO = 4.5
export const CONTRASTE_DESTAQUE = 3

/* Conversoes ----------------------------------------------------------- */

/** "#abc", "#aabbcc" ou "aabbcc" (qualquer caixa) -> "#aabbcc"; null se invalido. */
export function normalizarHex(texto: string): string | null {
  const limpo = String(texto ?? '').trim().replace(/^#/, '').toLowerCase()

  if (/^[0-9a-f]{3}$/.test(limpo)) return `#${[...limpo].map((digito) => digito + digito).join('')}`
  if (/^[0-9a-f]{6}$/.test(limpo)) return `#${limpo}`

  return null
}

function hexParaRgb(hex: string): Rgb {
  const valor = normalizarHex(hex) ?? '#000000'

  return [1, 3, 5].map((inicio) => parseInt(valor.slice(inicio, inicio + 2), 16) / 255) as Rgb
}

function rgbParaHex(rgb: Rgb): string {
  return `#${rgb.map((canal) => Math.round(Math.min(1, Math.max(0, canal)) * 255).toString(16).padStart(2, '0')).join('')}`
}

const paraLinear = (canal: number) => (canal <= 0.04045 ? canal / 12.92 : ((canal + 0.055) / 1.055) ** 2.4)
const deLinear = (canal: number) => (canal <= 0.0031308 ? canal * 12.92 : 1.055 * canal ** (1 / 2.4) - 0.055)

export function hexParaOklch(hex: string): Oklch {
  const [r, g, b] = hexParaRgb(hex).map(paraLinear) as Rgb

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)

  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s

  return { l: L, c: Math.hypot(A, B), h: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360 }
}

/** OKLCH -> sRGB linear (pode sair da faixa 0..1 quando a cor nao existe no monitor). */
function oklchParaLinear({ l: L, c, h }: Oklch): Rgb {
  const angulo = (h * Math.PI) / 180
  const A = c * Math.cos(angulo)
  const B = c * Math.sin(angulo)

  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3

  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
}

const dentroDoSrgb = (rgb: Rgb) => rgb.every((canal) => canal >= -1e-4 && canal <= 1 + 1e-4)

/** Cor OKLCH em hex; fora do sRGB, reduz a saturacao (mantendo luz e tom) ate caber. */
export function oklchParaHex(cor: Oklch): string {
  const l = Math.min(1, Math.max(0, cor.l))
  let c = Math.max(0, cor.c)

  if (!dentroDoSrgb(oklchParaLinear({ l, c, h: cor.h }))) {
    let minimo = 0

    for (let passo = 0; passo < 24; passo++) {
      const meio = (minimo + c) / 2

      if (dentroDoSrgb(oklchParaLinear({ l, c: meio, h: cor.h }))) minimo = meio
      else c = meio
    }

    c = minimo
  }

  return rgbParaHex(oklchParaLinear({ l, c, h: cor.h }).map(deLinear) as Rgb)
}

/* Contraste (WCAG 2) ---------------------------------------------------- */

function luminancia(hex: string): number {
  const [r, g, b] = hexParaRgb(hex).map(paraLinear) as Rgb

  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contraste(cor: string, fundo: string): number {
  const [maior, menor] = [luminancia(cor), luminancia(fundo)].sort((a, b) => b - a) as [number, number]

  return (maior + 0.05) / (menor + 0.05)
}

/**
 * Escurece (sentido -1) ou clareia (+1) a cor, mantendo tom e saturacao, ate
 * atingir o contraste minimo com o fundo. Se ja atinge, devolve a propria cor.
 */
function ajustarContraste(cor: Oklch, fundo: string, minimo: number, sentido: 1 | -1): string {
  let atual = { ...cor }
  let hex = oklchParaHex(atual)

  // Parte de qualquer luz (inclusive 0 ou 1, preto e branco puros) e para no limite.
  while (contraste(hex, fundo) < minimo) {
    const luz = atual.l + sentido * 0.005

    if (luz < 0 || luz > 1) break

    atual = { ...atual, l: luz }
    hex = oklchParaHex(atual)
  }

  return hex
}

/* Paleta ---------------------------------------------------------------- */

export interface CoresTema {
  /** Texto e contornos: sempre legivel (4,5:1) sobre a superficie. */
  primary: string
  /** Preenchimentos (botoes, selecao): a cor escolhida, so ajustada se sumir no fundo. */
  fill: string
  /** Hover do preenchimento. */
  hover: string
  soft: string
  /** Texto do item selecionado no menu (sobre o vidro tingido): o texto um pouco mais forte. */
  textoForte: string
  /** Texto sobre o preenchimento: branco ou escuro, o que contrastar mais. */
  on: string
  accent: string
  /** Degrade do fundo (vidro.css): canais "r g b" ou hex. */
  fundo: {
    um: string
    dois: string
    tres: string
    quatro: string
    inicio: string
    fim: string
    contorno: string
  }
}

export interface PaletaPersonalizada {
  /** Cor escolhida, normalizada. */
  base: string
  claro: CoresTema
  escuro: CoresTema
  /** A cor principal do tema claro precisou mudar de luminosidade para manter a leitura. */
  ajustada: boolean
}

/** Canais "r g b" (0-255) de uma cor hex, formato de --fundo-* em vidro.css. */
function canais(hex: string): string {
  return hexParaRgb(hex)
    .map((canal) => Math.round(canal * 255))
    .join(' ')
}

const comLuz = (cor: Oklch, l: number, c = cor.c): string => oklchParaHex({ l: Math.min(1, Math.max(0, l)), c, h: cor.h })

/** Tom frio neutro do canto inferior do fundo, igual em todas as paletas (sky). */
const FUNDO_FRIO = '134 168 207'

/** Contraste minimo do preenchimento com a superficie: so evita botao invisivel (ex.: branco no branco). */
const CONTRASTE_PREENCHIMENTO_CLARO = 1.35
const CONTRASTE_PREENCHIMENTO_ESCURO = 2.5

/** Texto sobre o preenchimento: branco, a tinta do tema ou preto, o primeiro com 4,5:1. */
const OPCOES_TEXTO = ['#ffffff', '#18152b', '#000000']

function textoSobre(fundo: string): string {
  return OPCOES_TEXTO.find((cor) => contraste(cor, fundo) >= CONTRASTE_TEXTO) ?? '#000000'
}

/**
 * Preenchimento a partir da cor escolhida:
 * - se sumir na superficie (ex.: branco no branco), ajusta ate aparecer;
 * - cores medias (vermelho, azul vivo), em que o texto branco quase passa, escurecem
 *   so o necessario para o texto branco ficar legivel (botao vermelho com texto branco);
 * - cores claras (amarelo, laranja, ciano) ficam como estao, com texto escuro.
 */
function preenchimento(base: string, superficie: string, minimo: number, sentido: 1 | -1): string {
  const fill = contraste(base, superficie) >= minimo ? base : ajustarContraste(hexParaOklch(base), superficie, minimo, sentido)
  const branco = contraste('#ffffff', fill)

  return branco >= 3 && branco < CONTRASTE_TEXTO ? ajustarContraste(hexParaOklch(fill), '#ffffff', CONTRASTE_TEXTO, -1) : fill
}

/** Hover do preenchimento: afasta a cor do texto por cima (escurece sob texto branco, clareia sob texto escuro). */
function hoverDe(fill: string, on: string): string {
  const cor = hexParaOklch(fill)

  return comLuz(cor, cor.l + (on === '#ffffff' ? -0.06 : 0.06))
}

/** Maior saturacao que cabe no sRGB para uma luz e um tom. */
function saturacaoMaxima(l: number, h: number): number {
  let minimo = 0
  let maximo = 0.4

  for (let passo = 0; passo < 20; passo++) {
    const meio = (minimo + maximo) / 2

    if (dentroDoSrgb(oklchParaLinear({ l, c: meio, h }))) minimo = meio
    else maximo = meio
  }

  return minimo
}

/**
 * A versao mais viva de um tom (a "cor pura" que o monitor consegue mostrar):
 * amarelo claro e brilhante, azul mais profundo. E a cor da roda de cores.
 */
export function corVivida(tom: number): string {
  let melhor = { l: 0.6, c: 0 }

  for (let l = 0.42; l <= 0.92; l += 0.01) {
    const c = saturacaoMaxima(l, tom)

    if (c > melhor.c) melhor = { l, c }
  }

  return oklchParaHex({ l: melhor.l, c: melhor.c * 0.97, h: tom })
}

export function gerarPaletaPersonalizada(cor: string): PaletaPersonalizada {
  const base = normalizarHex(cor) ?? '#5a3fc0'
  const escolhida = hexParaOklch(base)
  // Cinzas nao tem tom definido: o destaque acompanha o tom (irrelevante sem saturacao).
  const destaqueTom: Oklch = { l: escolhida.l, c: escolhida.c * 0.6, h: (escolhida.h + 50) % 360 }

  /*
   * Claro: o preenchimento e a cor escolhida (so escurece se sumir no branco); o texto
   * usa um tom com 4,5:1 sobre o branco (se a escolhida ja tem, e ela mesma).
   */
  const primaryClaro = contraste(base, SUPERFICIE_CLARA) >= CONTRASTE_TEXTO ? base : ajustarContraste(escolhida, SUPERFICIE_CLARA, CONTRASTE_TEXTO, -1)
  const claroOklch = hexParaOklch(primaryClaro)
  const fillClaro = preenchimento(base, SUPERFICIE_CLARA, CONTRASTE_PREENCHIMENTO_CLARO, -1)
  const onClaro = textoSobre(fillClaro)
  const accentClaro = ajustarContraste({ ...destaqueTom, l: Math.min(escolhida.l, 0.6) }, SUPERFICIE_CLARA, CONTRASTE_DESTAQUE, -1)

  const claro: CoresTema = {
    primary: primaryClaro,
    fill: fillClaro,
    textoForte: comLuz(claroOklch, claroOklch.l - 0.07),
    hover: hoverDe(fillClaro, onClaro),
    soft: comLuz(escolhida, 0.95, Math.min(escolhida.c, 0.035)),
    on: onClaro,
    accent: accentClaro,
    fundo: {
      um: canais(comLuz(escolhida, 0.72, Math.min(escolhida.c, 0.16))),
      dois: canais(comLuz(destaqueTom, 0.72, Math.min(destaqueTom.c, 0.1))),
      tres: FUNDO_FRIO,
      quatro: canais(comLuz(escolhida, 0.89, Math.min(escolhida.c, 0.05))),
      inicio: comLuz(escolhida, 0.97, Math.min(escolhida.c, 0.015)),
      fim: '#eef1f8',
      contorno: canais(primaryClaro),
    },
  }

  /* Escuro: texto claro com 4,5:1 sobre a superficie escura; preenchimento so clareia se sumir no fundo. */
  const primaryEscuro = ajustarContraste({ ...escolhida, l: Math.max(escolhida.l, 0.72) }, SUPERFICIE_ESCURA, CONTRASTE_TEXTO, 1)
  const fillEscuro = preenchimento(base, SUPERFICIE_ESCURA, CONTRASTE_PREENCHIMENTO_ESCURO, 1)
  const onEscuro = textoSobre(fillEscuro)

  const escuro: CoresTema = {
    primary: primaryEscuro,
    fill: fillEscuro,
    textoForte: comLuz(hexParaOklch(primaryEscuro), hexParaOklch(primaryEscuro).l + 0.07),
    hover: hoverDe(fillEscuro, onEscuro),
    soft: comLuz(escolhida, 0.28, Math.min(escolhida.c, 0.06)),
    on: onEscuro,
    accent: ajustarContraste({ ...destaqueTom, l: 0.75 }, SUPERFICIE_ESCURA, CONTRASTE_DESTAQUE, 1),
    fundo: {
      um: canais(comLuz(escolhida, 0.48, Math.min(escolhida.c, 0.16))),
      dois: canais(comLuz(destaqueTom, 0.7, Math.min(destaqueTom.c, 0.08))),
      tres: FUNDO_FRIO,
      quatro: canais(comLuz(escolhida, 0.3, Math.min(escolhida.c, 0.1))),
      inicio: comLuz(escolhida, 0.17, Math.min(escolhida.c, 0.03)),
      fim: '#0c1019',
      contorno: canais(primaryEscuro),
    },
  }

  return { base, claro, escuro, ajustada: Math.abs(claroOklch.l - escolhida.l) > 0.02 }
}

/* CSS ------------------------------------------------------------------- */

function variaveis(tema: CoresTema): string {
  return [
    `--primary: ${tema.primary}`,
    `--primary-fill: ${tema.fill}`,
    `--nav-selecao-texto: ${tema.textoForte}`,
    `--primary-hover: ${tema.hover}`,
    `--primary-soft: ${tema.soft}`,
    `--on-primary: ${tema.on}`,
    `--accent: ${tema.accent}`,
    `--fundo-1: ${tema.fundo.um}`,
    `--fundo-2: ${tema.fundo.dois}`,
    `--fundo-3: ${tema.fundo.tres}`,
    `--fundo-4: ${tema.fundo.quatro}`,
    `--fundo-inicio: ${tema.fundo.inicio}`,
    `--fundo-fim: ${tema.fundo.fim}`,
    `--fundo-contorno: ${tema.fundo.contorno}`,
  ].join('; ')
}

function miniatura(tema: CoresTema): string {
  return `--p: ${tema.fill}; --p-soft: ${tema.soft}; --p-on: ${tema.on}; --p-accent: ${tema.accent}`
}

/**
 * Regras da paleta "personalizada" (mesmo formato de paletas.css) e da
 * miniatura do seletor, nos temas claro e escuro.
 */
export function paraCss(paleta: PaletaPersonalizada): string {
  return [
    `html[data-palette="personalizada"] { ${variaveis(paleta.claro)}; }`,
    `html[data-palette="personalizada"][data-theme="dark"] { ${variaveis(paleta.escuro)}; }`,
    `.ex-palette--personalizada { ${miniatura(paleta.claro)}; }`,
    `[data-theme="dark"] .ex-palette--personalizada { ${miniatura(paleta.escuro)}; }`,
  ].join('\n')
}
