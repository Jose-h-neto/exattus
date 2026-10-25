<script setup lang="ts">
import AjudaAtalhos from '@/components/layout/AjudaAtalhos.vue'
import AppShell from '@/components/layout/AppShell.vue'
import UiToaster from '@/components/ui/UiToaster.vue'
</script>

<template>
  <AppShell>
    <RouterView />
  </AppShell>
  <UiToaster />
  <AjudaAtalhos />
</template>
