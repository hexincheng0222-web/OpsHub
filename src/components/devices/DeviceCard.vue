<!-- src/components/devices/DeviceCard.vue -->
<script setup lang="ts">
import type { Device } from '../../mock/devices'
import { DEVICE_TYPE_COLORS } from '../../utils/rack-utils'

const props = defineProps<{
  device: Device
  uLabel: string
}>()

defineEmits<{
  click: []
  dragStart: [e: MouseEvent]
}>()

const borderColor = DEVICE_TYPE_COLORS[props.device.type] || '#94a3b8'
const isActive = props.device.status === '正常'
</script>

<template>
  <div
    class="device-card"
    :class="{ 'is-offline': !isActive }"
    :style="{ borderLeftColor: borderColor }"
    @click="$emit('click')"
    @mousedown.stop="$emit('dragStart', $event)"
  >
    <div class="dc-top">
      <span class="dc-led" :class="{ active: isActive }" :style="{ background: isActive ? '#4ade80' : '#ef4444' }" />
      <span class="dc-name">{{ device.name }}</span>
      <span v-if="!isActive" class="dc-offline-tag">停用</span>
      <span class="dc-u-badge">{{ uLabel }}</span>
    </div>
    <div class="dc-bottom">
      {{ device.model }}<template v-if="device.ip"> · {{ device.ip }}</template>
    </div>
  </div>
</template>

<style scoped>
.device-card {
  width: 100%;
  padding: 4px 8px;
  border-radius: 4px;
  background: linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02));
  border-left: 3px solid;
  cursor: grab;
  user-select: none;
}
.device-card.is-offline { opacity: 0.6; }
.device-card.is-offline .dc-name { text-decoration: line-through; }
.dc-top { display: flex; align-items: center; gap: 4px; }
.dc-led { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.dc-led.active { box-shadow: 0 0 4px #4ade80; }
.dc-name { color: #fff; font-size: 12px; font-weight: 600; }
.dc-offline-tag { color: #ef4444; font-size: 9px; margin-left: 2px; }
.dc-u-badge { color: #666; font-size: 10px; margin-left: auto; }
.dc-bottom { color: #888; font-size: 10px; margin-top: 2px; }
</style>
