<script setup lang="ts">
import { ref } from 'vue'

import UiIcon from '@/components/ui/UiIcon.vue'
import { formatarMoeda } from '@/domain/dinheiro'
import type { ResultadoRescisao, Rubrica } from '@/domain/rescisao/calculo'

defineProps<{ resultado: ResultadoRescisao }>()

const abertas = ref(new Set<string>())

function alternar(codigo: string) {
  const proximas = new Set(abertas.value)

  if (proximas.has(codigo)) {
    proximas.delete(codigo)
  } else {
    proximas.add(codigo)
  }

  abertas.value = proximas
}

const ROTULOS_NATUREZA: Record<Rubrica['natureza'], string> = {
  remuneratoria: 'Remuneratória',
  indenizatoria: 'Indenizatória',
  desconto: 'Desconto',
  tributo: 'Tributo',
}

function incidencias(rubrica: Rubrica) {
  if (rubrica.natureza === 'tributo') return []

  const decimo = rubrica.grupo === 'decimo' ? ' 13º' : ''

  return [
    { sigla: 'INSS', ativa: rubrica.incidencia.inss, titulo: `INSS${decimo}` },
    { sigla: 'IRRF', ativa: rubrica.incidencia.irrf, titulo: `IRRF${decimo}` },
    { sigla: 'FGTS', ativa: rubrica.incidencia.fgts, titulo: 'FGTS' },
  ]
}
</script>

<template>
  <section class="min-w-0 overflow-hidden vidro rounded-lg" aria-labelledby="titulo-demonstrativo-rescisao">
    <header class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line px-5 py-3">
      <h2 id="titulo-demonstrativo-rescisao" class="text-base font-bold text-ink">Demonstrativo</h2>
      <p class="text-xs text-muted">{{ resultado.modalidade.rotulo }}</p>
    </header>

    <div class="overflow-x-auto">
      <table class="tabela min-w-[680px]">
        <thead>
          <tr>
            <th scope="col" class="pl-5">Verba</th>
            <th scope="col">Incidências</th>
            <th scope="col" class="num">Referência</th>
            <th scope="col" class="num">Proventos</th>
            <th scope="col" class="num pr-5">Descontos</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="rubrica in [...resultado.proventos, ...resultado.descontos]" :key="rubrica.codigo">
            <tr>
              <td class="pl-5">
                <button
                  type="button"
                  class="-ml-1 flex items-start gap-1.5 rounded-sm px-1 text-left focus-visible:focus-ring"
                  :aria-expanded="abertas.has(rubrica.codigo)"
                  :aria-controls="`memoria-${rubrica.codigo}`"
                  @click="alternar(rubrica.codigo)"
                >
                  <UiIcon
                    nome="seta"
                    :tamanho="14"
                    class="mt-[3px] text-ink-muted transition-transform"
                    :class="abertas.has(rubrica.codigo) && 'rotate-90'"
                  />
                  <span>
                    <span class="block font-semibold text-ink">{{ rubrica.descricao }}</span>
                    <span class="block text-xs text-ink-muted">{{ ROTULOS_NATUREZA[rubrica.natureza] }}</span>
                  </span>
                </button>
              </td>
              <td>
                <span class="flex gap-1">
                  <span
                    v-for="item in incidencias(rubrica)"
                    :key="item.sigla"
                    class="rounded-xs px-1 text-[10px] leading-4 font-semibold ring-1 ring-inset"
                    :class="item.ativa ? 'bg-primary-soft text-primary ring-primary/30' : 'text-ink-subtle line-through ring-line'"
                    :title="`${item.titulo}: ${item.ativa ? 'incide' : 'não incide'}`"
                  >
                    {{ item.sigla }}
                    <span class="sr-only">{{ item.ativa ? 'incide' : 'não incide' }}</span>
                  </span>
                </span>
              </td>
              <td class="num text-muted">{{ rubrica.referencia }}</td>
              <td class="num">{{ rubrica.tipo === 'provento' ? formatarMoeda(rubrica.valor) : '' }}</td>
              <td class="num pr-5">{{ rubrica.tipo === 'desconto' ? formatarMoeda(rubrica.valor) : '' }}</td>
            </tr>
            <tr v-if="abertas.has(rubrica.codigo)" :id="`memoria-${rubrica.codigo}`">
              <td colspan="5" class="!border-t-0 bg-sunken/60 !py-2 pr-5 pl-12">
                <ol class="list-decimal space-y-0.5 pl-4 text-xs text-ink-2 marker:text-muted">
                  <li v-for="(linha, indice) in rubrica.memoria" :key="indice" class="num">{{ linha }}</li>
                </ol>
              </td>
            </tr>
          </template>
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" colspan="3" class="pl-5 text-left">Totais</th>
            <td class="num">{{ formatarMoeda(resultado.totalProventos) }}</td>
            <td class="num pr-5">{{ formatarMoeda(resultado.totalDescontos) }}</td>
          </tr>
          <tr>
            <th scope="row" colspan="3" class="!bg-primary-soft/70 pl-5 text-left !text-primary">Valor líquido</th>
            <td colspan="2" class="num !bg-primary-soft/70 pr-5 text-base !text-primary">{{ formatarMoeda(resultado.liquido) }}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  </section>
</template>
