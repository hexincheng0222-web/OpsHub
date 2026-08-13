<template>
  <div class="side-panel" :class="{ collapsed }">
    <div class="panel-collapse-btn" :title="collapsed ? '展开设备库' : '收起设备库'" @click="toggleCollapsed">
      <el-icon><DArrowRight v-if="collapsed" /><DArrowLeft v-else /></el-icon>
    </div>
    <el-tabs v-if="!collapsed" v-model="activeTab" class="side-tabs">
      <el-tab-pane label="设备库" name="devices">
        <div class="panel-tip">将设备添加到画布</div>
        <div v-if="store.availableDevices.length === 0" class="empty-tip">所有设备都已在画布上</div>
        <div v-for="dev in store.availableDevices" :key="dev.id" class="device-row">
          <div class="device-info">
            <span class="device-name">{{ dev.name }}</span>
            <span class="device-ip">{{ dev.ip || '—' }}</span>
          </div>
          <el-button size="small" type="primary" text @click="handleAdd(dev.id)">添加</el-button>
        </div>
      </el-tab-pane>

      <el-tab-pane label="连线" name="edges">
        <div class="panel-tip">已建立的连接关系</div>
        <div v-if="store.edges.length === 0" class="empty-tip">暂无连线，点击画布上两个节点建立连接</div>
        <div v-for="edge in store.edges" :key="edge.id" class="edge-row">
          <div class="edge-info">
            <span class="edge-text">{{ edge.source_device_name }}[{{ edge.source_port }}]</span>
            <span class="edge-mid">↔</span>
            <span class="edge-text">{{ edge.target_device_name }}[{{ edge.target_port }}]</span>
          </div>
          <el-button size="small" type="danger" text @click="handleRemoveEdge(edge.id)">删除</el-button>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { DArrowLeft, DArrowRight } from '@element-plus/icons-vue'
import { ElMessageBox, ElMessage } from 'element-plus'
import { useTopologyStore } from '../../stores/topology'

const store = useTopologyStore()
const activeTab = ref('devices')
const collapsed = ref(false)

function toggleCollapsed() { collapsed.value = !collapsed.value }

async function handleAdd(deviceId: number) {
  try {
    await store.addNode(deviceId)
    ElMessage.success('已添加到画布')
  } catch { /* store 已提示 */ }
}

async function handleRemoveEdge(id: number) {
  try {
    await ElMessageBox.confirm('确定删除这条连线？', '确认删除', { type: 'warning' })
    await store.removeEdge(id)
    ElMessage.success('连线已删除')
  } catch (e: any) {
    if (e !== 'cancel') ElMessage.error(e.message || '删除失败')
  }
}
</script>

<style scoped>
.side-panel { position: relative; width: 280px; flex-shrink: 0; border: 1px solid var(--dv-header-border); border-radius: 10px; background: var(--dv-comp-card-bg); padding: 12px; transition: width 0.2s ease; }
.side-panel.collapsed { width: 38px; padding: 12px 0; cursor: pointer; }
.panel-collapse-btn { position: absolute; top: 8px; right: 8px; z-index: 1; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border-radius: 6px; color: var(--dv-light-dim); cursor: pointer; transition: background 0.15s, color 0.15s; }
.panel-collapse-btn:hover { background: var(--dv-bar-track); color: var(--dv-light-text); }
.side-panel.collapsed .panel-collapse-btn { right: 7px; top: 10px; }

.side-tabs :deep(.el-tabs__header) { margin-bottom: 12px; }
.side-tabs :deep(.el-tabs__nav-wrap) { margin-right: 26px; }
.panel-tip { font-size: 11px; color: var(--dv-light-dim); margin-bottom: 10px; }
.empty-tip { font-size: 12px; color: var(--dv-light-dim); padding: 16px 0; text-align: center; }
.device-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 4px; border-bottom: 1px solid var(--dv-header-border); }
.device-info { display: flex; flex-direction: column; min-width: 0; }
.device-name { font-size: 12px; color: var(--dv-light-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.device-ip { font-size: 11px; color: var(--dv-light-dim); font-family: monospace; }
.edge-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 4px; border-bottom: 1px solid var(--dv-header-border); gap: 8px; }
.edge-info { display: flex; align-items: center; gap: 4px; min-width: 0; flex: 1; }
.edge-text { font-size: 11px; color: var(--dv-light-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.edge-mid { font-size: 11px; color: var(--dv-light-dim); flex-shrink: 0; }
</style>
