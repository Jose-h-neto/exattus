import { ref } from 'vue'

export type TomAviso = 'sucesso' | 'info' | 'erro'

export interface Aviso {
  id: number
  mensagem: string
  tom: TomAviso
}

const avisos = ref<Aviso[]>([])
let proximoId = 1

function fechar(id: number) {
  avisos.value = avisos.value.filter((aviso) => aviso.id !== id)
}

/** Notificacoes breves e nao bloqueantes (toasts). */
export function useAvisos() {
  return {
    avisos,
    fechar,

    avisar(mensagem: string, tom: TomAviso = 'sucesso') {
      const id = proximoId++

      avisos.value = [...avisos.value, { id, mensagem, tom }]
      window.setTimeout(() => fechar(id), 4000)
    },
  }
}
