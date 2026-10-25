<script setup lang="ts">
import { TabGroup, TabList, Tab, TabPanels, TabPanel } from '@headlessui/vue'
import type { TabItem } from './types'

withDefaults(defineProps<{ items: TabItem[]; variant?: 'segmented' | 'line'; label?: string }>(), {
  variant: 'segmented',
})
const selectedIndex = defineModel<number>({ default: 0 })
</script>

<template>
  <TabGroup :selected-index="selectedIndex" @change="selectedIndex = $event">
    <TabList :class="['ex-tabs', { 'ex-tabs--line': variant === 'line' }]" :aria-label="label">
      <Tab v-for="tab in items" :key="tab.id" class="ex-tab">
        {{ tab.label }}<span v-if="tab.count != null" class="ex-tab__count">{{ tab.count }}</span>
      </Tab>
    </TabList>
    <!-- one named slot per tab id; omit them to use the tabs as a filter only -->
    <TabPanels v-if="items.some((t) => $slots[t.id])">
      <TabPanel v-for="tab in items" :key="tab.id"><slot :name="tab.id" /></TabPanel>
    </TabPanels>
  </TabGroup>
</template>
