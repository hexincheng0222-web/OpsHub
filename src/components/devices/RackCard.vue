<!-- src/components/devices/RackCard.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import type { Rack, Device } from '../../mock/devices'
import type { SlotInfo } from '../../utils/rack-utils'
import RackHeader from './RackHeader.vue'
import RackStats from './RackStats.vue'
import RackGrid from './RackGrid.vue'

const props = defineProps<{ rack: Rack }>()

defineEmits<{
  editRack: [rack: Rack]
  deleteRack: [rackId: string]
  slotClick: [rack: Rack, index: number, slot: SlotInfo]
  dragStart: [e: MouseEvent, device: Device, rackId: string]
}>()

const ventCount = computed(() => Math.max(4, Math.floor(props.rack.totalU / 4)))
</script>

<template>
  <div class="rack-card">
    <RackHeader :name="rack.name" :floor="rack.floor" @edit="$emit('editRack', rack)" @delete="$emit('deleteRack', rack.id)" />
    <RackStats :rack="rack" />
    <div class="rack-body">
      <div class="rack-top-panel">
        <div class="rtp-vent" v-for="i in ventCount" :key="i" />
      </div>
      <RackGrid :rack="rack" @slot-click="(r, i, s) => $emit('slotClick', r, i, s)" @drag-start="(e, dev) => $emit('dragStart', e, dev, rack.id)" />
    </div>
    <div class="rack-bottom">
      <div class="rack-foot" />
      <div class="rack-foot" />
    </div>
  </div>
</template>

<style scoped>
.rack-card {
  width: 360px;
  background: #0e131c;
  border: 2px solid #1e2736;
  border-radius: 6px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0,0,0,0.5);
}
.rack-body { padding: 0; }
.rack-top-panel {
  height: 14px; background: #151d2a;
  border-bottom: 1px solid #1e2736;
  display: flex; align-items: center; justify-content: center; gap: 6px;
}
.rtp-vent { width: 30px; height: 2px; background: #0a0e14; border-radius: 1px; }
.rack-bottom {
  height: 14px; background: #0c1016;
  border-top: 1px solid #1e2736;
  display: flex; align-items: center; justify-content: center; gap: 140px;
}
.rack-foot { width: 36px; height: 3px; background: #080a0f; border-radius: 2px; }
</style>
