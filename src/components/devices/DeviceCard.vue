<!-- src/components/devices/DeviceCard.vue -->
<script setup lang="ts">
import type { Device } from '../../mock/devices'

const props = defineProps<{
  device: Device
  uLabel: string
}>()

defineEmits<{
  click: []
  dragStart: [e: MouseEvent]
}>()

const isActive = props.device.status === '正常'
</script>

<template>
  <div
    class="device-card"
    :class="['device-' + device.type, { 'is-offline': !isActive }]"
    @click="$emit('click')"
    @mousedown.stop="$emit('dragStart', $event)"
  >
    <div class="dc-inner">
      <span class="dc-led" :class="{ active: isActive }" />
      <span class="dc-name">{{ device.name }}</span>
      <span v-if="!isActive" class="dc-offline-tag">停用</span>
      <span class="dc-u-badge">{{ uLabel }}</span>
    </div>
  </div>
</template>

<style scoped>
.device-card {
  width: 100%;
  padding: 4px 8px;
  border-radius: 3px;
  cursor: grab;
  user-select: none;
  position: relative;
}
.device-card.is-offline { opacity: 0.5; filter: grayscale(0.5); }
.device-card:hover { filter: brightness(1.2); z-index: 1; box-shadow: 0 0 12px rgba(74,240,192,0.3); }

.dc-inner {
  display: flex;
  align-items: center;
  gap: 6px;
  position: relative;
  z-index: 1;
}
.dc-led {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  background: #2a3040;
}
.dc-led.active {
  background: #4af0c0;
  box-shadow: 0 0 6px rgba(74,240,192,0.6);
  animation: led-pulse 2s infinite;
}
.dc-name {
  color: #e6edf3;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.5px;
}
.dc-offline-tag {
  color: #ff6b6b;
  font-size: 8px;
  margin-left: 2px;
}
.dc-u-badge {
  color: #4a5568;
  font-size: 8px;
  margin-left: auto;
}

/* 设备类型样式 - 恢复旧版渐变 */
.device-server {
  background: linear-gradient(90deg, #1a3a5c 0%, #1e4470 50%, #1a3a5c 100%);
  border: 1px solid #2a5a8a;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 0 8px rgba(42,90,138,0.2);
}
.device-switch {
  background: linear-gradient(90deg, #1a4a3a 0%, #1e5a44 50%, #1a4a3a 100%);
  border: 1px solid #2a7a5a;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 0 8px rgba(42,122,90,0.2);
}
.device-storage {
  background: linear-gradient(90deg, #3a2a5c 0%, #443070 50%, #3a2a5c 100%);
  border: 1px solid #5a3a8a;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 0 8px rgba(90,58,138,0.2);
}
.device-router {
  background: linear-gradient(90deg, #5c3a1a 0%, #70441e 50%, #5c3a1a 100%);
  border: 1px solid #8a5a2a;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 0 8px rgba(138,90,42,0.2);
}
.device-firewall {
  background: linear-gradient(90deg, #5c1a1a 0%, #701e1e 50%, #5c1a1a 100%);
  border: 1px solid #8a2a2a;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 0 8px rgba(138,42,42,0.2);
}
.device-ups {
  background: linear-gradient(90deg, #3a3a1a 0%, #4a441e 50%, #3a3a1a 100%);
  border: 1px solid #6a6a2a;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 0 8px rgba(106,106,42,0.2);
}
.device-pdu {
  background: linear-gradient(90deg, #1a2a2a 0%, #1e3a3a 50%, #1a2a2a 100%);
  border: 1px solid #2a4a4a;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 0 8px rgba(42,74,74,0.2);
}

@keyframes led-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
</style>
