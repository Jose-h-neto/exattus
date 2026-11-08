import { computed, ref } from 'vue'

import { configPadrao, IGNORAR, type ConfigEventos, type RubricaEvento } from '@/features/eventos/regras'
import { gravarJson, lerJson } from '@/lib/armazenamento'

/*
 * Configuracao do modulo Instituto Terra: codigo da empresa, rubricas e as
 * escolhas feitas para colunas do resumo. Fica neste navegador (localStorage).
 */

const CHAVE = 'exattus:instituto-terra'

function valida(valor: unknown): valor is ConfigEventos {
  if (!valor || typeof valor !== 'object') return false

  const config = valor as Partial<ConfigEventos>

  return typeof config.codigoEmpresa === 'string' && Array.isArray(config.rubricas) && typeof config.mapeamentos === 'object' && Array.isArray(config.desligadas)
}

/** Rubricas novas do padrao entram nas configuracoes ja salvas. */
function completar(config: ConfigEventos): ConfigEventos {
  const padrao = configPadrao()
  const faltantes = padrao.rubricas.filter((rubrica) => !config.rubricas.some((item) => item.id === rubrica.id))

  return faltantes.length ? { ...config, rubricas: [...config.rubricas, ...faltantes] } : config
}

const salva = lerJson(CHAVE, valida)
const config = ref<ConfigEventos>(salva ? completar(salva) : configPadrao())

function gravar(nova: ConfigEventos) {
  config.value = nova
  gravarJson(CHAVE, nova)
}

export function useInstitutoTerra() {
  return {
    config: computed(() => config.value),

    /** Coluna do resumo -> rubrica (id), IGNORAR ou '' para voltar ao reconhecimento automatico. */
    mapearColuna(chave: string, destino: string) {
      const mapeamentos = { ...config.value.mapeamentos }

      if (destino) mapeamentos[chave] = destino
      else delete mapeamentos[chave]

      gravar({ ...config.value, mapeamentos })
    },

    ligarRubrica(id: string, ligada: boolean) {
      const desligadas = config.value.desligadas.filter((item) => item !== id)

      gravar({ ...config.value, desligadas: ligada ? desligadas : [...desligadas, id] })
    },

    salvarCadastro(codigoEmpresa: string, rubricas: RubricaEvento[]) {
      gravar({ ...config.value, codigoEmpresa: codigoEmpresa.trim(), rubricas })
    },

    restaurarPadrao() {
      gravar(configPadrao())
    },
  }
}

export { IGNORAR }
