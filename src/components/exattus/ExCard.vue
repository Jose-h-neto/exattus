<script setup lang="ts">
defineProps<{ title?: string; subtitle?: string; /** no inner padding, for tables and lists edge to edge */ flush?: boolean }>()
</script>

<template>
  <section :class="['ex-card', { 'ex-card--flush': flush }]">
    <header v-if="title || $slots.action" class="ex-card__head">
      <div>
        <h3 v-if="title" class="ex-card__title">{{ title }}</h3>
        <p v-if="subtitle" class="ex-card__sub">{{ subtitle }}</p>
      </div>
      <slot name="action" />
    </header>
    <slot />
  </section>
</template>
