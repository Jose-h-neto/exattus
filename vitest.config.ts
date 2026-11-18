import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vitest/config'

// Testes das regras de calculo (src/**/__tests__): rodam em Node, sem o navegador.
// Rode com "npm test" (scripts/testar.mjs corrige a letra do drive no Windows).
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/__tests__/*.spec.ts'],
  },
})
