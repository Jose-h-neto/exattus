// Gera src/assets/exattus/tokens.css a partir de src/assets/exattus/tokens.json
// (design system Exattus). Uso: node scripts/gerar-tokens.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const pasta = fileURLToPath(new URL('../src/assets/exattus/', import.meta.url))
const tokens = JSON.parse(readFileSync(`${pasta}tokens.json`, 'utf8'))

const temas = tokens.color.themes.map((tema) => tema.id)
const [temaPrincipal] = temas

/** Valor de um token num tema; texto simples vale para o primeiro tema e e herdado pelos demais. */
function valorNoTema(token, tema) {
  if (typeof token.value === 'string') return token.value
  return token.value[tema] ?? token.value[temaPrincipal]
}

const cores = new Map(tokens.color.tokens.map((token) => [token.name, token]))

/** Resolve apelidos "{outro-token}" recursivamente. */
function resolver(valor, tema, visitados = new Set()) {
  const apelido = /^\{(.+)\}$/.exec(valor)

  if (!apelido) return valor

  const nome = apelido[1]

  if (visitados.has(nome) || !cores.has(nome)) {
    throw new Error(`Apelido inválido: ${valor}`)
  }

  visitados.add(nome)
  return resolver(valorNoTema(cores.get(nome), tema), tema, visitados)
}

function familiaComTemas(familia) {
  return (tokens[familia]?.tokens ?? []).map((token) => ({
    nome: token.name,
    valores: Object.fromEntries(temas.map((tema) => [tema, resolver(valorNoTema(token, tema), tema)])),
  }))
}

const comTemas = [...familiaComTemas('color'), ...familiaComTemas('shadow')]
const fixos = ['spacing', 'radius', 'size'].flatMap((familia) =>
  (tokens[familia]?.tokens ?? []).map((token) => ({ nome: token.name, valor: token.value })),
)

const linhas = [`/* ${tokens.name} — generated from tokens.json */`, '', ':root {']

for (const [nome, valor] of Object.entries(tokens.type.families)) {
  linhas.push(`  --font-${nome}: ${valor};`)
}

for (const { nome, valor } of fixos) linhas.push(`  --${nome}: ${valor};`)
for (const { nome, valores } of comTemas) linhas.push(`  --${nome}: ${valores[temaPrincipal]};`)

linhas.push('  color-scheme: light;', '}', '')

for (const tema of temas.slice(1)) {
  linhas.push(`[data-theme="${tema}"] {`)

  for (const { nome, valores } of comTemas) {
    if (valores[tema] !== valores[temaPrincipal]) linhas.push(`  --${nome}: ${valores[tema]};`)
  }

  linhas.push(`  color-scheme: ${tema};`, '}', '')
}

writeFileSync(`${pasta}tokens.css`, linhas.join('\n'))
console.log(`tokens.css: ${comTemas.length} tokens por tema, ${fixos.length} fixos.`)
