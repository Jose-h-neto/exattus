import { computed, ref, watch } from 'vue'

import { gravarJson, lerJson } from '@/lib/armazenamento'
import { copiarTabelaInss, TABELA_INSS_2026, type TabelaInss } from '@/domain/parametros'

const CHAVE = 'exattus:tabela-inss'

function ehNumero(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isSafeInteger(valor) && valor >= 0
}

function ehTabelaInss(valor: unknown): valor is TabelaInss {
  const tabela = valor as TabelaInss

  return (
    typeof tabela === 'object' &&
    tabela !== null &&
    ehNumero(tabela.aliquotaProlabore) &&
    Array.isArray(tabela.faixas) &&
    tabela.faixas.length === TABELA_INSS_2026.faixas.length &&
    tabela.faixas.every(
      (faixa) =>
        ehNumero(faixa.limite) &&
        ehNumero(faixa.aliquota) &&
        (faixa.valorFixo === null || ehNumero(faixa.valorFixo)),
    )
  )
}

const tabelaInss = ref<TabelaInss>(lerJson(CHAVE, ehTabelaInss) ?? copiarTabelaInss(TABELA_INSS_2026))

watch(tabelaInss, (tabela) => gravarJson(CHAVE, tabela), { deep: true })

const personalizada = computed(
  () => JSON.stringify(tabelaInss.value) !== JSON.stringify(TABELA_INSS_2026),
)

/** Tabela INSS unica, usada por todos os modulos de calculo. */
export function useParametros() {
  return {
    tabelaInss,
    personalizada,

    atualizarTabelaInss(tabela: TabelaInss) {
      tabelaInss.value = copiarTabelaInss(tabela)
    },

    restaurarPadrao() {
      tabelaInss.value = copiarTabelaInss(TABELA_INSS_2026)
    },
  }
}
