import { createRouter, createWebHistory } from 'vue-router'

import { localizarItem, rotaDoMenu } from '@/app/navegacao'

declare module 'vue-router' {
  interface RouteMeta {
    /** Item do menu ao qual a rota pertence (rotas internas de um modulo, ex.: pasta do cofre). */
    navegacao?: string
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: { name: 'folha' } },
    { path: '/folha', name: 'folha', component: () => import('@/views/FolhaView.vue') },
    { path: '/ferias', name: 'ferias', component: () => import('@/views/FeriasView.vue') },
    { path: '/rescisao', name: 'rescisao', component: () => import('@/views/RescisaoView.vue') },
    { path: '/conferencias', name: 'conferencias', component: () => import('@/views/ConferenciasView.vue') },
    { path: '/cofre', name: 'cofre', component: () => import('@/views/CofreView.vue') },
    {
      path: '/cofre/:empresaId',
      name: 'cofre-empresa',
      component: () => import('@/views/CofreEmpresaView.vue'),
      meta: { navegacao: 'cofre' },
    },
    {
      path: '/cofre/:empresaId/lote/:loteId',
      name: 'cofre-lote',
      component: () => import('@/views/LoteView.vue'),
      meta: { navegacao: 'cofre' },
    },
    { path: '/instituto-terra', name: 'instituto-terra', component: () => import('@/views/InstitutoTerraView.vue') },
    { path: '/parametros', name: 'parametros', component: () => import('@/views/ParametrosView.vue') },
    { path: '/:caminho(.*)*', redirect: { name: 'folha' } },
  ],
  scrollBehavior(destino) {
    return destino.hash ? { el: destino.hash, top: 24, behavior: 'smooth' } : { top: 0 }
  },
})

router.afterEach((destino) => {
  const local = localizarItem(rotaDoMenu(destino))

  document.title = local ? `${local.item.rotulo} · Exattus` : 'Exattus'
})

export default router
