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

defineProps<{
  linhas: LinhaDemonstrativo[]
  totalProventos: number
  totalDescontos: number
  liquido: number
  bases?: BaseDemonstrativo[]
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
        <p class="num shrink-0 font-medium" :class="linha.desconto !== undefined ? 'text-ink-2' : 'text-ink'">
          <template v-if="linha.desconto !== undefined">− {{ formatarMoeda(linha.desconto) }}</template>
          <template v-else-if="linha.provento !== undefined">{{ formatarMoeda(linha.provento) }}</template>
        </p>
      </li>
      <li class="flex justify-between px-4 py-2.5 text-[13px] text-muted">
        <span>Proventos <span class="num text-ink-2">{{ formatarMoeda(totalProventos) }}</span></span>
        <span>Descontos <span class="num text-ink-2">{{ formatarMoeda(totalDescontos) }}</span></span>
      </li>
      <li class="flex justify-between bg-primary-soft/70 px-4 py-3 text-sm font-semibold text-primary">
        <span>Valor líquido</span>
        <span class="num">{{ formatarMoeda(liquido) }}</span>
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
            <td class="num">{{ linha.provento === undefined ? '' : formatarMoeda(linha.provento) }}</td>
            <td class="num pr-5">{{ linha.desconto === undefined ? '' : formatarMoeda(linha.desconto) }}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" colspan="2" class="pl-5 text-left">Totais</th>
            <td class="num">{{ formatarMoeda(totalProventos) }}</td>
            <td class="num pr-5">{{ formatarMoeda(totalDescontos) }}</td>
          </tr>
          <tr>
            <th scope="row" colspan="2" class="!bg-primary-soft/70 pl-5 text-left !text-primary">Valor líquido</th>
            <td colspan="2" class="num !bg-primary-soft/70 pr-5 text-base !text-primary">{{ formatarMoeda(liquido) }}</td>
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
  </section>
</template>
