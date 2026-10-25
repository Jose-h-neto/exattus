<script setup lang="ts">
import ExIcon from './ExIcon.vue'
import type { IconName } from './icons'

withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
    size?: 'sm' | 'md' | 'lg'
    icon?: IconName
    iconRight?: IconName
    /** square button with only the icon — pass aria-label */
    iconOnly?: boolean
    type?: 'button' | 'submit' | 'reset'
  }>(),
  { variant: 'secondary', size: 'md', type: 'button' },
)
</script>

<template>
  <button :type="type" :class="['ex-btn', `ex-btn--${variant}`, `ex-btn--${size}`, { 'ex-btn--icon': iconOnly }]">
    <ExIcon v-if="icon" :name="icon" :size="size === 'sm' ? 16 : 18" />
    <slot v-if="!iconOnly" />
    <ExIcon v-if="iconRight && !iconOnly" :name="iconRight" :size="size === 'sm' ? 16 : 18" />
  </button>
</template>
