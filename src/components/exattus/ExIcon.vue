<script setup lang="ts">
import { HugeiconsIcon } from '@hugeicons/vue'
import { icons, type IconName } from './icons'

withDefaults(defineProps<{ name: IconName; size?: number; strokeWidth?: number; label?: string }>(), {
  size: 20,
  strokeWidth: 1.5,
})
</script>

<template>
  <HugeiconsIcon
    :icon="icons[name]"
    :size="size"
    :stroke-width="strokeWidth"
    color="currentColor"
    class="ex-icon"
    :role="label ? 'img' : undefined"
    :aria-label="label"
    :aria-hidden="label ? undefined : 'true'"
  />
</template>
