<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    value: number
    max?: number
    label?: string
    /** text on the right; defaults to the percentage */
    valueLabel?: string
    tone?: 'primary' | 'success' | 'warning' | 'danger'
  }>(),
  { max: 100, tone: 'primary' },
)
const pct = computed(() => Math.max(0, Math.min(100, (props.value / props.max) * 100)))
</script>

<template>
  <div class="ex-progress">
    <div class="ex-progress__head">
      <span>{{ label }}</span>
      <span class="ex-progress__value">{{ valueLabel ?? `${Math.round(pct)}%` }}</span>
    </div>
    <div
      class="ex-progress__track"
      role="progressbar"
      :aria-valuenow="value"
      aria-valuemin="0"
      :aria-valuemax="max"
      :aria-label="label"
    >
      <div :class="['ex-progress__bar', `ex-progress__bar--${tone}`]" :style="{ width: `${pct}%` }" />
    </div>
  </div>
</template>
