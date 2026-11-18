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
      <!-- Celular: verba, proventos e descontos; referencia e incidencias vao para baixo do nome da verba. -->
      <table class="tabela">
        <thead>
          <tr>
            <th scope="col" class="pl-3 sm:pl-5">Verba</th>
            <th scope="col" class="hidden md:table-cell">Incidências</th>
            <th scope="col" class="num hidden md:table-cell">Referência</th>
            <th scope="col" class="num">Proventos</th>
            <th scope="col" class="num pr-3 sm:pr-5">Descontos</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="rubrica in [...resultado.proventos, ...resultado.descontos]" :key="rubrica.codigo">
            <tr>
              <td class="pl-3 sm:pl-5">
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
                    <span class="block text-xs text-ink-muted">
                      {{ ROTULOS_NATUREZA[rubrica.natureza] }}<span v-if="rubrica.referencia" class="md:hidden"> · {{ rubrica.referencia }}</span>
                    </span>
                  </span>
                </button>
              </td>
              <td class="hidden md:table-cell">
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
              <td class="num hidden text-muted md:table-cell">{{ rubrica.referencia }}</td>
              <td class="num text-(--cor-provento)">{{ rubrica.tipo === 'provento' ? formatarMoeda(rubrica.valor) : '' }}</td>
              <td class="num pr-3 sm:pr-5 text-(--cor-desconto)">{{ rubrica.tipo === 'desconto' ? formatarMoeda(rubrica.valor) : '' }}</td>
            </tr>
            <tr v-if="abertas.has(rubrica.codigo)" :id="`memoria-${rubrica.codigo}`">
              <td colspan="5" class="!border-t-0 bg-sunken/60 !py-2 pr-3 sm:pr-5 pl-12">
                <ol class="list-decimal space-y-0.5 pl-4 text-xs text-ink-2 marker:text-muted">
                  <li v-for="(linha, indice) in rubrica.memoria" :key="indice" class="num">{{ linha }}</li>
                </ol>
              </td>
            </tr>
          </template>
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" colspan="3" class="hidden pl-3 sm:pl-5 text-left md:table-cell">Totais</th>
            <th scope="row" class="pl-3 sm:pl-5 text-left md:hidden">Totais</th>
            <td class="num text-(--cor-provento)">{{ formatarMoeda(resultado.totalProventos) }}</td>
            <td class="num pr-3 sm:pr-5 text-(--cor-desconto)">{{ formatarMoeda(resultado.totalDescontos) }}</td>
          </tr>
          <!-- Liquido: verde (vermelho se negativo) e maior que os demais valores. -->
          <tr :class="resultado.liquido < 0 ? '[&>*]:!bg-negative-soft [&>*]:!text-(--cor-desconto)' : '[&>*]:!bg-(--cor-liquido-fundo) [&>*]:!text-(--cor-liquido)'">
            <th scope="row" colspan="3" class="hidden pl-3 text-left sm:pl-5 md:table-cell">Valor líquido</th>
            <th scope="row" class="pl-3 text-left sm:pl-5 md:hidden">Valor líquido</th>
            <td colspan="2" class="num pr-3 !text-xl sm:pr-5">{{ formatarMoeda(resultado.liquido) }}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  </section>
</template>
