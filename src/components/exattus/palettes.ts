// Exattus Temas: the five palettes. Ids match html[data-palette] in assets/exattus/paletas.css.
export const palettes = [
  { id: 'violeta', label: 'Violeta', isDefault: true },
  { id: 'azul', label: 'Azul' },
  { id: 'rosa', label: 'Rosa' },
  { id: 'petroleo', label: 'Petróleo' },
  { id: 'grafite', label: 'Grafite' },
] as const

export type PaletteId = (typeof palettes)[number]['id']
export const DEFAULT_PALETTE: PaletteId = 'violeta'
