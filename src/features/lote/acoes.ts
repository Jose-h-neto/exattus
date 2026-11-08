import { ref } from 'vue'

import { baixarArquivo } from '@/lib/arquivos'
import { useAvisos } from '@/stores/avisos'

import { gerarModelo } from './modelo'

const gerandoModelo = ref(false)

/** Botao "Baixar modelo": gera a planilha na hora, sempre alinhada com as colunas do sistema. */
export function useBaixarModelo() {
  const { avisar } = useAvisos()

  async function baixarModelo() {
    if (gerandoModelo.value) return

    gerandoModelo.value = true

    try {
      baixarArquivo(await gerarModelo(), 'modelo-conferencia-lote.xlsx')
    } catch {
      avisar('Não foi possível gerar o modelo. Tente de novo.', 'erro')
    } finally {
      gerandoModelo.value = false
    }
  }

  return { gerandoModelo, baixarModelo }
}
