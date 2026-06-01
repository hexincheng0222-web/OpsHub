<!-- src/components/devices/RackGrid.vue -->
<script setup lang="ts">
import type { Rack, Device } from '../../mock/devices'
import { buildSlotData } from '../../utils/rack-utils'
import type { SlotInfo } from '../../utils/rack-utils'
import USlot from './USlot.vue'
import { computed } from 'vue'

const props = defineProps<{ rack: Rack }>()

const emit = defineEmits<{
  slotClick: [rack: Rack, index: number, slot: SlotInfo]
  dragStart: [e: MouseEvent, device: Device, rackId: string]
}>()

const slots = computed(() => buildSlotData(props.rack))
const rowHeight = 22
const gridStyle = computed(() => ({
  gridTemplateRows: 'repeat(' + props.rack.totalU + ', ' + rowHeight + 'px)',
}))
</script>

<template>
  <div class="rack-grid" :style="gridStyle">
    <div class="ugrid-labels">
      <div v-for="i in rack.totalU" :key="i" class="u-label">{{ rack.totalU - i + 1 }}</div>
    </div>
    <div class="ugrid-slots">
      <USlot
        v-for="(slot, index) in slots"
        :key="index"
        :slot="slot"
        :rack-id="rack.id"
        :style="slot.type === 'device' && slot.uSize ? { gridRow: 'span ' + slot.uSize } : {}"
        @click="(s) => emit('slotClick', rack, index, s)"
        @drag-start="(e, dev) => emit('dragStart', e, dev, rack.id)"
      />
    </div>
  </div>
</template>

<style scoped>
.rack-grid { display: grid; grid-template-columns: 28px 1fr; background: #0a0e14; }
.ugrid-labels { grid-column: 1; grid-row: 1 / -1; display: grid; grid-template-rows: subgrid; border-right: 1px solid #1a2230; }
.u-label {
  display: flex; align-items: center; justify-content: center;
  font-size: 8px; color: #3a4a5a; font-weight: 700;
  font-family: 'SF Mono', 'Consolas', monospace;
  background: #0d1118; border-bottom: 1px solid #141c28;
  box-sizing: border-box;
}
.ugrid-slots { grid-column: 2; grid-row: 1 / -1; display: grid; grid-template-rows: subgrid; padding: 2px 4px; background: #0a0e14; }
</style>
