import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'
import router from './router/index.js'
import { navegarEnter } from './lib/teclado'

const app = createApp(App)

app.use(router)
app.directive('navegar-enter', navegarEnter)

app.mount('#app')

declare module 'vue' {
  interface GlobalDirectives {
    vNavegarEnter: typeof navegarEnter
  }
}
