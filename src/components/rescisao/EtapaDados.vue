<script setup lang="ts">
import { computed } from 'vue'

import UiField from '@/components/ui/UiField.vue'
import UiFormGroup from '@/components/ui/UiFormGroup.vue'
import UiDateInput from '@/components/ui/UiDateInput.vue'
import UiInfo from '@/components/ui/UiInfo.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiMoneyInput from '@/components/ui/UiMoneyInput.vue'
import UiSegmented from '@/components/ui/UiSegmented.vue'
import UiSwitch from '@/components/ui/UiSwitch.vue'

import { formatarData, lerData } from '@/domain/datas'
import { ROTULOS_CONTRATO_CURTOS, type TipoContrato } from '@/domain/rescisao/modalidades'
import { periodosAquisitivos } from '@/domain/rescisao/tempo'
import {
  ajustarModalidade,
  formularioRescisao as form,
  sincronizarPeriodos,
  sugerirPagamento,
} from '@/features/rescisao'
import { leituraRescisao } from '@/features/rescisaoEstado'

const erros = computed(() => leituraRescisao.value.erros)

const contratos = (Object.keys(ROTULOS_CONTRATO_CURTOS) as TipoContrato[]).map((valor) => ({
  valor,
  rotulo: ROTULOS_CONTRATO_CURTOS[valor],
}))

const contratoAPrazo = computed(() => form.tipoContrato !== 'indeterminado')

/** Periodos completos com datas, para a tabela do historico de ferias. */
const periodos = computed(() => {
  const admissao = lerData(form.admissao)
  const desligamento = lerData(form.desligamento)

  if (!admissao || !desligamento || desligamento < admissao) return []

  return periodosAquisitivos(admissao, desligamento)
    .filter((periodo) => periodo.completo)
    .map((periodo) => ({ ...periodo, vencidoConcessivo: periodo.fimConcessivo < desligamento }))
})

const temPagamentosAnteriores = computed(() =>
  Boolean(
    form.adiantamentoDecimo ||
      form.saldoFgts ||
      form.folhaRendimentos ||
      form.folhaInss ||
      form.folhaIrrf ||
      form.competenciaRemuneracao ||
      form.competenciaInss,
  ),
)

function aoMudarDatas() {
  sincronizarPeriodos(form)
}

function aoMudarDesligamento() {
  sugerirPagamento(form)
  sincronizarPeriodos(form)
}
</script>

