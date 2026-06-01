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
.rack-card { background: var(--dv-card-bg, rgba(255,255,255,0.03)); border: 1px solid var(--dv-border, rgba(255,255,255,0.08)); border-radius: 8px; padding: 12px; width: 340px; }
.rack-body { margin-top: 8px; }
.rack-base { display: flex; justify-content: space-between; padding: 6px 12px 0; }
.rack-foot { width: 40px; height: 6px; background: rgba(255,255,255,0.08); border-radius: 0 0 3px 3px; }
</style>
