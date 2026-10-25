<script setup lang="ts">
import { computed } from 'vue'

import UiField from '@/components/ui/UiField.vue'
import UiFormGroup from '@/components/ui/UiFormGroup.vue'
import UiIcon from '@/components/ui/UiIcon.vue'
import UiInfo from '@/components/ui/UiInfo.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiMoneyInput from '@/components/ui/UiMoneyInput.vue'
import UiPanel from '@/components/ui/UiPanel.vue'
import UiSegmented from '@/components/ui/UiSegmented.vue'
import UiSwitch from '@/components/ui/UiSwitch.vue'

import { formatarData } from '@/domain/datas'
import { formatarMoeda, formatarPercentual } from '@/domain/dinheiro'
import { MODALIDADES, obterModalidade, regraEfetiva } from '@/domain/rescisao/modalidades'
import { ajustarAviso, formularioRescisao as form, opcoesAviso } from '@/features/rescisao'
import { calculoRescisao, leituraRescisao } from '@/features/rescisaoEstado'

const erros = computed(() => leituraRescisao.value.erros)
const resultado = computed(() => calculoRescisao.value.resultado)

const disponiveis = computed(() => MODALIDADES.filter((item) => item.contratos.includes(form.tipoContrato)))

const modalidade = computed(() =>
  regraEfetiva(obterModalidade(form.modalidade), form.tipoContrato !== 'indeterminado' && form.clausulaAssecuratoria),
)

const opcoes = computed(() => opcoesAviso(form))

function fator(valor: number) {
  if (valor === 1) return { texto: 'Integral', devido: true }
  if (valor === 0.5) return { texto: '50%', devido: true }
  return { texto: 'Não devido', devido: false }
}

const direitos = computed(() => {
  const regra = modalidade.value
  const tempo = resultado.value?.tempo
  const aviso = (() => {
    switch (regra.aviso) {
      case 'nenhum':
        return { texto: 'Não se aplica', devido: false }
      case 'empregado':
        return { texto: 'Dado pelo empregado (30 dias)', devido: true }
      case 'metade':
        return { texto: 'Indenizado pela metade', devido: true }
      case 'culpa':
        return { texto: '50% do aviso', devido: true }
      default:
        return {
          texto: tempo ? `${tempo.diasAvisoDireito} dias (Lei 12.506)` : 'Proporcional (Lei 12.506)',
          devido: true,
        }
    }
  })()

  return [
    { rotulo: 'Saldo de salário', texto: 'Devido', devido: true },
    { rotulo: 'Aviso prévio', ...aviso },
    { rotulo: '13º proporcional', ...fator(regra.decimo) },
    { rotulo: 'Férias proporcionais + 1/3', ...fator(regra.feriasProporcionais) },
    { rotulo: 'Férias vencidas + 1/3', texto: 'Devidas', devido: true },
    {
      rotulo: 'Multa do FGTS',
      texto: regra.multaFgts ? formatarPercentual(regra.multaFgts) : 'Não devida',
      devido: regra.multaFgts > 0,
    },
    ...(regra.indenizacao479 ? [{ rotulo: 'Indenização art. 479', texto: 'Devida', devido: true }] : []),
    ...(regra.indenizacao480 ? [{ rotulo: 'Indenização art. 480', texto: 'Desconto', devido: true }] : []),
    { rotulo: 'Saque do FGTS', texto: regra.saqueFgts, devido: regra.saqueFgts !== 'Não' },
    { rotulo: 'Seguro-desemprego', texto: regra.seguroDesemprego ? 'Habilita' : 'Não habilita', devido: regra.seguroDesemprego },
  ]
})

const limite480 = computed(() => {
  const linha = resultado.value?.descontos.find((item) => item.codigo === 'indenizacao_480')
  return linha ? linha.valor : null
})
</script>

