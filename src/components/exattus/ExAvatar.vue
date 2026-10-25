<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{ name: string; src?: string; size?: 'sm' | 'md' | 'lg' }>(), { size: 'md' })

const initials = computed(() => {
  const parts = props.name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '')).toUpperCase()
})
/** stable tint per name: violet, orchid, info, success */
const tint = computed(() => {
  let s = 0
  for (const ch of props.name) s = (s * 31 + ch.charCodeAt(0)) >>> 0
  return s % 4
})
</script>

<template>
  <span :class="['ex-avatar', `ex-avatar--${size}`, !src && tint ? `ex-avatar--t${tint}` : '']" role="img" :aria-label="name">
    <img v-if="src" :src="src" alt="" />
    <template v-else>{{ initials }}</template>
  </span>
</template>
