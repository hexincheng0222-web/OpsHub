<!-- src/components/devices/DeviceCard.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import type { Device } from '../../mock/devices'

const props = defineProps<{
  device: Device
  uLabel: string
}>()

defineEmits<{
  click: []
  dragStart: [e: MouseEvent]
}>()

const isActive = computed(() => props.device.status === '正常')

const typeColor = computed(() => {
  const map: Record<string, string> = {
    server: '#2a6aaa', switch: '#2a7e5e', storage: '#5a42a2',
    router: '#8a623c', firewall: '#9a3a3a', ups: '#6a6a2e', pdu: '#3a3a60',
  }
  return map[props.device.type] || '#2a6aaa'
})

const typeAbbr = computed(() => {
  const map: Record<string, string> = {
    server: 'SV', switch: 'SW', storage: 'ST',
    router: 'RT', firewall: 'FW', ups: 'UP', pdu: 'PD',
  }
  return map[props.device.type] || '??'
})
</script>

<template>
  <div
    class="dev-card"
    :class="{ offline: !isActive }"
    :style="{ '--tc': typeColor }"
    @click="$emit('click')"
    @mousedown.stop="$emit('dragStart', $event)"
  >
    <!-- 左侧：类型标签 + 双LED -->
    <div class="dev-left">
      <span class="dev-type">{{ typeAbbr }}</span>
      <div class="dev-leds">
        <span class="dev-led dev-led-power" :class="{ on: isActive }" title="电源" />
        <span class="dev-led dev-led-link" :class="{ on: isActive }" title="链路" />
      </div>
    </div>

    <!-- 中间：设备名 + 型号 + IP -->
    <div class="dev-mid">
      <span class="dev-name" :title="device.name">{{ device.name }}</span>
      <span class="dev-sub">
        <span class="dev-model">{{ device.model }}</span>
        <span v-if="device.ip" class="dev-ip">{{ device.ip }}</span>
      </span>
    </div>

    <!-- 右侧：U 位 -->
    <span class="dev-u">{{ uLabel }}</span>
  </div>
</template>

<style scoped>
.dev-card {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 1px 6px 1px 5px;
  border-radius: 2px;
  border: 1px solid rgba(255,255,255,0.06);
  border-left: 2px solid var(--tc);
  background: linear-gradient(90deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 30%, transparent 100%);
  cursor: grab;
  user-select: none;
  position: relative;
  overflow: hidden;
  transition: background 0.15s, box-shadow 0.15s;
}
.dev-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 1px;
  background: linear-gradient(90deg, rgba(255,255,255,0.1), transparent 60%);
  pointer-events: none;
}
.dev-card::after {
  content: '';
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 1px;
  background: linear-gradient(90deg, rgba(0,0,0,0.3), transparent 60%);
  pointer-events: none;
}
.dev-card:hover {
  background: linear-gradient(90deg, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0.03) 30%, transparent 100%);
  box-shadow: inset 0 0 12px rgba(255,255,255,0.04);
  border-color: rgba(255,255,255,0.12);
  border-left-color: var(--tc);
}
.dev-card.offline {
  opacity: 0.45;
  filter: grayscale(0.5);
}
.dev-card.offline:hover {
  opacity: 0.65;
  filter: grayscale(0.2);
}

/* 左侧区域 */
.dev-left {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

/* 类型缩写 */
.dev-type {
  font-size: 8px;
  font-weight: 800;
  color: var(--tc);
  background: rgba(0,0,0,0.35);
  padding: 1px 3px;
  border-radius: 2px;
  letter-spacing: 0.5px;
  line-height: 1;
  border: 1px solid rgba(255,255,255,0.06);
}

/* LED 灯组 */
.dev-leds {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex-shrink: 0;
}
.dev-led {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  flex-shrink: 0;
  background: #2a2a2a;
  box-shadow: inset 0 0 2px rgba(0,0,0,0.6);
  transition: background 0.3s, box-shadow 0.3s;
}
/* 电源灯：常亮呼吸 */
.dev-led-power.on {
  background: #4af0c0;
  box-shadow: 0 0 4px #4af0c0, 0 0 8px rgba(74,240,192,0.4);
  animation: led-breathe 2.5s ease-in-out infinite;
}
/* 链路灯：快速闪烁 */
.dev-led-link.on {
  background: #ffaa00;
  box-shadow: 0 0 4px #ffaa00, 0 0 8px rgba(255,170,0,0.4);
  animation: led-blink 0.6s ease-in-out infinite;
}

/* 中间区域 */
.dev-mid {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
  overflow: hidden;
}

/* 设备名 */
.dev-name {
  font-size: 10px;
  font-weight: 700;
  color: #edf2f8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
  text-shadow: 0 1px 1px rgba(0,0,0,0.4);
}

/* 副行：型号 + IP */
.dev-sub {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
}
.dev-model {
  font-size: 8px;
  color: rgba(255,255,255,0.45);
  font-family: 'SF Mono', 'Consolas', monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 1;
}
.dev-ip {
  font-size: 8px;
  color: rgba(74,240,192,0.7);
  font-family: 'SF Mono', 'Consolas', monospace;
  white-space: nowrap;
  flex-shrink: 0;
  background: rgba(0,0,0,0.25);
  padding: 0 3px;
  border-radius: 2px;
}

/* 右侧 U 位 */
.dev-u {
  font-size: 8px;
  color: rgba(255,255,255,0.5);
  font-family: 'SF Mono', 'Consolas', monospace;
  background: rgba(0,0,0,0.35);
  padding: 1px 5px;
  border-radius: 2px;
  flex-shrink: 0;
  white-space: nowrap;
  line-height: 1.2;
  border: 1px solid rgba(255,255,255,0.04);
}

@keyframes led-breathe {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
@keyframes led-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.15; }
}
</style>
