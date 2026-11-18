<script setup lang="ts">
import { formatarMoeda } from '@/domain/dinheiro'

export interface LinhaDemonstrativo {
  descricao: string
  detalhe?: string
  referencia?: string
  provento?: number
  desconto?: number
  /** Verba isenta de INSS e IRRF. */
  isenta?: boolean
}

export interface BaseDemonstrativo {
  rotulo: string
  valor: number
}

/** Encargo do empregador (ex.: FGTS): informado a parte, nao reduz o liquido. */
export interface EncargoDemonstrativo {
  rotulo: string
  /** Ex.: "R$ 3.200,00 × 8%". */
  detalhe?: string
  valor: number
}

defineProps<{
  linhas: LinhaDemonstrativo[]
  totalProventos: number
  totalDescontos: number
  liquido: number
  bases?: BaseDemonstrativo[]
  encargos?: EncargoDemonstrativo[]
  subtitulo?: string
}>()
</script>

<template>
  <section class="@container min-w-0 overflow-hidden vidro rounded-lg" aria-labelledby="titulo-demonstrativo">
    <header class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line px-5 py-3">
      <h2 id="titulo-demonstrativo" class="text-base font-bold text-ink">Demonstrativo</h2>
      <p v-if="subtitulo" class="text-xs text-muted">{{ subtitulo }}</p>
    </header>

    <!-- Coluna estreita: lista empilhada, sem rolagem horizontal. -->
    <ul class="divide-y divide-line @xl:hidden">
      <li v-for="(linha, indice) in linhas" :key="indice" class="flex items-start justify-between gap-4 px-4 py-3 text-sm">
        <div class="min-w-0">
          <p class="font-medium text-ink">
            {{ linha.descricao }}
            <span v-if="linha.isenta" class="ml-1 rounded bg-subtle px-1.5 py-px text-[11px] font-normal text-muted ring-1 ring-line">isento</span>
          </p>
          <p class="mt-0.5 text-xs text-muted">
            {{ [linha.referencia, linha.detalhe].filter(Boolean).join(' · ') }}
          </p>
        </div>
        <p class="num shrink-0 font-medium" :class="linha.desconto !== undefined ? 'text-(--cor-desconto)' : 'text-(--cor-provento)'">
          <template v-if="linha.desconto !== undefined">− {{ formatarMoeda(linha.desconto) }}</template>
          <template v-else-if="linha.provento !== undefined">{{ formatarMoeda(linha.provento) }}</template>
        </p>
      </li>
      <li class="flex justify-between px-4 py-2.5 text-[13px] text-muted">
        <span>Proventos <span class="num text-(--cor-provento)">{{ formatarMoeda(totalProventos) }}</span></span>
        <span>Descontos <span class="num text-(--cor-desconto)">{{ formatarMoeda(totalDescontos) }}</span></span>
      </li>
      <li class="flex items-baseline justify-between px-4 py-3 font-bold" :class="liquido < 0 ? 'bg-negative-soft text-(--cor-desconto)' : 'bg-(--cor-liquido-fundo) text-(--cor-liquido)'">
        <span class="text-sm">Valor líquido</span>
        <span class="num text-xl">{{ formatarMoeda(liquido) }}</span>
      </li>
    </ul>

    <div class="hidden overflow-x-auto @xl:block">
      <table class="tabela">
        <thead>
          <tr>
            <th scope="col" class="pl-5">Descrição</th>
            <th scope="col" class="num">Referência</th>
            <th scope="col" class="num">Proventos</th>
            <th scope="col" class="num pr-5">Descontos</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(linha, indice) in linhas" :key="indice">
            <td class="pl-5">
              <span class="font-medium text-ink">{{ linha.descricao }}</span>
              <span
                v-if="linha.isenta"
                class="ml-2 rounded bg-subtle px-1.5 py-px text-[11px] text-muted ring-1 ring-line"
              >isento</span>
              <span v-if="linha.detalhe" class="mt-0.5 block text-xs text-muted">{{ linha.detalhe }}</span>
            </td>
            <td class="num text-muted">{{ linha.referencia ?? '' }}</td>
            <td class="num text-(--cor-provento)">{{ linha.provento === undefined ? '' : formatarMoeda(linha.provento) }}</td>
            <td class="num pr-5 text-(--cor-desconto)">{{ linha.desconto === undefined ? '' : formatarMoeda(linha.desconto) }}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" colspan="2" class="pl-5 text-left">Totais</th>
            <td class="num text-(--cor-provento)">{{ formatarMoeda(totalProventos) }}</td>
            <td class="num pr-5 text-(--cor-desconto)">{{ formatarMoeda(totalDescontos) }}</td>
          </tr>
          <!-- Liquido: o valor principal (verde; vermelho se negativo), maior que os demais. -->
          <tr :class="liquido < 0 ? '[&>*]:!bg-negative-soft [&>*]:!text-(--cor-desconto)' : '[&>*]:!bg-(--cor-liquido-fundo) [&>*]:!text-(--cor-liquido)'">
            <th scope="row" colspan="2" class="pl-5 text-left">Valor líquido</th>
            <td colspan="2" class="num pr-5 !text-xl">{{ formatarMoeda(liquido) }}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <dl
      v-if="bases?.length"
      class="grid grid-cols-1 gap-x-6 gap-y-2 border-t border-line bg-subtle/60 px-5 py-3 text-xs @xl:auto-cols-fr @xl:grid-flow-col"
    >
      <div v-for="base in bases" :key="base.rotulo" class="flex justify-between gap-3 @xl:flex-col @xl:justify-start @xl:gap-0.5">
        <dt class="text-muted">{{ base.rotulo }}</dt>
        <dd class="num font-medium text-ink-2">{{ formatarMoeda(base.valor) }}</dd>
      </div>
    </dl>

    <!-- Encargos do empregador (FGTS): informativos, menores que o liquido e em azul. -->
    <dl v-if="encargos?.length" class="divide-y divide-line border-t border-line bg-info-soft/40">
      <div v-for="encargo in encargos" :key="encargo.rotulo" class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-2">
        <dt class="min-w-0">
          <span class="block text-[13px] font-semibold text-ink">{{ encargo.rotulo }}</span>
          <span class="mt-0.5 block text-xs text-muted">Depósito do empregador · não desconta do líquido</span>
        </dt>
        <dd class="num text-right">
          <span class="block text-sm font-semibold text-(--cor-encargo)">{{ formatarMoeda(encargo.valor) }}</span>
          <span v-if="encargo.detalhe" class="mt-0.5 block text-xs text-muted">{{ encargo.detalhe }}</span>
        </dd>
      </div>
    </dl>
  </section>
</template>
