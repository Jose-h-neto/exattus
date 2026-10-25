import { computed } from 'vue'

import { VERSOES_TABELAS } from '@/domain/parametros'
import { calcularRescisao, ErroRescisao, type ResultadoRescisao } from '@/domain/rescisao/calculo'
import { conferirRescisao } from '@/domain/rescisao/conferencia'
import { useParametros } from '@/stores/parametros'
import { useParametrosRescisao } from '@/stores/rescisao'
import { formularioRescisao, interpretarRescisao, lerValoresFolha } from './rescisao'

/*
 * Estado derivado da rescisao, compartilhado pelas etapas do modulo.
 * O motor de calculo (domain/rescisao) nao conhece Vue; aqui ele e ligado ao
 * formulario e aos parametros configurados.
 */

const { tabelaInss, tabelaIrrf } = useParametros()
const { parametros } = useParametrosRescisao()

/** A tabela INSS editavel corresponde a versao vigente mais recente. */
const vigenciaEditavel = VERSOES_TABELAS.at(-1)?.vigencia ?? ''

export const leituraRescisao = computed(() => interpretarRescisao(formularioRescisao))

export const calculoRescisao = computed<{ resultado: ResultadoRescisao | null; erro: string | null }>(() => {
  const entrada = leituraRescisao.value.entrada

  if (!entrada) {
    return { resultado: null, erro: null }
  }

  try {
    return {
      resultado: calcularRescisao(entrada, {
        incidencias: parametros.value.incidencias,
        regras: parametros.value.regras,
        inssPersonalizado: { vigencia: vigenciaEditavel, tabela: tabelaInss.value },
        irrfPersonalizado: { vigencia: vigenciaEditavel, tabela: tabelaIrrf.value },
      }),
      erro: null,
    }
  } catch (erro) {
    if (erro instanceof ErroRescisao) {
      return { resultado: null, erro: erro.message }
    }

    throw erro
  }
})

export const valoresFolha = computed(() => lerValoresFolha(formularioRescisao))

export const conferenciaRescisao = computed(() => {
  const resultado = calculoRescisao.value.resultado

  return resultado
    ? conferirRescisao(resultado, valoresFolha.value.valores, parametros.value.regras.tolerancia)
    : null
})

/** Ha ao menos um valor da folha informado. */
export const folhaInformada = computed(() =>
  Object.values(valoresFolha.value.valores).some((valor) => valor !== null),
)
