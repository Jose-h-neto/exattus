<script setup lang="ts">
import { Dialog, DialogPanel, DialogTitle, DialogDescription } from '@headlessui/vue'
import ExIcon from './ExIcon.vue'
import type { IconName } from './icons'

const open = defineModel<boolean>('open', { default: false })
withDefaults(
  defineProps<{ title: string; description?: string; icon?: IconName; tone?: 'primary' | 'danger' }>(),
  { tone: 'primary' },
)
</script>

<template>
  <Dialog :open="open" class="ex-modal" @close="open = false">
    <div class="ex-modal__scrim" aria-hidden="true" />
    <DialogPanel class="ex-modal__panel">
      <div v-if="icon" :class="['ex-modal__icon', { 'ex-modal__icon--danger': tone === 'danger' }]">
        <ExIcon :name="icon" />
      </div>
      <DialogTitle as="h2" class="ex-modal__title">{{ title }}</DialogTitle>
      <DialogDescription v-if="description" class="ex-modal__body">{{ description }}</DialogDescription>
      <slot />
      <div v-if="$slots.actions" class="ex-modal__actions"><slot name="actions" /></div>
    </DialogPanel>
  </Dialog>
</template>
