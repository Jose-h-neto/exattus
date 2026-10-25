<script setup lang="ts">
import type { Tone } from './types'

withDefaults(defineProps<{ tone?: Tone; dot?: boolean }>(), { tone: 'neutral' })
</script>

<template>
  <span :class="['ex-badge', `ex-badge--${tone}`]">
    <span v-if="dot" class="ex-badge__dot" aria-hidden="true" />
    <slot />
  </span>
</template>
