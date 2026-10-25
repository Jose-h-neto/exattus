<script setup lang="ts" generic="T extends string | number">
import { computed } from 'vue'
import { Listbox, ListboxButton, ListboxLabel, ListboxOptions, ListboxOption } from '@headlessui/vue'
import ExIcon from './ExIcon.vue'
import type { SelectOption } from './types'

const model = defineModel<T | null>({ default: null })
const props = defineProps<{
  label?: string
  options: SelectOption<T>[]
  placeholder?: string
  hint?: string
  error?: string
  disabled?: boolean
}>()

const selected = computed(() => props.options.find((o) => o.value === model.value))
</script>

<template>
  <Listbox v-model="model" :disabled="disabled" as="div" class="ex-field">
    <ListboxLabel v-if="label" class="ex-label">{{ label }}</ListboxLabel>
    <div class="ex-listbox">
      <ListboxButton
        :class="['ex-control', 'ex-listbox__button', { 'ex-control--error': error, 'ex-control--disabled': disabled }]"
      >
        <span v-if="selected" class="ex-listbox__value">{{ selected.label }}</span>
        <span v-else class="ex-listbox__value ex-listbox__placeholder">{{ placeholder ?? 'Selecione' }}</span>
        <ExIcon name="chevron-down" :size="18" class="ex-listbox__chev" />
      </ListboxButton>
      <ListboxOptions class="ex-popover">
        <ListboxOption
          v-for="option in options"
          :key="String(option.value)"
          v-slot="{ active, selected: isSelected }"
          :value="option.value"
          :disabled="option.disabled"
          as="template"
        >
          <li :class="['ex-option', { 'is-active': active, 'is-selected': isSelected, 'is-disabled': option.disabled }]">
            {{ option.label }}
            <ExIcon v-if="isSelected" name="check" :size="16" class="ex-option__check" />
          </li>
        </ListboxOption>
      </ListboxOptions>
    </div>
    <p v-if="error" class="ex-error"><ExIcon name="alert" :size="14" />{{ error }}</p>
    <p v-else-if="hint" class="ex-hint">{{ hint }}</p>
  </Listbox>
</template>
