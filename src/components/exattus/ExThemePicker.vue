<script setup lang="ts">
import { RadioGroup, RadioGroupLabel, RadioGroupOption } from '@headlessui/vue'
import ExIcon from './ExIcon.vue'
import { palettes, type PaletteId } from './palettes'

const model = defineModel<PaletteId>({ required: true })

/** compact: bolinhas de cor numa linha (painel de Aparencia); sem compact: cartoes com miniatura. */
withDefaults(defineProps<{ label?: string; compact?: boolean }>(), { label: 'Tema' })
</script>

<template>
  <RadioGroup v-model="model">
    <RadioGroupLabel class="ex-sr">{{ label }}</RadioGroupLabel>

    <div v-if="compact" class="ex-swatches">
      <RadioGroupOption v-for="p in palettes" :key="p.id" v-slot="{ checked }" :value="p.id" as="template">
        <div :class="['ex-swatch', `ex-palette--${p.id}`, { 'ex-swatch--livre': p.id === 'personalizada' }]" :title="p.label">
          <RadioGroupLabel as="span" class="ex-sr">{{ p.label }}</RadioGroupLabel>
          <ExIcon v-if="checked" name="check" :size="14" :stroke-width="3" class="ex-swatch__check" />
        </div>
      </RadioGroupOption>
    </div>

    <div v-else class="ex-palettes">
      <RadioGroupOption v-for="p in palettes" :key="p.id" v-slot="{ checked }" :value="p.id" as="template">
        <div :class="['ex-palette', `ex-palette--${p.id}`]">
          <span class="ex-palette__mock" aria-hidden="true">
            <span class="ex-palette__nav"><span /><span /><span /></span>
            <span class="ex-palette__body">
              <span class="ex-palette__bars"><i style="height: 45%" /><i style="height: 70%" /><i style="height: 55%" /><i style="height: 90%" /></span>
              <span class="ex-palette__btn" />
            </span>
          </span>
          <span class="ex-palette__foot">
            <RadioGroupLabel as="span" class="ex-palette__name">{{ p.label }}</RadioGroupLabel>
            <span v-if="'isDefault' in p" class="ex-palette__tag">Padrão</span>
            <span class="ex-palette__check"><ExIcon v-if="checked" name="check" :size="12" :stroke-width="3" /></span>
          </span>
        </div>
      </RadioGroupOption>
    </div>
  </RadioGroup>
</template>
