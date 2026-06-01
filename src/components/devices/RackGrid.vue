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
const rowHeight = 20
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
      <template v-for="(slot, index) in slots" :key="rack.id + '-' + index">
        <USlot
          v-if="!slot.hidden"
          :slot="slot"
          :rack-id="rack.id"
          :style="slot.type === 'device' && slot.uSize ? { gridRow: 'span ' + slot.uSize } : {}"
          @click="(s) => emit('slotClick', rack, index, s)"
          @drag-start="(e, dev) => emit('dragStart', e, dev, rack.id)"
        />
      </template>
    </div>
  </div>
</template>

<style scoped>
.rack-grid { display: grid; grid-template-columns: 32px 1fr; }
.ugrid-labels { grid-column: 1; grid-row: 1 / -1; display: grid; grid-template-rows: subgrid; }
.u-label {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  color: #3a4458;
  font-weight: 600;
  border-bottom: 1px solid #141924;
  box-sizing: border-box;
}
.ugrid-slots { grid-column: 2; grid-row: 1 / -1; display: grid; grid-template-rows: subgrid; padding: 3px; }
</style>
