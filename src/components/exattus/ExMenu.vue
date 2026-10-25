<script setup lang="ts">
import { Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/vue'
import ExIcon from './ExIcon.vue'
import type { MenuAction } from './types'

defineProps<{ items: MenuAction[]; label?: string }>()
const emit = defineEmits<{ select: [id: string] }>()
</script>

<template>
  <Menu as="div" class="ex-menu">
    <MenuButton class="ex-btn ex-btn--ghost ex-btn--sm ex-btn--icon" :aria-label="label ?? 'Mais ações'">
      <ExIcon name="more" :size="18" />
    </MenuButton>
    <MenuItems class="ex-popover">
      <template v-for="item in items" :key="item.id">
        <div v-if="item.separatorBefore" class="ex-menu__sep" role="none" />
        <MenuItem v-slot="{ active }">
          <button
            type="button"
            :class="['ex-menu__item', { 'is-active': active, 'ex-menu__item--danger': item.danger }]"
            @click="emit('select', item.id)"
          >
            <ExIcon v-if="item.icon" :name="item.icon" :size="18" />
            {{ item.label }}
          </button>
        </MenuItem>
      </template>
    </MenuItems>
  </Menu>
</template>
