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
    <!-- 设备卡 -->
    <template v-if="slot.type === 'device' && slot.device">
      <DeviceCard
        :device="slot.device"
        :u-label="getUBadgeLabel(slot)"
        @click="emit('click', slot)"
        @drag-start="(e) => emit('dragStart', e, slot.device!)"
      />
    </template>
    <!-- 空位 -->
    <template v-else-if="slot.type === 'empty'">
      <span class="empty-plus">+</span>
    </template>
  </div>
</template>

<style scoped>
.u-slot {
  min-height: 0;
  background: #0d1118;
  border: 1px solid #1a1f2a;
  border-radius: 2px;
  position: relative;
  transition: all 0.2s ease;
  cursor: pointer;
  box-sizing: border-box;
  display: flex;
  align-items: stretch;
  padding: 0;
}
/* 空位 - 细腻圆点纹理 */
.u-slot.empty {
  background-color: #0d1118;
  background-image: radial-gradient(circle, #1e2533 0.6px, transparent 0.6px);
  background-size: 4px 4px;
  background-position: 2px 2px;
}
.u-slot.empty:hover {
  background-color: #141c28;
  background-image: radial-gradient(circle, #2a3a50 0.6px, transparent 0.6px);
  border-color: #3a4a60;
  box-shadow: inset 0 0 12px rgba(88,166,255,0.08);
}
.u-slot.empty:hover .empty-plus { opacity: 1; }

.empty-plus {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  color: #4a5a6a;
  opacity: 0;
  transition: opacity 0.15s;
  z-index: 1;
}

/* 设备槽 */
.u-slot.device {
  border: none;
  border-radius: 3px;
  overflow: visible;
}
</style>
