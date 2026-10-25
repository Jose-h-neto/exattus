import { computed, ref, watch } from 'vue'

import { gravarJson, lerJson } from '@/lib/armazenamento'
import {
  copiarTabelaInss,
  copiarTabelaIrrf,
  IRRF_2026,
  TABELA_INSS_2026,
  type TabelaInss,
  type TabelaIrrf,
} from '@/domain/parametros'

const CHAVE = 'exattus:tabela-inss'
const CHAVE_IRRF = 'exattus:tabela-irrf'

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

/* IRRF: a ultima faixa nao tem limite (Infinity), gravado como null no JSON. */

interface TabelaIrrfGravada {
  dependente: number
  simplificado: number
  faixas: { limite: number | null; aliquota: number; deducao: number }[]
}

function ehTabelaIrrfGravada(valor: unknown): valor is TabelaIrrfGravada {
  const tabela = valor as TabelaIrrfGravada

  return (
    typeof tabela === 'object' &&
    tabela !== null &&
    ehNumero(tabela.dependente) &&
    ehNumero(tabela.simplificado) &&
    Array.isArray(tabela.faixas) &&
    tabela.faixas.length === IRRF_2026.faixas.length &&
    tabela.faixas.every(
      (faixa, indice) =>
        (indice === tabela.faixas.length - 1 ? faixa.limite === null : ehNumero(faixa.limite)) &&
        ehNumero(faixa.aliquota) &&
        ehNumero(faixa.deducao),
    )
  )
}

function paraGravar(tabela: TabelaIrrf): TabelaIrrfGravada {
  return {
    dependente: tabela.dependente,
    simplificado: tabela.simplificado,
    faixas: tabela.faixas.map((faixa) => ({
      ...faixa,
      limite: Number.isFinite(faixa.limite) ? faixa.limite : null,
    })),
  }
}

function lerTabelaIrrf(): TabelaIrrf {
  const gravada = lerJson(CHAVE_IRRF, ehTabelaIrrfGravada)

  if (!gravada) return copiarTabelaIrrf(IRRF_2026)

  return {
    dependente: gravada.dependente,
    simplificado: gravada.simplificado,
    faixas: gravada.faixas.map((faixa) => ({ ...faixa, limite: faixa.limite ?? Infinity })),
    // A reducao da Lei 15.270 nao e editavel: segue a da versao vigente.
    reducao: IRRF_2026.reducao,
  }
}

const tabelaInss = ref<TabelaInss>(lerJson(CHAVE, ehTabelaInss) ?? copiarTabelaInss(TABELA_INSS_2026))
const tabelaIrrf = ref<TabelaIrrf>(lerTabelaIrrf())

watch(tabelaInss, (tabela) => gravarJson(CHAVE, tabela), { deep: true })
watch(tabelaIrrf, (tabela) => gravarJson(CHAVE_IRRF, paraGravar(tabela)), { deep: true })

const personalizada = computed(
  () => JSON.stringify(tabelaInss.value) !== JSON.stringify(TABELA_INSS_2026),
)

const irrfPersonalizada = computed(
  () => JSON.stringify(paraGravar(tabelaIrrf.value)) !== JSON.stringify(paraGravar(IRRF_2026)),
)

/** Tabelas INSS e IRRF unicas, usadas por todos os modulos de calculo. */
export function useParametros() {
  return {
    tabelaInss,
    tabelaIrrf,
    personalizada,
    irrfPersonalizada,
    algumaPersonalizada: computed(() => personalizada.value || irrfPersonalizada.value),

    atualizarTabelaInss(tabela: TabelaInss) {
      tabelaInss.value = copiarTabelaInss(tabela)
    },

    restaurarPadrao() {
      tabelaInss.value = copiarTabelaInss(TABELA_INSS_2026)
    },

    atualizarTabelaIrrf(tabela: TabelaIrrf) {
      tabelaIrrf.value = copiarTabelaIrrf(tabela)
    },

    restaurarIrrf() {
      tabelaIrrf.value = copiarTabelaIrrf(IRRF_2026)
    },
  }
}
