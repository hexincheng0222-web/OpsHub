<!-- src/components/devices/USlot.vue -->
<script setup lang="ts">
import type { SlotInfo } from '../../utils/rack-utils'
import type { Device } from '../../mock/devices'
import { getUBadgeLabel } from '../../utils/rack-utils'
import DeviceCard from './DeviceCard.vue'

const props = defineProps<{
  slot: SlotInfo
  rackId: string
}>()

const emit = defineEmits<{
  click: [slot: SlotInfo]
  dragStart: [e: MouseEvent, device: Device]
}>()
</script>

<template>
  <div
    class="u-slot"
    :class="[slot.type, slot.device ? 'dtype-' + slot.device.type : '']"
    :data-rack-id="rackId"
    :data-u-offset="slot.uOffset"
    @click="emit('click', slot)"
  >
    <template v-if="slot.type === 'device' && slot.device">
      <DeviceCard
        :device="slot.device"
        :u-label="getUBadgeLabel(slot)"
        @click="emit('click', slot)"
        @drag-start="(e) => emit('dragStart', e, slot.device!)"
      />
    </template>
    <template v-else-if="slot.type === 'empty'">
      <span class="empty-plus">+</span>
    </template>
  </div>
</template>

<style scoped>
.u-slot {
  min-height: 0;
  background: var(--dv-comp-label-bg);
  border: 1px solid var(--dv-comp-grid-border);
  border-radius: 2px;
  position: relative;
  transition: all 0.2s ease;
  cursor: pointer;
  box-sizing: border-box;
  display: flex;
  align-items: stretch;
  padding: 0;
}
.u-slot.empty {
  background-color: var(--dv-comp-label-bg);
  background-image: radial-gradient(circle, var(--dv-comp-label-text) 0.5px, transparent 0.5px);
  background-size: 4px 4px;
  background-position: 2px 2px;
}
.u-slot.empty:hover {
  background-color: var(--dv-comp-header-bg);
  border-color: var(--dv-accent-blue);
  box-shadow: inset 0 0 12px rgba(88,166,255,0.08);
}
.u-slot.empty:hover .empty-plus { opacity: 1; }
.empty-plus {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 700;
  color: var(--dv-comp-label-text);
  opacity: 0; transition: opacity 0.15s; z-index: 1;
}
.u-slot.device { border: none; border-radius: 3px; overflow: visible; }
</style>
