<script setup lang="ts">
import { computed } from 'vue'
import ExIcon from './ExIcon.vue'
import type { IconName } from './icons'

const props = withDefaults(
  defineProps<{ tone?: 'info' | 'success' | 'warning' | 'danger'; title?: string }>(),
  { tone: 'info' },
)
const icon = computed<IconName>(
  () => ({ info: 'info', success: 'success', warning: 'alert', danger: 'alert' } as const)[props.tone],
)
</script>

<template>
  <div :class="['ex-alert', `ex-alert--${tone}`]" :role="tone === 'danger' ? 'alert' : 'status'">
    <span class="ex-alert__icon"><ExIcon :name="icon" /></span>
    <div class="ex-alert__text">
      <p v-if="title" class="ex-alert__title">{{ title }}</p>
      <div v-if="$slots.default" class="ex-alert__body"><slot /></div>
    </div>
    <div v-if="$slots.action" class="ex-alert__action"><slot name="action" /></div>
  </div>
</template>
