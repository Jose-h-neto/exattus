<script setup lang="ts" generic="R extends { id: string | number }">
import { computed, useSlots } from 'vue'
import ExCheckbox from './ExCheckbox.vue'
import type { TableColumn } from './types'

const props = defineProps<{
  columns: TableColumn[]
  rows: R[]
  selectable?: boolean
  caption?: string
  emptyText?: string
}>()
/** ids of the selected rows */
const selected = defineModel<R['id'][]>('selected', { default: () => [] })

const allSelected = computed(() => props.rows.length > 0 && selected.value.length === props.rows.length)
const someSelected = computed(() => selected.value.length > 0 && !allSelected.value)
const slots = useSlots()
const span = computed(() => props.columns.length + (props.selectable ? 1 : 0) + (slots.actions ? 1 : 0))

function toggleAll() {
  selected.value = allSelected.value ? [] : props.rows.map((r) => r.id)
}
function toggle(id: R['id']) {
  selected.value = selected.value.includes(id) ? selected.value.filter((x) => x !== id) : [...selected.value, id]
}
const alignClass = (a?: string) => (a === 'right' ? 'is-right' : a === 'center' ? 'is-center' : undefined)
</script>

<template>
  <div class="ex-table-wrap">
    <table class="ex-table">
      <caption v-if="caption" class="ex-sr">{{ caption }}</caption>
      <thead>
        <tr>
          <th v-if="selectable" class="ex-table__sel" scope="col">
            <ExCheckbox
              :model-value="allSelected"
              :indeterminate="someSelected"
              aria-label="Selecionar todas as linhas"
              @update:model-value="toggleAll"
            />
          </th>
          <th v-for="col in columns" :key="col.key" scope="col" :class="alignClass(col.align)" :style="col.width ? { width: col.width } : undefined">
            {{ col.label }}
          </th>
          <th v-if="$slots.actions" scope="col" class="ex-table__actions"><span class="ex-sr">Ações</span></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.id" :aria-selected="selectable ? selected.includes(row.id) : undefined">
          <td v-if="selectable" class="ex-table__sel">
            <ExCheckbox :model-value="selected.includes(row.id)" aria-label="Selecionar linha" @update:model-value="toggle(row.id)" />
          </td>
          <td v-for="col in columns" :key="col.key" :class="alignClass(col.align)">
            <!-- #cell-<key>="{ row }" to render a cell yourself -->
            <slot :name="`cell-${col.key}`" :row="row">{{ (row as Record<string, unknown>)[col.key] }}</slot>
          </td>
          <td v-if="$slots.actions" class="ex-table__actions"><slot name="actions" :row="row" /></td>
        </tr>
        <tr v-if="!rows.length">
          <td :colspan="span" class="ex-table__empty">{{ emptyText ?? 'Nada por aqui ainda.' }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
