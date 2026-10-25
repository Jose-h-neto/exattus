<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import ExCheckbox from '@/components/exattus/ExCheckbox.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiField from '@/components/ui/UiField.vue'
import UiInfo from '@/components/ui/UiInfo.vue'
import UiModal from '@/components/ui/UiModal.vue'
import UiMoneyInput from '@/components/ui/UiMoneyInput.vue'
import UiPanel from '@/components/ui/UiPanel.vue'
import UiSwitch from '@/components/ui/UiSwitch.vue'

import { formatarDecimal, paraCentavos } from '@/domain/dinheiro'
import { RUBRICAS, type Incidencia, type RegrasRescisao } from '@/domain/rescisao/rubricas'
import { useAvisos } from '@/stores/avisos'
import { useParametrosRescisao } from '@/stores/rescisao'

const { parametros, personalizados, restaurarPadrao } = useParametrosRescisao()
const { avisar } = useAvisos()

const NATUREZAS = { remuneratoria: 'Remuneratória', indenizatoria: 'Indenizatória', desconto: 'Desconto' }

const TRIBUTOS: { chave: keyof Incidencia; rotulo: string }[] = [
  { chave: 'inss', rotulo: 'INSS' },
  { chave: 'irrf', rotulo: 'IRRF' },
  { chave: 'fgts', rotulo: 'FGTS' },
]

type RegraBooleana = { [K in keyof RegrasRescisao]: RegrasRescisao[K] extends boolean ? K : never }[keyof RegrasRescisao]

const REGRAS: { chave: RegraBooleana; rotulo: string; descricao: string; validar?: boolean }[] = [
  {
    chave: 'projetarAviso',
    rotulo: 'Projetar o aviso indenizado',
    descricao: 'O período do aviso indenizado conta para avos de 13º e férias (CLT, art. 487, § 1º; OJ 82 SDI-1).',
  },
  {
    chave: 'indenizarExcedenteAviso',
    rotulo: 'Indenizar dias excedentes no aviso trabalhado',
    descricao: 'Com aviso proporcional trabalhado, os dias acima de 30 são pagos como indenizados.',
    validar: true,
  },
  {
    chave: 'feriasEmDobro',
    rotulo: 'Férias vencidas em dobro',
    descricao: 'Férias não concedidas dentro do período concessivo são pagas em dobro (CLT, art. 137).',
  },
  {
    chave: 'simplificadoNoDecimo',
    rotulo: 'Desconto simplificado no IRRF do 13º',
    descricao: 'Permite comparar com o desconto simplificado também na tributação exclusiva do 13º.',
    validar: true,
  },
  {
    chave: 'reducaoNoDecimo',
    rotulo: 'Redução da Lei 15.270/2025 no IRRF do 13º',
    descricao: 'Aplica a redução mensal do imposto também ao 13º salário.',
    validar: true,
  },
]

/* Campos numericos editados como texto. */
const aliquotaFgts = ref(formatarDecimal(parametros.value.regras.aliquotaFgts))
const tolerancia = ref(formatarDecimal(parametros.value.regras.tolerancia))

watch(aliquotaFgts, (texto) => {
  const valor = paraCentavos(texto)
  if (valor !== null && !Number.isNaN(valor) && valor <= 10000) parametros.value.regras.aliquotaFgts = valor
})

watch(tolerancia, (texto) => {
  const valor = paraCentavos(texto)
  if (valor !== null && !Number.isNaN(valor)) parametros.value.regras.tolerancia = valor
})

const aliquotaInvalida = computed(() => {
  const valor = paraCentavos(aliquotaFgts.value)
  return valor === null || Number.isNaN(valor) || valor > 10000
})

const toleranciaInvalida = computed(() => {
  const valor = paraCentavos(tolerancia.value)
  return valor === null || Number.isNaN(valor)
})

const confirmar = ref(false)

function restaurar() {
  restaurarPadrao()
  aliquotaFgts.value = formatarDecimal(parametros.value.regras.aliquotaFgts)
  tolerancia.value = formatarDecimal(parametros.value.regras.tolerancia)
  confirmar.value = false
  avisar('Parâmetros da rescisão restaurados.')
}
</script>

