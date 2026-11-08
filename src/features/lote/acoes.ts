import { ref } from 'vue'

import type { Empresa } from '@/domain/lote/tipos'
import { baixarArquivo, nomeDeArquivo } from '@/lib/arquivos'
import { useAvisos } from '@/stores/avisos'

import { gerarModelo } from './modelo'

const gerandoModelo = ref(false)

/**
 * Botao "Baixar modelo": gera a planilha na hora, sempre alinhada com as colunas do sistema.
 * Com empresa (dentro de uma pasta), o modelo vem com a empresa preenchida e a aba Hora-aula.
 */
export function useBaixarModelo() {
  const { avisar } = useAvisos()

  async function baixarModelo(empresa?: Empresa) {
    if (gerandoModelo.value) return

    gerandoModelo.value = true

    try {
      const nome = empresa ? `modelo-conferencia-lote-${nomeDeArquivo(empresa.nome)}.xlsx` : 'modelo-conferencia-lote.xlsx'

      baixarArquivo(await gerarModelo(empresa), nome)
    } catch {
      avisar('Não foi possível gerar o modelo. Tente de novo.', 'erro')
    } finally {
      gerandoModelo.value = false
    }
  }

  return { gerandoModelo, baixarModelo }
}
