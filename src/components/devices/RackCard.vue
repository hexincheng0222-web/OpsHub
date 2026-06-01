<!-- src/components/devices/RackCard.vue -->
<script setup lang="ts">
import type { Rack, Device } from '../../mock/devices'
import type { SlotInfo } from '../../utils/rack-utils'
import RackHeader from './RackHeader.vue'
import RackStats from './RackStats.vue'
import RackGrid from './RackGrid.vue'

defineProps<{ rack: Rack }>()

defineEmits<{
  editRack: [rack: Rack]
  deleteRack: [rackId: string]
  slotClick: [rack: Rack, index: number, slot: SlotInfo]
  dragStart: [e: MouseEvent, device: Device, rackId: string]
}>()
</script>

<template>
  <div class="rack-card">
    <RackHeader :name="rack.name" :floor="rack.floor" @edit="$emit('editRack', rack)" @delete="$emit('deleteRack', rack.id)" />
    <RackStats :rack="rack" />
    <div class="rack-body">
      <RackGrid :rack="rack" @slot-click="(r, i, s) => $emit('slotClick', r, i, s)" @drag-start="(e, dev) => $emit('dragStart', e, dev, rack.id)" />
    </div>
    <div class="rack-base"><div class="rack-foot" /><div class="rack-foot" /></div>
  </div>
</template>

<style scoped>
.rack-card {
  width: 340px;
  background: linear-gradient(180deg, #141924 0%, #0f131a 100%);
  border: 1px solid #2a3040;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 0 0 1px rgba(0,0,0,0.5), 0 20px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.03);
  position: relative;
  padding: 0;
}
.rack-card::before, .rack-card::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  width: 3px;
  background: linear-gradient(180deg, #2a3040 0%, #1a1f2e 50%, #2a3040 100%);
  z-index: 1;
}
.rack-card::before { left: -1px; border-radius: 8px 0 0 8px; }
.rack-card::after { right: -1px; border-radius: 0 8px 8px 0; }
.rack-body { padding: 0; }
.rack-base {
  height: 24px;
  background: linear-gradient(0deg, #0d1017 0%, #141924 100%);
  border-top: 1px solid #2a3040;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 120px;
}
.rack-foot {
  width: 36px;
  height: 4px;
  background: #0a0d12;
  border-radius: 2px;
  box-shadow: 0 1px 0 rgba(255,255,255,0.04);
}
</style>
