<script setup lang="ts">
import ExIcon from './ExIcon.vue'

defineOptions({ inheritAttrs: false })
const model = defineModel<boolean>({ default: false })
defineProps<{ label?: string; indeterminate?: boolean; disabled?: boolean }>()
</script>

<template>
  <label :class="['ex-check', { 'is-disabled': disabled }]">
    <input
      v-bind="$attrs"
      v-model="model"
      type="checkbox"
      class="ex-check__input"
      :indeterminate="indeterminate"
      :disabled="disabled"
    />
    <span class="ex-check__box" aria-hidden="true">
      <ExIcon :name="indeterminate ? 'minus' : 'check'" :size="14" :stroke-width="2.5" />
    </span>
    <span v-if="label">{{ label }}</span>
  </label>
</template>
