<script setup lang="ts">
import { computed } from 'vue'
import ExIcon from './ExIcon.vue'
import type { IconName } from './icons'

const props = withDefaults(
  defineProps<{
    label: string
    value: string
    icon?: IconName
    delta?: string
    /** is the change good or bad? Turnover up is danger, headcount up is success */
    deltaTone?: 'neutral' | 'success' | 'warning' | 'danger'
    caption?: string
    /** small sparkline, oldest first */
    trend?: number[]
  }>(),
  { deltaTone: 'neutral' },
)

const W = 96
const H = 32
const line = computed(() => {
  const d = props.trend ?? []
  if (d.length < 2) return ''
  const min = Math.min(...d)
  const span = Math.max(...d) - min || 1
  return d
    .map((v, i) => `${i ? 'L' : 'M'}${((i / (d.length - 1)) * W).toFixed(1)} ${(H - 3 - ((v - min) / span) * (H - 6)).toFixed(1)}`)
    .join(' ')
})
</script>

<template>
  <div class="ex-stat">
    <div class="ex-stat__head">
      <span v-if="icon" class="ex-stat__icon"><ExIcon :name="icon" :size="18" /></span>
      <span>{{ label }}</span>
    </div>
    <div class="ex-stat__value">{{ value }}</div>
    <div v-if="delta || caption" class="ex-stat__foot">
      <span v-if="delta" :class="['ex-delta', `ex-delta--${deltaTone}`]">{{ delta }}</span>
      <span v-if="caption">{{ caption }}</span>
    </div>
    <div v-if="line" class="ex-stat__spark">
      <svg class="ex-spark" :width="W" :height="H" :viewBox="`0 0 ${W} ${H}`" aria-hidden="true">
        <path class="ex-spark__area" :d="`${line} L${W} ${H} L0 ${H} Z`" />
        <path class="ex-spark__line" :d="line" />
      </svg>
    </div>
  </div>
</template>
