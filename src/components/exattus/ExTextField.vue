<script setup lang="ts">
import { computed, useId } from 'vue'
import ExIcon from './ExIcon.vue'
import type { IconName } from './icons'

defineOptions({ inheritAttrs: false })
const model = defineModel<string>()
const props = defineProps<{
  label?: string
  hint?: string
  error?: string
  /** fixed text before the value, e.g. "R$" */
  prefix?: string
  icon?: IconName
  optional?: boolean
  /** JetBrains Mono for CPF, PIS, matrícula */
  mono?: boolean
  disabled?: boolean
  id?: string
}>()

const autoId = useId()
const inputId = computed(() => props.id ?? autoId)
const describedBy = computed(() =>
  props.error ? `${inputId.value}-err` : props.hint ? `${inputId.value}-hint` : undefined,
)
</script>

<template>
  <div class="ex-field">
    <label v-if="label" class="ex-label" :for="inputId">
      {{ label }}<span v-if="optional" class="ex-label__opt">(opcional)</span>
    </label>
    <div :class="['ex-control', { 'ex-control--error': error, 'ex-control--disabled': disabled }]">
      <span v-if="icon" class="ex-control__icon"><ExIcon :name="icon" :size="18" /></span>
      <span v-if="prefix" class="ex-control__prefix">{{ prefix }}</span>
      <input
        v-bind="$attrs"
        :id="inputId"
        v-model="model"
        :disabled="disabled"
        :class="['ex-input', { 'ex-input--mono': mono }]"
        :aria-invalid="error ? 'true' : undefined"
        :aria-describedby="describedBy"
      />
    </div>
    <p v-if="error" :id="`${inputId}-err`" class="ex-error"><ExIcon name="alert" :size="14" />{{ error }}</p>
    <p v-else-if="hint" :id="`${inputId}-hint`" class="ex-hint">{{ hint }}</p>
  </div>
</template>
