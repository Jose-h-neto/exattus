<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'

import PageHeader from '@/components/layout/PageHeader.vue'
import ParametrosRescisao from '@/components/rescisao/ParametrosRescisao.vue'
import UiAlert from '@/components/ui/UiAlert.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiField from '@/components/ui/UiField.vue'
import UiIcon from '@/components/ui/UiIcon.vue'
import UiInfo from '@/components/ui/UiInfo.vue'
import UiModal from '@/components/ui/UiModal.vue'
import UiMoneyInput from '@/components/ui/UiMoneyInput.vue'
import UiPanel from '@/components/ui/UiPanel.vue'

import { formatarDecimal, formatarMoeda, formatarPercentual, paraCentavos } from '@/domain/dinheiro'
import { descreverFaixaIrrf } from '@/domain/irrf'
import { tetoInss, validarTabelaInss, valorCheioFaixa } from '@/domain/inss'
import { ANO_VIGENCIA, FONTES_OFICIAIS, IRRF_2026, REDUCAO_2026, type TabelaInss } from '@/domain/parametros'
import { useAvisos } from '@/stores/avisos'
import { useParametros } from '@/stores/parametros'

const { tabelaInss, personalizada, atualizarTabelaInss, restaurarPadrao } = useParametros()
const { avisar } = useAvisos()

const secoes = [
  { id: 'inss', rotulo: 'Tabela do INSS' },
  { id: 'irrf', rotulo: 'Tabela do IRRF' },
  { id: 'reducao', rotulo: 'Redução Lei 15.270' },
  { id: 'rescisao', rotulo: 'Rescisão' },
  { id: 'regras', rotulo: 'Regras de cálculo' },
  { id: 'fontes', rotulo: 'Fontes oficiais' },
]

/* Edicao da tabela INSS: campos em texto, aplicados quando toda a tabela e valida. */

interface CamposFaixa {
  limite: string
  aliquota: string
  valorFixo: string
}

const campos = reactive({
  faixas: [] as CamposFaixa[],
  aliquotaProlabore: '',
})

function carregarCampos(tabela: TabelaInss) {
  campos.faixas = tabela.faixas.map((faixa) => ({
    limite: formatarDecimal(faixa.limite),
    aliquota: formatarDecimal(faixa.aliquota),
    valorFixo: faixa.valorFixo === null ? '' : formatarDecimal(faixa.valorFixo),
  }))
  campos.aliquotaProlabore = formatarDecimal(tabela.aliquotaProlabore)
}

carregarCampos(tabelaInss.value)

const leitura = computed(() => {
  const erros: Record<string, string> = {}
  const valor = (texto: string, chave: string, opcional = false) => {
    const centavos = paraCentavos(texto)

    if (centavos === null) {
      if (!opcional) erros[chave] = 'Obrigatório'
      return null
    }

    if (Number.isNaN(centavos)) {
      erros[chave] = 'Valor inválido'
      return null
    }

    return centavos
  }

  const tabela: TabelaInss = {
    faixas: campos.faixas.map((faixa, indice) => ({
      limite: valor(faixa.limite, `limite-${indice}`) ?? 0,
      aliquota: valor(faixa.aliquota, `aliquota-${indice}`) ?? 0,
      valorFixo: valor(faixa.valorFixo, `fixo-${indice}`, true),
    })),
    aliquotaProlabore: valor(campos.aliquotaProlabore, 'prolabore') ?? 0,
  }

  const regras = Object.keys(erros).length ? [] : validarTabelaInss(tabela)

  return { tabela, erros, regras, valida: !Object.keys(erros).length && !regras.length }
})

watch(
  () => leitura.value,
  ({ tabela, valida }) => {
    if (valida && JSON.stringify(tabela) !== JSON.stringify(tabelaInss.value)) {
      atualizarTabelaInss(tabela)
    }
  },
)

function recalcularValoresFixos() {
  if (!leitura.value.valida) return

  const faixas = leitura.value.tabela.faixas

  faixas.forEach((_, indice) => {
    const campo = campos.faixas[indice]

    if (campo) campo.valorFixo = formatarDecimal(valorCheioFaixa(faixas, indice))
  })

  avisar('Valores fixos das faixas recalculados.')
}