<template>
  <UiPanel
    id="rescisao"
    titulo="Rescisão: incidências e regras"
    descricao="Incidências de INSS, IRRF e FGTS por verba e regras com interpretação variável. Itens marcados para validar devem ser revisados antes do uso em produção. Ficam salvos neste navegador."
    class="scroll-mt-8"
  >
    <template #acoes>
      <UiBadge :tom="personalizados ? 'atencao' : 'sucesso'">{{ personalizados ? 'Personalizados' : 'Padrão' }}</UiBadge>
      <UiButton tamanho="sm" variante="discreto" icone="reiniciar" :disabled="!personalizados" @click="confirmar = true">
        Restaurar padrão
      </UiButton>
    </template>

    <div class="overflow-x-auto">
      <table class="tabela min-w-[680px]">
        <thead>
          <tr>
            <th scope="col" class="pl-5">Verba</th>
            <th scope="col">Natureza</th>
            <th scope="col">Tributação</th>
            <th v-for="tributo in TRIBUTOS" :key="tributo.chave" scope="col" class="w-20 text-center">{{ tributo.rotulo }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="rubrica in RUBRICAS" :key="rubrica.codigo">
            <td class="pl-5">
              <span class="flex items-center gap-1.5 font-medium text-ink">
                {{ rubrica.descricao }}
                <UiInfo :texto="rubrica.fundamento" />
                <UiBadge v-if="rubrica.validar" tom="atencao">validar</UiBadge>
              </span>
            </td>
            <td class="text-xs text-muted">{{ NATUREZAS[rubrica.natureza] }}</td>
            <td class="text-xs text-muted">{{ rubrica.grupo === 'decimo' ? '13º' : 'Mensal' }}</td>
            <td v-for="tributo in TRIBUTOS" :key="tributo.chave" class="text-center align-middle">
              <ExCheckbox
                v-model="parametros.incidencias[rubrica.codigo][tributo.chave]"
                :aria-label="`${rubrica.descricao}: ${rubrica.tipo === 'desconto' ? 'reduz a base de' : 'incide'} ${tributo.rotulo}`"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="grid gap-x-8 gap-y-4 border-t border-line px-5 py-5 lg:grid-cols-2">
      <div v-for="regra in REGRAS" :key="regra.chave" class="flex items-start justify-between gap-3">
        <UiSwitch
          :id="`regra-${regra.chave}`"
          v-model="parametros.regras[regra.chave]"
          :rotulo="regra.rotulo"
          :descricao="regra.descricao"
        />
        <UiBadge v-if="regra.validar" tom="atencao" class="mt-0.5">validar</UiBadge>
      </div>
    </div>

    <div class="flex flex-wrap gap-4 border-t border-line px-5 py-4">
      <UiField
        id="regra-fgts"
        rotulo="Alíquota do FGTS"
        ajuda="8% para empregados em geral; 2% para aprendizes."
        :erro="aliquotaInvalida ? 'Valor inválido' : undefined"
        class="w-44"
      >
        <template #default="{ id, invalido }">
          <UiMoneyInput :id="id" v-model="aliquotaFgts" sufixo="%" :invalido="invalido" />
        </template>
      </UiField>

      <UiField
        id="regra-tolerancia"
        rotulo="Tolerância da conferência"
        ajuda="Diferença máxima aceita entre o cálculo e a folha para considerar que o item confere."
        :erro="toleranciaInvalida ? 'Valor inválido' : undefined"
        class="w-44"
      >
        <template #default="{ id, invalido }">
          <UiMoneyInput :id="id" v-model="tolerancia" :invalido="invalido" />
        </template>
      </UiField>
    </div>
  </UiPanel>

  <UiModal
    :aberto="confirmar"
    titulo="Restaurar parâmetros da rescisão?"
    descricao="As incidências e regras voltarão aos valores padrão do sistema."
    @fechar="confirmar = false"
  >
    <template #acoes>
      <UiButton data-foco-inicial @click="confirmar = false">Cancelar</UiButton>
      <UiButton variante="primario" @click="restaurar">Restaurar</UiButton>
    </template>
  </UiModal>
</template>
