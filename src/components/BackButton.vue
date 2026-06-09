<template>
  <button class="back-btn" @click="router.push(to)">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
    <span>{{ label }}</span>
  </button>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

const props = withDefaults(defineProps<{
  to?: string
  label?: string
}>(), {
  to: '/',
  label: '返回',
})

const router = useRouter()
</script>

<style scoped>
.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 14px 6px 10px;
  background: var(--ops-bg-card-hover);
  border: 1px solid var(--ops-border-card);
  border-radius: 20px;
  color: var(--ops-text-secondary);
  cursor: pointer;
  font-size: 12px;
  font-family: inherit;
  transition: all 0.2s ease;
}
.back-btn svg { transition: transform 0.2s ease; }
.back-btn:hover { color: var(--ops-accent-blue); border-color: rgba(88,166,255,0.3); }
.back-btn:hover svg { transform: translateX(-2px); }
</style>