<template>
  <div class="vidro rounded-lg">
    <UiFormGroup titulo="Funcionário e remuneração" largo>
      <UiField id="resc-referencia" rotulo="Funcionário ou referência" opcional class="col-span-2">
        <template #default="{ id }">
          <UiInput :id="id" v-model="form.referencia" autocomplete="off" />
        </template>
      </UiField>

      <UiField id="resc-salario" rotulo="Salário base" :erro="erros.salario">
        <template #default="{ id, descricao, invalido }">
          <UiMoneyInput :id="id" v-model="form.salario" placeholder="0,00" :invalido="invalido" :aria-describedby="descricao" autofocus />
        </template>
      </UiField>

      <UiField id="resc-dependentes" rotulo="Dependentes (IRRF)" :erro="erros.dependentes">
        <template #default="{ id, descricao, invalido }">
          <UiInput :id="id" v-model="form.dependentes" type="number" min="0" max="99" step="1" :invalido="invalido" :aria-describedby="descricao" />
        </template>
      </UiField>

      <UiField
        id="resc-adicionais"
        rotulo="Adicionais fixos"
        opcional
        ajuda="Adicionais mensais que integram a remuneração: insalubridade, periculosidade, gratificações fixas. Entram no saldo, no aviso, no 13º e nas férias."
        :erro="erros.adicionais"
      >
        <template #default="{ id, descricao, invalido }">
          <UiMoneyInput :id="id" v-model="form.adicionais" placeholder="0,00" :invalido="invalido" :aria-describedby="descricao" />
        </template>
      </UiField>

      <UiField
        id="resc-medias"
        rotulo="Médias variáveis"
        opcional
        ajuda="Média mensal de horas extras, comissões e adicionais variáveis habituais. Integra aviso indenizado, 13º e férias."
        :erro="erros.medias"
      >
        <template #default="{ id, descricao, invalido }">
          <UiMoneyInput :id="id" v-model="form.medias" placeholder="0,00" :invalido="invalido" :aria-describedby="descricao" />
        </template>
      </UiField>
    </UiFormGroup>

    <UiFormGroup titulo="Contrato e desligamento" largo>
      <UiSegmented
        v-model="form.tipoContrato"
        nome="resc-contrato"
        rotulo="Tipo de contrato"
        :opcoes="contratos"
        class="col-span-2"
        @change="ajustarModalidade(form)"
      />

      <UiField id="resc-admissao" rotulo="Admissão" :erro="erros.admissao">
        <template #default="{ id, descricao, invalido }">
          <UiDateInput :id="id" v-model="form.admissao" :invalido="invalido" :aria-describedby="descricao" @change="aoMudarDatas" />
        </template>
      </UiField>

      <UiField
        v-if="contratoAPrazo"
        id="resc-fim-contrato"
        rotulo="Término previsto"
        ajuda="Data final do contrato de experiência ou por prazo determinado. Define os dias restantes para as indenizações dos arts. 479 e 480."
        :erro="erros.fimContrato"
      >
        <template #default="{ id, descricao, invalido }">
          <UiDateInput :id="id" v-model="form.fimContrato" :invalido="invalido" :aria-describedby="descricao" />
        </template>
      </UiField>
      <div v-else class="hidden lg:block" />

      <UiField
        id="resc-desligamento"
        rotulo="Desligamento"
        ajuda="Último dia de trabalho. Com aviso trabalhado, é o último dia do aviso."
        :erro="erros.desligamento"
      >
        <template #default="{ id, descricao, invalido }">
          <UiDateInput :id="id" v-model="form.desligamento" :invalido="invalido" :aria-describedby="descricao" @change="aoMudarDesligamento" />
        </template>
      </UiField>

      <UiField
        id="resc-pagamento"
        rotulo="Pagamento"
        :ajuda="`Define a competência do IRRF (regime de caixa). ${form.pagamentoAutomatico ? 'Sugerido no prazo legal: 10 dias após o desligamento.' : 'Definido manualmente.'}`"
        :erro="erros.pagamento"
      >
        <template #default="{ id, descricao, invalido }">
          <UiDateInput :id="id" v-model="form.pagamento" :invalido="invalido" :aria-describedby="descricao" @change="form.pagamentoAutomatico = false" />
        </template>
      </UiField>

      <UiSwitch
        v-if="contratoAPrazo"
        id="resc-clausula"
        v-model="form.clausulaAssecuratoria"
        rotulo="Cláusula assecuratória (art. 481)"
        class="campo-switch col-span-2"
      />
    </UiFormGroup>

    <UiFormGroup titulo="Mês do desligamento" largo>
      <UiField
        id="resc-variaveis"
        rotulo="Variáveis do mês"
        opcional
        ajuda="Horas extras, comissões e outras verbas remuneratórias apuradas no próprio mês do desligamento."
        :erro="erros.variaveisMes"
      >
        <template #default="{ id, descricao, invalido }">
          <UiMoneyInput :id="id" v-model="form.variaveisMes" placeholder="0,00" :invalido="invalido" :aria-describedby="descricao" />
        </template>
      </UiField>

      <UiField id="resc-faltas-mes" rotulo="Faltas no mês" ajuda="Faltas injustificadas no mês do desligamento; reduzem o saldo de salário." :erro="erros.faltasMes">
        <template #default="{ id, descricao, invalido }">
          <UiInput :id="id" v-model="form.faltasMes" type="number" min="0" max="30" step="1" sufixo="dias" :invalido="invalido" :aria-describedby="descricao" />
        </template>
      </UiField>
    </UiFormGroup>

    <div role="group" aria-labelledby="resc-titulo-ferias" class="border-t border-line px-5 py-4">
      <div class="mb-3 flex items-center gap-1.5">
        <h3 id="resc-titulo-ferias" class="text-sm font-bold text-ink">Histórico de férias</h3>
        <UiInfo
          texto="Períodos aquisitivos completos até o desligamento. Marque os que já foram gozados. As faltas injustificadas reduzem os dias de direito (CLT, art. 130)."
        />
      </div>

      <p v-if="!periodos.length" class="text-[13px] text-muted">
        {{ form.admissao && form.desligamento ? 'Nenhum período aquisitivo completo.' : 'Informe admissão e desligamento.' }}
      </p>

      <div v-else class="overflow-x-auto rounded-md border border-line">
        <table class="tabela min-w-[560px]">
          <thead>
            <tr>
              <th scope="col">Período aquisitivo</th>
              <th scope="col">Concessivo até</th>
              <th scope="col">Situação</th>
              <th scope="col" class="w-32">Faltas</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(periodo, indice) in periodos" :key="periodo.numero">
              <td class="num text-left whitespace-nowrap text-ink">
                {{ periodo.numero }}º · {{ formatarData(periodo.inicio) }} a {{ formatarData(periodo.fim) }}
              </td>
              <td class="num text-left whitespace-nowrap">
                {{ formatarData(periodo.fimConcessivo) }}
                <span v-if="periodo.vencidoConcessivo" class="ml-1 text-[11px] text-warning">encerrado</span>
              </td>
              <td>
                <UiSwitch
                  v-if="form.periodos[indice]"
                  :id="`resc-periodo-${indice}`"
                  v-model="form.periodos[indice].gozado"
                  :rotulo="form.periodos[indice].gozado ? 'Gozado' : 'Não gozado'"
                />
              </td>
              <td>
                <UiInput
                  v-if="form.periodos[indice]"
                  v-model="form.periodos[indice].faltas"
                  type="number"
                  min="0"
                  step="1"
                  :aria-label="`Faltas no ${periodo.numero}º período`"
                  :disabled="form.periodos[indice].gozado"
                  :invalido="Boolean(erros[`periodo-${indice}`])"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="mt-3.5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <UiField
          id="resc-faltas-periodo"
          rotulo="Faltas no período em curso"
          ajuda="Faltas injustificadas no período aquisitivo em andamento; definem os dias das férias proporcionais."
          :erro="erros.faltasPeriodoAtual"
        >
          <template #default="{ id, descricao, invalido }">
            <UiInput :id="id" v-model="form.faltasPeriodoAtual" type="number" min="0" step="1" sufixo="dias" :invalido="invalido" :aria-describedby="descricao" />
          </template>
        </UiField>
      </div>
    </div>

    <UiFormGroup
      titulo="Pagamentos anteriores e FGTS"
      descricao="Valores já pagos que afetam o 13º, o FGTS e os tributos da rescisão."
      recolhivel
      largo
      :aberto="temPagamentosAnteriores"
    >
      <UiField id="resc-adiantamento" rotulo="Adiantamento de 13º" opcional ajuda="Primeira parcela do 13º paga no ano; é descontada na rescisão." :erro="erros.adiantamentoDecimo">
        <template #default="{ id, descricao, invalido }">
          <UiMoneyInput :id="id" v-model="form.adiantamentoDecimo" placeholder="0,00" :invalido="invalido" :aria-describedby="descricao" />
        </template>
      </UiField>

      <UiField
        id="resc-saldo-fgts"
        rotulo="Saldo do FGTS"
        opcional
        ajuda="Saldo para fins rescisórios (depósitos anteriores, com atualização). Base da multa rescisória junto com o FGTS da rescisão."
        :erro="erros.saldoFgts"
      >
        <template #default="{ id, descricao, invalido }">
          <UiMoneyInput :id="id" v-model="form.saldoFgts" placeholder="0,00" :invalido="invalido" :aria-describedby="descricao" />
        </template>
      </UiField>

      <div class="col-span-2 flex items-center gap-1.5 pt-1 pb-1.5 lg:col-span-4">
        <p class="text-xs font-medium text-ink-2">Folha anterior paga no mesmo mês da rescisão</p>
        <UiInfo
          texto="IRRF por regime de caixa. Por exemplo, a folha de setembro paga em outubro e a rescisão paga em outubro são somadas na base do IRRF; o imposto já retido na folha é abatido."
        />
      </div>

      <UiField id="resc-folha-rend" rotulo="Rendimentos tributáveis" opcional :erro="erros.folhaRendimentos">
        <template #default="{ id, descricao, invalido }">
          <UiMoneyInput :id="id" v-model="form.folhaRendimentos" placeholder="0,00" :invalido="invalido" :aria-describedby="descricao" />
        </template>
      </UiField>

      <UiField id="resc-folha-inss" rotulo="INSS descontado" opcional :erro="erros.folhaInss">
        <template #default="{ id, descricao, invalido }">
          <UiMoneyInput :id="id" v-model="form.folhaInss" placeholder="0,00" :invalido="invalido" :aria-describedby="descricao" />
        </template>
      </UiField>

      <UiField id="resc-folha-irrf" rotulo="IRRF retido" opcional :erro="erros.folhaIrrf">
        <template #default="{ id, descricao, invalido }">
          <UiMoneyInput :id="id" v-model="form.folhaIrrf" placeholder="0,00" :invalido="invalido" :aria-describedby="descricao" />
        </template>
      </UiField>

      <div class="hidden lg:block" />

      <div class="col-span-2 flex items-center gap-1.5 pt-1 pb-1.5 lg:col-span-4">
        <p class="text-xs font-medium text-ink-2">Já pago na competência do desligamento</p>
        <UiInfo texto="INSS por competência: remuneração do mesmo mês do desligamento paga antes da rescisão, como um adiantamento com INSS. Soma-se à base e o INSS já descontado é abatido." />
      </div>

      <UiField id="resc-comp-rem" rotulo="Remuneração" opcional :erro="erros.competenciaRemuneracao">
        <template #default="{ id, descricao, invalido }">
          <UiMoneyInput :id="id" v-model="form.competenciaRemuneracao" placeholder="0,00" :invalido="invalido" :aria-describedby="descricao" />
        </template>
      </UiField>

      <UiField id="resc-comp-inss" rotulo="INSS descontado" opcional :erro="erros.competenciaInss">
        <template #default="{ id, descricao, invalido }">
          <UiMoneyInput :id="id" v-model="form.competenciaInss" placeholder="0,00" :invalido="invalido" :aria-describedby="descricao" />
        </template>
      </UiField>
    </UiFormGroup>
  </div>
</template>
