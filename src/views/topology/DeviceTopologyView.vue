<template>
  <div class="topology-page">
    <div class="page-header">
      <BackButton to="/devices" />
      <h1 class="page-title">网络拓扑</h1>
      <div class="header-actions">
        <el-button size="small" :loading="store.loading" @click="store.load()">刷新</el-button>
        <el-button size="small" type="primary" @click="handleAutoLayout">自动布局</el-button>
        <el-tag v-if="store.selectedDeviceId != null" size="small" closable @close="store.selectedDeviceId = null">
          已选中：{{ store.nodeMap.get(store.selectedDeviceId)?.name }}
        </el-tag>
        <el-button
          v-if="store.selectedDeviceId != null"
          size="small"
          type="danger"
          plain
          @click="handleRemoveSelected"
        >移除节点</el-button>
      </div>
    </div>

    <div class="page-body">
      <TopologySidePanel />
      <div class="canvas-area">
        <div class="zoom-toolbar">
          <el-tooltip content="缩小" placement="top"><el-button size="small" :icon="ZoomOut" circle @click="canvasRef?.zoomOut()" /></el-tooltip>
          <el-button size="small" class="zoom-pct-btn" @click="canvasRef?.zoomReset()">{{ canvasRef?.zoomPct ?? 100 }}%</el-button>
          <el-tooltip content="放大" placement="top"><el-button size="small" :icon="ZoomIn" circle @click="canvasRef?.zoomIn()" /></el-tooltip>
          <span class="zoom-divider" />
          <el-button size="small" :icon="Aim" circle :title="'重置视图'" @click="canvasRef?.zoomReset()" />
        </div>
        <TopologyCanvas ref="canvasRef" />
      </div>
    </div>

    <PortSelectDialog />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ZoomIn, ZoomOut, Aim } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useTopologyStore } from '../../stores/topology'
import BackButton from '../../components/BackButton.vue'
import TopologyCanvas from '../../components/topology/TopologyCanvas.vue'
import TopologySidePanel from '../../components/topology/TopologySidePanel.vue'
import PortSelectDialog from '../../components/topology/PortSelectDialog.vue'

const store = useTopologyStore()
const canvasRef = ref<InstanceType<typeof TopologyCanvas> | null>(null)

onMounted(() => { store.load() })

async function handleAutoLayout() {
  await store.setAutoLayout()
  ElMessage.success('已按核心→接入自动布局')
}

async function handleRemoveSelected() {
  const id = store.selectedDeviceId
  if (id == null) return
  const edgeCount = store.edgeCountByDevice.get(id) || 0
  try {
    await ElMessageBox.confirm(
      `移除节点「${store.nodeMap.get(id)?.name}」${edgeCount ? `，将同时删除其 ${edgeCount} 条连线` : ''}？`,
      '确认移除',
      { type: 'warning' }
    )
    await store.removeNode(id)
    ElMessage.success('节点已移除')
  } catch (e: any) {
    if (e !== 'cancel') ElMessage.error(e.message || '移除失败')
  }
}
</script>

<style scoped>
.topology-page { padding: 24px; min-height: 100vh; }
.page-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
.page-title { font-size: 20px; font-weight: 600; color: var(--dv-light-text); margin: 0; }
.header-actions { display: flex; align-items: center; gap: 8px; margin-left: auto; }
.page-body { display: flex; gap: 16px; align-items: flex-start; }

.canvas-area { position: relative; flex: 1; min-width: 0; display: flex; flex-direction: column; }
.zoom-toolbar { position: absolute; top: 12px; right: 16px; z-index: 5; display: flex; align-items: center; gap: 6px; padding: 4px 6px; background: var(--dv-comp-card-bg); border: 1px solid var(--dv-header-border); border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.12); }
.zoom-toolbar :deep(.el-button) { margin-left: 0; }
.zoom-pct-btn { min-width: 56px; }
.zoom-divider { width: 1px; height: 16px; background: var(--dv-header-divider); margin: 0 2px; }
</style>
