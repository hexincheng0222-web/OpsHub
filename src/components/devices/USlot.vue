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

const uNumber = props.slot.uOffset + 1
</script>

<template>
  <div
    class="u-slot"
    :class="[slot.type, slot.device ? 'device-' + slot.device.type : '']"
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
      <span class="u-number">{{ uNumber }}</span>
      <span class="empty-plus">+</span>
    </template>
  </div>
</template>

<style scoped>
.u-slot {
  min-height: 0;
  background: #0c0f16;
  border: 1px solid #181d28;
  border-radius: 2px;
  position: relative;
  transition: all 0.3s ease;
  cursor: pointer;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  padding: 0 4px;
}
.u-slot.empty {
  background: repeating-linear-gradient(90deg, #0c0f16 0px, #0c0f16 8px, #0a0d12 8px, #0a0d12 9px);
}
.u-slot.empty:hover {
  background: repeating-linear-gradient(90deg, #10141c 0px, #10141c 8px, #0e1218 8px, #0e1218 9px);
  border-color: #3a4458;
}
.u-slot.empty:hover .empty-plus { opacity: 1; }
.u-number { color: #3a4458; font-size: 9px; width: 20px; text-align: center; font-weight: 600; }
.empty-plus { color: #4a5568; font-size: 12px; opacity: 0; transition: opacity 0.2s; }
.u-slot.device {
  border: none;
  border-radius: 3px;
  overflow: hidden;
}
.u-slot.device:hover { filter: brightness(1.2); z-index: 1; box-shadow: 0 0 12px rgba(74,240,192,0.3); }
</style>
