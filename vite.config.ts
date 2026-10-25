import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import vueDevTools from 'vite-plugin-vue-devtools'

function caminhoBase(): string {
  const definido = process.env.BASE_PATH?.trim()
  if (!definido || definido === '/') return '/'
  return definido.endsWith('/') ? definido : `${definido}/`
}

// https://vite.dev/config/
export default defineConfig({
  base: caminhoBase(),
  plugins: [
    vue(),
    tailwindcss(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
