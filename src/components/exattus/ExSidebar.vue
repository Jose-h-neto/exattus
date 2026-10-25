<script setup lang="ts">
import { RouterLink } from 'vue-router'
import ExIcon from './ExIcon.vue'
import type { NavItem } from './types'

withDefaults(defineProps<{ items: NavItem[]; brand?: string }>(), { brand: 'Exattus' })
/** id of the current item when not using routes */
const active = defineModel<string>('active')
</script>

<template>
  <nav class="ex-sidebar" aria-label="Navegação principal">
    <div class="ex-sidebar__brand">{{ brand }}</div>
    <template v-for="(item, i) in items" :key="item.id ?? `s${i}`">
      <div v-if="item.section" class="ex-sidebar__section">{{ item.section }}</div>
      <RouterLink v-else-if="item.to" v-slot="{ href, navigate, isActive }" :to="item.to" custom>
        <a :href="href" class="ex-nav-item" :aria-current="isActive ? 'page' : undefined" @click="navigate">
          <ExIcon v-if="item.icon" :name="item.icon" />
          <span class="ex-nav-item__label">{{ item.label }}</span>
          <span v-if="item.badge != null" class="ex-nav-item__badge">{{ item.badge }}</span>
        </a>
      </RouterLink>
      <button
        v-else
        type="button"
        class="ex-nav-item"
        :aria-current="active === item.id ? 'page' : undefined"
        @click="active = item.id"
      >
        <ExIcon v-if="item.icon" :name="item.icon" />
        <span class="ex-nav-item__label">{{ item.label }}</span>
        <span v-if="item.badge != null" class="ex-nav-item__badge">{{ item.badge }}</span>
      </button>
    </template>
    <div v-if="$slots.footer" class="ex-sidebar__footer"><slot name="footer" /></div>
  </nav>
</template>
