<script setup lang="ts">
import ExAvatar from './ExAvatar.vue'

defineProps<{ name: string; meta?: string; src?: string; size?: 'sm' | 'md' | 'lg' }>()
</script>

<template>
  <span class="ex-person">
    <ExAvatar :name="name" :src="src" :size="size ?? 'md'" />
    <span class="ex-person__text">
      <span class="ex-person__name">{{ name }}</span>
      <span v-if="meta" class="ex-person__meta">{{ meta }}</span>
    </span>
  </span>
</template>
