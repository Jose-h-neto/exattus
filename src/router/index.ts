import { createRouter, createWebHistory } from 'vue-router'

import { localizarItem } from '@/app/navegacao'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: { name: 'folha' } },
    { path: '/folha', name: 'folha', component: () => import('@/views/FolhaView.vue') },
    { path: '/ferias', name: 'ferias', component: () => import('@/views/FeriasView.vue') },
    { path: '/rescisao', name: 'rescisao', component: () => import('@/views/RescisaoView.vue') },
    { path: '/conferencias', name: 'conferencias', component: () => import('@/views/ConferenciasView.vue') },
    { path: '/parametros', name: 'parametros', component: () => import('@/views/ParametrosView.vue') },
    { path: '/:caminho(.*)*', redirect: { name: 'folha' } },
  ],
  scrollBehavior(destino) {
    return destino.hash ? { el: destino.hash, top: 24, behavior: 'smooth' } : { top: 0 }
  },
})

router.afterEach((destino) => {
  const local = localizarItem(String(destino.name ?? ''))

  document.title = local ? `${local.item.rotulo} · Exattus` : 'Exattus'
})

export default router
