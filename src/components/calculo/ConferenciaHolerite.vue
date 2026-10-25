<script setup lang="ts">
import { formatarMoeda } from '@/domain/dinheiro'
import type { Conferencia } from '@/domain/folha'
import UiBadge from '@/components/ui/UiBadge.vue'

defineProps<{ linhas: { tributo: string; conferencia: Conferencia }[] }>()

function situacao(diferenca: number) {
  if (diferenca === 0) return { texto: 'Confere', tom: 'sucesso' as const }
  if (diferenca > 0) return { texto: 'Acima do calculado', tom: 'atencao' as const }
  return { texto: 'Abaixo do calculado', tom: 'atencao' as const }
}
</script>

<template>
  <section class="min-w-0 overflow-hidden vidro rounded-lg" aria-labelledby="titulo-conferencia">
    <header class="border-b border-line px-5 py-3">
      <h2 id="titulo-conferencia" class="text-base font-bold text-ink">Conferência do holerite</h2>
    </header>
    <div class="overflow-x-auto">
      <table class="tabela min-w-[520px]">
        <thead>
          <tr>
            <th scope="col" class="pl-5">Tributo</th>
            <th scope="col" class="num">Calculado</th>
            <th scope="col" class="num">Informado</th>
            <th scope="col" class="num">Diferença</th>
            <th scope="col" class="pr-5">Situação</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="linha in linhas" :key="linha.tributo">
            <td class="pl-5 font-medium text-ink">{{ linha.tributo }}</td>
            <td class="num">{{ formatarMoeda(linha.conferencia.calculado) }}</td>
            <td class="num">{{ formatarMoeda(linha.conferencia.informado) }}</td>
            <td
              class="num font-medium"
              :class="linha.conferencia.diferenca === 0 ? 'text-positive' : 'text-warning'"
            >
              {{ linha.conferencia.diferenca > 0 ? '+' : '' }}{{ formatarMoeda(linha.conferencia.diferenca) }}
            </td>
            <td class="pr-5">
              <UiBadge :tom="situacao(linha.conferencia.diferenca).tom">
                {{ situacao(linha.conferencia.diferenca).texto }}
              </UiBadge>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
