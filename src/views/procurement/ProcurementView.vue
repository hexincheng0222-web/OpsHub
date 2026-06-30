<template>
  <div class="procurement-layout">
    <!-- 顶部导航 + Tab -->
    <div class="proc-topbar">
      <BackButton to="/" />
      <div class="proc-tabs">
        <div class="proc-tab" :class="{ active: activeTab === 'computer' }" @click="switchTab('computer')">
          <span class="tab-icon">🖥</span>
          <span>电脑采购</span>
          <span class="tab-count">{{ computerStore.computers.length }}</span>
        </div>
        <div class="proc-tab" :class="{ active: activeTab === 'phone' }" @click="switchTab('phone')">
          <span class="tab-icon">📱</span>
          <span>手机采购</span>
          <span class="tab-count">{{ phoneStore.phones.length }}</span>
        </div>
        <div class="proc-tab" :class="{ active: activeTab === 'overview' }" @click="switchTab('overview')">
          <span class="tab-icon">📊</span>
          <span>采购概览</span>
        </div>
      </div>
      <div class="proc-topbar-right">
        <el-button size="small" @click="triggerImport">
          <el-icon><Upload /></el-icon> 导入
        </el-button>
        <el-button type="primary" size="small" @click="openAddDialog">
          <el-icon><Plus /></el-icon> 添加
        </el-button>
      </div>
    </div>

    <!-- Tab 内容区 -->
    <div class="proc-content">
      <ComputerProcurementTab v-if="activeTab === 'computer'" ref="computerTabRef" />
      <PhoneProcurementTab v-else-if="activeTab === 'phone'" ref="phoneTabRef" />
      <ProcurementOverviewTab v-else-if="activeTab === 'overview'" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Plus, Upload } from '@element-plus/icons-vue'
import { useComputerProcurementStore } from '../../stores/procurement'
import { usePhoneProcurementStore } from '../../stores/procurement'
import ComputerProcurementTab from './ComputerProcurementTab.vue'
import PhoneProcurementTab from './PhoneProcurementTab.vue'
import ProcurementOverviewTab from './ProcurementOverviewTab.vue'
import BackButton from '../../components/BackButton.vue'

const route = useRoute()
const router = useRouter()
const computerStore = useComputerProcurementStore()
const phoneStore = usePhoneProcurementStore()

const activeTab = ref<'computer' | 'phone' | 'overview'>(
  (route.query.tab as 'computer' | 'phone' | 'overview') || 'computer'
)

const computerTabRef = ref<InstanceType<typeof ComputerProcurementTab>>()
const phoneTabRef = ref<InstanceType<typeof PhoneProcurementTab>>()

function switchTab(tab: 'computer' | 'phone' | 'overview') {
  activeTab.value = tab
  // 切换时按需加载（仅首次）
  if (tab === 'computer' && computerStore.computers.length === 0) computerStore.loadComputers()
  else if (tab === 'phone' && phoneStore.phones.length === 0) phoneStore.loadPhones()
  router.replace({ query: { ...route.query, tab } })
}

function openAddDialog() {
  if (activeTab.value === 'computer') computerTabRef.value?.openAddDialog()
  else if (activeTab.value === 'phone') phoneTabRef.value?.openAddDialog()
}

function triggerImport() {
  if (activeTab.value === 'computer') computerTabRef.value?.importCSV()
  else if (activeTab.value === 'phone') phoneTabRef.value?.importCSV()
}

onMounted(() => {
  if (activeTab.value === 'computer') computerStore.loadComputers()
  else if (activeTab.value === 'phone') phoneStore.loadPhones()
  // overview 不预加载
})
</script>

<style scoped>
.procurement-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--ops-bg-page);
}

/* 顶部导航 */
.proc-topbar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 24px;
  background: var(--ops-bg-card);
  border-bottom: 1px solid var(--ops-border-card);
  flex-shrink: 0;
}
/* Tab 切换 */
.proc-tabs {
  display: flex;
  gap: 4px;
  flex: 1;
}
.proc-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  font-size: 13px;
  color: var(--ops-text-secondary);
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.15s;
  user-select: none;
}
.proc-tab:hover {
  background: var(--ops-bg-card-hover);
  color: var(--ops-text-primary);
}
.proc-tab.active {
  background: rgba(88,166,255,0.12);
  color: var(--ops-accent-blue);
  font-weight: 600;
}
.tab-icon { font-size: 14px; }
.tab-count {
  font-size: 11px;
  color: var(--ops-text-tertiary);
  background: var(--ops-bg-card-hover);
  padding: 1px 7px;
  border-radius: 8px;
  font-weight: 600;
}
.proc-tab.active .tab-count {
  background: rgba(88,166,255,0.15);
  color: var(--ops-accent-blue);
}

.proc-topbar-right {
  display: flex;
  gap: 8px;
}

/* 内容区 */
.proc-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
</style>
