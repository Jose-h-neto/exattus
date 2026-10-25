import { computed, ref, watch } from 'vue'

import { gravarJson, lerJson } from '@/lib/armazenamento'
import {
  incidenciasPadrao,
  regrasPadrao,
  RUBRICAS,
  type IncidenciasRescisao,
  type RegrasRescisao,
} from '@/domain/rescisao/rubricas'

const CHAVE = 'exattus:parametros-rescisao'

interface ParametrosRescisao {
  incidencias: IncidenciasRescisao
  regras: RegrasRescisao
}

function padrao(): ParametrosRescisao {
  return { incidencias: incidenciasPadrao(), regras: regrasPadrao() }
}

function ehParametros(valor: unknown): valor is ParametrosRescisao {
  const dados = valor as ParametrosRescisao

  return (
    typeof dados === 'object' &&
    dados !== null &&
    typeof dados.regras === 'object' &&
    typeof dados.incidencias === 'object' &&
    RUBRICAS.every((rubrica) => typeof dados.incidencias[rubrica.codigo]?.inss === 'boolean')
  )
}

/** Completa parametros salvos com chaves novas (versoes futuras). */
function normalizar(salvo: ParametrosRescisao | null): ParametrosRescisao {
  const base = padrao()

  return salvo
    ? { incidencias: { ...base.incidencias, ...salvo.incidencias }, regras: { ...base.regras, ...salvo.regras } }
    : base
}

const parametros = ref<ParametrosRescisao>(normalizar(lerJson(CHAVE, ehParametros)))

watch(parametros, (valor) => gravarJson(CHAVE, valor), { deep: true })

const personalizados = computed(() => JSON.stringify(parametros.value) !== JSON.stringify(padrao()))

/** Incidencias por rubrica e regras configuraveis da rescisao. */
export function useParametrosRescisao() {
  return {
    parametros,
    personalizados,

    restaurarPadrao() {
      parametros.value = padrao()
    },
  }
}
