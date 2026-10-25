<script setup lang="ts">
import { Switch, SwitchGroup, SwitchLabel, SwitchDescription } from '@headlessui/vue'

const model = defineModel<boolean>({ default: false })
defineProps<{ label?: string; description?: string; disabled?: boolean }>()
</script>

<template>
  <SwitchGroup as="div" class="ex-switch-group">
    <Switch v-model="model" :disabled="disabled" class="ex-switch">
      <span class="ex-switch__thumb" aria-hidden="true" />
    </Switch>
    <span v-if="label || description" class="ex-switch__text">
      <SwitchLabel v-if="label" class="ex-switch__label">{{ label }}</SwitchLabel>
      <SwitchDescription v-if="description" class="ex-switch__desc">{{ description }}</SwitchDescription>
    </span>
  </SwitchGroup>
</template>
