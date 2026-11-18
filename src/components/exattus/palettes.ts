// Exattus Temas: the five palettes (ids match html[data-palette] in assets/exattus/paletas.css) + the custom one.
export const palettes = [
  { id: 'violeta', label: 'Violeta', isDefault: true },
  { id: 'azul', label: 'Azul' },
  { id: 'rosa', label: 'Rosa' },
  { id: 'petroleo', label: 'Petróleo' },
  { id: 'grafite', label: 'Grafite' },
  // Cor escolhida pela pessoa (stores/paleta.ts); regras geradas em tempo de execucao (lib/cores.ts).
  { id: 'personalizada', label: 'Personalizada' },
] as const

export type PaletteId = (typeof palettes)[number]['id']
export const DEFAULT_PALETTE: PaletteId = 'violeta'