<template>
  <div class="grid items-start gap-6 2xl:grid-cols-[minmax(0,1fr)_320px]">
    <div class="space-y-6">
      <UiPanel titulo="Modalidade de desligamento" :descricao="`Modalidades aplicáveis a contrato ${form.tipoContrato === 'indeterminado' ? 'por prazo indeterminado' : 'a prazo'}.`">
        <fieldset class="p-4">
          <legend class="sr-only">Modalidade de desligamento</legend>
          <div class="grid gap-2 md:grid-cols-2">
            <label
              v-for="item in disponiveis"
              :key="item.codigo"
              class="flex cursor-pointer items-start gap-3 rounded-md border px-3.5 py-3 transition-colors has-focus-visible:outline-2 has-focus-visible:outline-primary"
              :class="form.modalidade === item.codigo ? 'border-primary bg-primary-soft/60 ring-1 ring-primary' : 'border-line hover:border-line-strong hover:bg-subtle/60'"
            >
              <input
                v-model="form.modalidade"
                type="radio"
                name="resc-modalidade"
                :value="item.codigo"
                class="mt-0.5 size-4 accent-primary"
                @change="ajustarAviso(form)"
              />
              <span class="min-w-0 flex-1">
                <span class="flex items-center gap-1.5 text-[13px] font-medium text-ink">
                  {{ item.rotulo }}
                  <UiInfo :texto="item.descricao" :rotulo="`Sobre ${item.rotulo}`" />
                </span>
                <span class="mt-0.5 block text-xs text-muted">{{ item.fundamento }}</span>
              </span>
            </label>
          </div>
          <p v-if="erros.modalidade" class="mt-3 text-xs text-negative">{{ erros.modalidade }}</p>
        </fieldset>
      </UiPanel>

      <div class="vidro rounded-lg">
        <UiFormGroup
          titulo="Aviso prévio"
          :descricao="opcoes.length ? 'Indenizado: pago e projetado no tempo de serviço. Trabalhado: cumprido até o desligamento; com aviso proporcional, os dias acima de 30 são indenizados.' : undefined"
          largo
        >
          <p v-if="!opcoes.length" class="col-span-2 pb-4 text-[13px] text-muted lg:col-span-4">
            Não há aviso prévio nesta modalidade.
          </p>

          <UiSegmented
            v-else
            v-model="form.aviso"
            nome="resc-aviso"
            rotulo="Tratamento do aviso"
            :opcoes="opcoes"
            class="col-span-2"
          />

          <UiField
            v-if="modalidade.aviso === 'empregado' && form.aviso === 'nao_cumprido'"
            id="resc-dias-nao-cumpridos"
            rotulo="Dias não cumpridos"
            ajuda="Dias do aviso que o empregado não cumpriu; podem ser descontados (art. 487, § 2º)."
            :erro="erros.diasAvisoNaoCumpridos"
          >
            <template #default="{ id, descricao, invalido }">
              <UiInput :id="id" v-model="form.diasAvisoNaoCumpridos" type="number" min="1" max="30" step="1" sufixo="dias" :invalido="invalido" :aria-describedby="descricao" />
            </template>
          </UiField>

          <dl v-if="resultado && resultado.tempo.diasAvisoIndenizados > 0" class="col-span-2 grid grid-cols-2 gap-3 text-[13px]">
            <div>
              <dt class="text-xs text-muted">Dias indenizados</dt>
              <dd class="num font-medium text-ink">{{ resultado.tempo.diasAvisoIndenizados }} dias</dd>
            </div>
            <div>
              <dt class="text-xs text-muted">Data projetada</dt>
              <dd class="num font-medium text-ink">{{ formatarData(resultado.tempo.dataProjetada) }}</dd>
            </div>
          </dl>
        </UiFormGroup>

        <UiFormGroup v-if="modalidade.indenizacao480" titulo="Indenização do art. 480" largo>
          <UiField
            id="resc-480"
            rotulo="Prejuízo a indenizar"
            opcional
            :ajuda="`Prejuízos comprovados pelo empregador. Limitado ao valor do art. 479${limite480 !== null ? ` (${formatarMoeda(limite480)} neste cálculo)` : ''}. Em branco, aplica o limite.`"
            :erro="erros.indenizacao480"
          >
            <template #default="{ id, descricao, invalido }">
              <UiMoneyInput :id="id" v-model="form.indenizacao480" placeholder="Limite legal" :invalido="invalido" :aria-describedby="descricao" />
            </template>
          </UiField>
        </UiFormGroup>

        <UiFormGroup titulo="Verbas adicionais e descontos" largo>
          <UiSwitch
            id="resc-multa-477"
            v-model="form.multa477"
            rotulo="Multa do art. 477, § 8º"
            descricao="Pagamento fora do prazo de 10 dias."
            class="col-span-2 pb-[22px]"
          />
          <UiSwitch
            id="resc-7238"
            v-model="form.indenizacao7238"
            rotulo="Indenização da Lei 7.238/84"
            descricao="Dispensa nos 30 dias anteriores à data-base."
            class="col-span-2 pb-[22px]"
          />
          <UiField id="resc-outros-descontos" rotulo="Outros descontos" opcional class="col-span-2" ajuda="Vale-transporte, adiantamentos e demais descontos sem incidência tributária." :erro="erros.outrosDescontos">
            <template #default="{ id, descricao, invalido }">
              <UiMoneyInput :id="id" v-model="form.outrosDescontos" placeholder="0,00" :invalido="invalido" :aria-describedby="descricao" />
            </template>
          </UiField>
        </UiFormGroup>
      </div>
    </div>

    <UiPanel :titulo="`Direitos: ${modalidade.rotulo}`" :descricao="modalidade.fundamento" class="2xl:sticky 2xl:top-8">
      <ul class="divide-y divide-line">
        <li v-for="item in direitos" :key="item.rotulo" class="flex items-center justify-between gap-3 px-5 py-2.5 text-[13px]">
          <span class="flex items-center gap-2 text-ink-2">
            <UiIcon
              :nome="item.devido ? 'ok' : 'fechar'"
              :tamanho="14"
              :class="item.devido ? 'text-positive' : 'text-ink-subtle'"
            />
            {{ item.rotulo }}
          </span>
          <span class="text-right" :class="item.devido ? 'font-medium text-ink' : 'text-muted'">{{ item.texto }}</span>
        </li>
      </ul>
    </UiPanel>
  </div>
</template>
