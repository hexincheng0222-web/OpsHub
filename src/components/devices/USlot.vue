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
  display: flex;
  align-items: center;
  padding: 0 4px;
  border-bottom: 1px dashed rgba(255,255,255,0.06);
  min-height: 20px;
  position: relative;
}
.u-slot.empty { cursor: pointer; }
.u-slot.empty:hover { background: rgba(255,255,255,0.03); }
.u-slot.empty:hover .empty-plus { opacity: 1; }
.u-number { color: #444; font-size: 9px; width: 20px; text-align: center; }
.empty-plus { color: #555; font-size: 14px; opacity: 0; transition: opacity 0.15s; }
.u-slot.device-server, .u-slot.device-switch, .u-slot.device-storage,
.u-slot.device-router, .u-slot.device-firewall, .u-slot.device-ups, .u-slot.device-pdu {
  border-bottom: 1px solid rgba(255,255,255,0.08);
  padding: 2px 4px;
}
</style>