const confirmarRestauracao = ref(false)

function restaurar() {
  restaurarPadrao()
  carregarCampos(tabelaInss.value)
  confirmarRestauracao.value = false
  avisar(`Tabela oficial de ${ANO_VIGENCIA} restaurada.`)
}

function divergente(indice: number) {
  const faixa = leitura.value.tabela.faixas[indice]

  return Boolean(
    faixa && faixa.valorFixo !== null && faixa.valorFixo !== valorCheioFaixa(leitura.value.tabela.faixas, indice),
  )
}

const reducao = REDUCAO_2026
</script>

<template>
  <PageHeader />

  <div class="grid items-start gap-8 xl:grid-cols-[200px_minmax(0,1fr)]">
    <nav aria-label="Seções" class="hidden xl:sticky xl:top-8 xl:block">
      <ul class="space-y-0.5 border-l border-line">
        <li v-for="secao in secoes" :key="secao.id">
          <a
            :href="`#${secao.id}`"
            class="-ml-px block border-l border-transparent py-1.5 pl-4 text-[13px] text-muted hover:border-line-strong hover:text-ink"
          >
            {{ secao.rotulo }}
          </a>
        </li>
      </ul>
    </nav>

    <div v-navegar-enter class="min-w-0 space-y-6">
      <UiPanel
        id="inss"
        titulo="Tabela de contribuição do INSS"
        :descricao="`Contribuição de empregados, vigência ${ANO_VIGENCIA}. As alterações valem para a Folha mensal e para Férias e ficam salvas neste navegador.`"
        class="scroll-mt-8"
      >
        <template #acoes>
          <UiBadge :tom="personalizada ? 'atencao' : 'sucesso'">
            {{ personalizada ? 'Personalizada' : `Oficial ${ANO_VIGENCIA}` }}
          </UiBadge>
          <UiButton tamanho="sm" :disabled="!leitura.valida" @click="recalcularValoresFixos">Recalcular valores fixos</UiButton>
          <UiButton tamanho="sm" variante="discreto" icone="reiniciar" :disabled="!personalizada" @click="confirmarRestauracao = true">
            Restaurar oficial
          </UiButton>
        </template>

        <div class="overflow-x-auto">
          <table class="tabela min-w-[720px]">
            <thead>
              <tr>
                <th scope="col" class="pl-5">Faixa</th>
                <th scope="col">Limite superior</th>
                <th scope="col">Alíquota</th>
                <th scope="col">
                  <span class="inline-flex items-center gap-1.5">
                    Valor fixo da faixa completa
                    <UiInfo texto="Usado quando a base ultrapassa a faixa inteira. Deixe em branco para calcular pela alíquota." />
                  </span>
                </th>
                <th scope="col" class="num pr-5">
                  <span class="inline-flex items-center gap-1.5">
                    Faixa × alíquota
                    <UiInfo texto="Valor de referência calculado pela largura da faixa e pela alíquota, para conferir o valor fixo." />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(faixa, indice) in campos.faixas" :key="indice">
                <th scope="row" class="!bg-transparent border-t border-line pl-5 !text-[13px] !font-medium !text-ink">
                  Faixa {{ indice + 1 }}
                </th>
                <td class="w-48">
                  <UiMoneyInput
                    v-model="faixa.limite"
                    :aria-label="`Limite superior da faixa ${indice + 1}`"
                    :invalido="Boolean(leitura.erros[`limite-${indice}`])"
                  />
                </td>
                <td class="w-36">
                  <UiMoneyInput
                    v-model="faixa.aliquota"
                    sufixo="%"
                    :aria-label="`Alíquota da faixa ${indice + 1}`"
                    :invalido="Boolean(leitura.erros[`aliquota-${indice}`])"
                  />
                </td>
                <td class="w-52">
                  <UiMoneyInput
                    v-model="faixa.valorFixo"
                    placeholder="Calcular"
                    :aria-label="`Valor fixo da faixa ${indice + 1}`"
                    :invalido="Boolean(leitura.erros[`fixo-${indice}`])"
                  />
                </td>
                <td class="num pr-5 align-middle">
                  <span :class="divergente(indice) ? 'font-medium text-warning' : 'text-muted'">
                    {{ formatarMoeda(valorCheioFaixa(leitura.tabela.faixas, indice)) }}
                  </span>
                  <span v-if="divergente(indice)" class="block text-[11px] text-warning">difere do valor fixo</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="flex flex-wrap items-end gap-x-8 gap-y-4 border-t border-line px-5 py-4">
          <UiField
            id="param-prolabore"
            rotulo="Alíquota do pró-labore"
            ajuda="Alíquota única sobre a base do pró-labore, limitada ao teto de contribuição."
            :erro="leitura.erros.prolabore ? 'Valor inválido' : undefined"
            class="w-48"
          >
            <template #default="{ id, invalido }">
              <UiMoneyInput :id="id" v-model="campos.aliquotaProlabore" sufixo="%" :invalido="invalido" />
            </template>
          </UiField>

          <dl class="pb-2 text-[13px]">
            <dt class="inline-flex items-center gap-1.5 text-muted">
              Teto de contribuição
              <UiInfo texto="Limite da última faixa. Aplica-se ao empregado e ao pró-labore." />
            </dt>
            <dd class="num inline font-medium text-ink"> {{ formatarMoeda(tetoInss(leitura.tabela)) }}</dd>
          </dl>
        </div>

        <div v-if="leitura.regras.length || Object.keys(leitura.erros).length" class="border-t border-line px-5 py-4">
          <UiAlert tom="perigo" titulo="A tabela não foi aplicada">
            <ul class="list-disc pl-4">
              <li v-for="regra in leitura.regras" :key="regra">{{ regra }}</li>
              <li v-if="Object.keys(leitura.erros).length">Corrija os campos destacados.</li>
            </ul>
            Os cálculos continuam usando a última tabela válida.
          </UiAlert>
        </div>
      </UiPanel>

      <UiPanel id="irrf" titulo="Tabela mensal do IRRF" :descricao="`Tabela progressiva mensal da Receita Federal, vigência ${ANO_VIGENCIA}.`" class="scroll-mt-8">
        <div class="overflow-x-auto">
          <table class="tabela min-w-[520px]">
            <thead>
              <tr>
                <th scope="col" class="pl-5">Base de cálculo</th>
                <th scope="col" class="num">Alíquota</th>
                <th scope="col" class="num pr-5">Parcela a deduzir</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(faixa, indice) in IRRF_2026.faixas" :key="indice">
                <td class="num pl-5 text-left text-ink">{{ descreverFaixaIrrf(indice) }}</td>
                <td class="num">{{ faixa.aliquota === 0 ? 'Isento' : formatarPercentual(faixa.aliquota) }}</td>
                <td class="num pr-5">{{ formatarMoeda(faixa.deducao) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <dl class="grid border-t border-line sm:grid-cols-2">
          <div class="px-5 py-3.5">
            <dt class="text-xs text-muted">Dedução mensal por dependente</dt>
            <dd class="num mt-0.5 text-sm font-semibold text-ink">{{ formatarMoeda(IRRF_2026.dependente) }}</dd>
          </div>
          <div class="border-t border-line px-5 py-3.5 sm:border-t-0 sm:border-l">
            <dt class="text-xs text-muted">Desconto simplificado mensal</dt>
            <dd class="num mt-0.5 text-sm font-semibold text-ink">{{ formatarMoeda(IRRF_2026.simplificado) }}</dd>
          </div>
        </dl>
      </UiPanel>

      <UiPanel id="reducao" titulo="Redução do imposto — Lei nº 15.270/2025" descricao="Aplicada sobre o imposto calculado pela tabela" class="scroll-mt-8">
        <table class="tabela">
          <thead>
            <tr>
              <th scope="col" class="pl-5">Rendimento tributável</th>
              <th scope="col" class="pr-5">Redução</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="num pl-5 text-left text-ink">Até {{ formatarMoeda(reducao.limiteIsencao) }}</td>
              <td class="pr-5">
                Até {{ formatarMoeda(reducao.reducaoMaxima) }}, limitada ao imposto calculado — o IRRF fica zerado.
              </td>
            </tr>
            <tr>
              <td class="num pl-5 text-left text-ink">
                De {{ formatarMoeda(reducao.limiteIsencao + 1) }} a {{ formatarMoeda(reducao.limiteTransicao) }}
              </td>
              <td class="pr-5">{{ formatarMoeda(reducao.parcelaFixa) }} − (0,133145 × rendimento tributável), limitada ao imposto calculado.</td>
            </tr>
            <tr>
              <td class="num pl-5 text-left text-ink">Acima de {{ formatarMoeda(reducao.limiteTransicao) }}</td>
              <td class="pr-5">Sem redução.</td>
            </tr>
          </tbody>
        </table>
      </UiPanel>

      <ParametrosRescisao />

      <UiPanel id="regras" titulo="Regras de cálculo" class="scroll-mt-8">
        <dl class="divide-y divide-line text-[13px]">
          <div v-for="regra in [
            ['Arredondamento', 'Todos os valores são calculados em centavos inteiros, com arredondamento a cada faixa.'],
            ['Salário proporcional', 'Salário bruto ÷ 30 × dias trabalhados; o mês é sempre considerado com 30 dias.'],
            ['INSS do empregado', 'Progressivo por faixas até o teto. Faixas completas usam o valor fixo da tabela, quando informado.'],
            ['INSS do pró-labore', 'Alíquota única sobre a base, limitada ao teto de contribuição.'],
            ['Modelo do IRRF', 'O sistema calcula pelas deduções legais (INSS + dependentes) e pelo desconto simplificado e adota o menor imposto.'],
            ['Férias', 'Salário ÷ 30 × dias gozados, mais as médias; 1/3 constitucional sobre salário proporcional + médias.'],
            ['Abono pecuniário', 'Salário ÷ 30 × dias vendidos, mais médias proporcionais, isento de INSS e IRRF. O 1/3 sobre o abono entra na base do IRRF das férias (sem INSS).'],
            ['INSS sobre férias', 'Calculado por competência, com o valor tributável (férias + 1/3) rateado pelos dias de gozo em cada mês.'],
            ['IRRF sobre férias', 'Tributação exclusiva sobre férias + 1/3 + 1/3 do abono, separada dos demais rendimentos do mês.'],
          ]" :key="regra[0]" class="grid gap-1 px-5 py-3 sm:grid-cols-[200px_1fr]">
            <dt class="font-medium text-ink">{{ regra[0] }}</dt>
            <dd class="text-ink-2">{{ regra[1] }}</dd>
          </div>
        </dl>
      </UiPanel>

      <UiPanel id="fontes" titulo="Fontes oficiais" class="scroll-mt-8">
        <ul class="divide-y divide-line">
          <li v-for="fonte in FONTES_OFICIAIS" :key="fonte.url">
            <a
              :href="fonte.url"
              target="_blank"
              rel="noopener noreferrer"
              class="flex items-center justify-between gap-4 px-5 py-3 text-sm text-primary hover:bg-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
            >
              {{ fonte.titulo }}
              <UiIcon nome="externo" :tamanho="15" class="text-muted" />
              <span class="sr-only">(abre em nova aba)</span>
            </a>
          </li>
        </ul>
      </UiPanel>
    </div>
  </div>

  <UiModal
    :aberto="confirmarRestauracao"
    :titulo="`Restaurar a tabela oficial de ${ANO_VIGENCIA}?`"
    descricao="Os limites, alíquotas e valores fixos personalizados serão substituídos pelos valores oficiais."
    @fechar="confirmarRestauracao = false"
  >
    <template #acoes>
      <UiButton data-foco-inicial @click="confirmarRestauracao = false">Cancelar</UiButton>
      <UiButton variante="primario" @click="restaurar">Restaurar</UiButton>
    </template>
  </UiModal>
</template>
