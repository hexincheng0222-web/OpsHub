<template>
  <div class="services-page">
    <div class="top-bar">
      <BackButton to="/" />
      <h3>内网服务管理</h3>
      <div class="top-actions">
        <el-button
          :type="servicesStore.checking ? 'warning' : 'default'"
          :loading="servicesStore.checking"
          @click="servicesStore.checkAllServices()"
        >
          <el-icon><Refresh /></el-icon>
          {{ servicesStore.checking ? '检测中...' : '检测连通性' }}
        </el-button>
      </div>
    </div>

    <!-- 搜索/筛选栏 -->
    <div class="filter-bar">
      <el-input
        v-model="searchInput"
        placeholder="搜索服务名称、描述或地址..."
        clearable
        class="search-input"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>
      <el-select v-model="filterCategory" placeholder="全部分类" clearable class="filter-select">
        <el-option v-for="cat in serviceCategories" :key="cat" :label="cat" :value="cat" />
      </el-select>
      <el-select v-model="filterStatus" placeholder="全部状态" clearable class="filter-select">
        <el-option label="在线" value="online" />
        <el-option label="离线" value="offline" />
        <el-option label="维护中" value="maintenance" />
      </el-select>
      <span v-if="filteredCount" class="result-count">共 {{ filteredCount }} 个</span>
    </div>

    <!-- 主机卡片栏 -->
    <div class="host-bar">
      <div
        class="host-card"
        :class="{ active: selectedHostId === null }"
        @click="selectedHostId = null"
      >
        <span class="host-name">全部主机</span>
        <span class="host-count">{{ servicesStore.services.length }}</span>
      </div>
      <div
        v-for="host in hosts"
        :key="host.id"
        class="host-card"
        :class="{ active: selectedHostId === host.id }"
        @click="selectedHostId = selectedHostId === host.id ? null : host.id"
      >
        <span class="host-name">{{ host.name }}</span>
        <span class="host-ip">{{ host.ip }}</span>
        <span class="host-count">{{ getHostServiceCount(host.id) }}</span>
      </div>
    </div>

    <!-- 骨架屏：首次加载且无数据时显示 -->
    <div v-if="servicesStore.loading && servicesStore.services.length === 0" class="service-grid">
      <el-skeleton v-for="i in 6" :key="i" animated class="svc-card">
        <template #template>
          <div style="display: flex; gap: 12px; flex-direction: column;">
            <div style="display: flex; gap: 12px; align-items: center;">
              <el-skeleton-item variant="circle" style="width: 48px; height: 48px;" />
              <div style="flex: 1;">
                <el-skeleton-item variant="text" style="width: 60%; margin-bottom: 8px;" />
                <el-skeleton-item variant="text" style="width: 30%;" />
              </div>
            </div>
            <el-skeleton-item variant="text" style="width: 90%;" />
            <el-skeleton-item variant="text" style="width: 70%;" />
            <el-skeleton-item variant="button" style="width: 100%; height: 36px; margin-top: 8px;" />
          </div>
        </template>
      </el-skeleton>
    </div>

    <!-- 筛选无结果时显示空状态 -->
    <div v-else-if="filteredServices.length === 0 && servicesStore.services.length > 0" class="empty-container">
      <el-empty description="未找到匹配的服务">
        <el-button type="primary" @click="searchInput = ''; filterCategory = ''; filterStatus = ''">
          清除筛选
        </el-button>
      </el-empty>
    </div>

    <!-- 服务卡片网格 -->
    <div v-else class="service-grid">
      <div
        v-for="(svc, index) in filteredServices"
        :key="svc.id"
        class="svc-card"
        :class="'status-' + svc.status"
        :style="{ animationDelay: index * 80 + 'ms' }"
        @click="openDrawer(svc)"
      >
        <div class="status-bar" />
        <div class="svc-top">
          <div class="svc-icon">
            <el-icon :size="28"><component :is="resolveIcon(svc.icon)" /></el-icon>
            <span class="status-dot" :class="'dot-' + svc.status" />
          </div>
          <div class="svc-info">
            <div class="svc-name-row">
              <span class="svc-name">{{ svc.name }}</span>
              <el-tag :type="statusType(svc.status)" size="small" effect="dark">{{ statusLabel(svc.status) }}</el-tag>
            </div>
            <p class="svc-desc">{{ svc.description }}</p>
          </div>
        </div>
        <div class="svc-meta">
          <el-tag size="small" type="info">{{ svc.category }}</el-tag>
          <span class="svc-url">{{ svc.url }}</span>
        </div>
      </div>
    </div>

    <!-- 新增/编辑弹窗 -->
    <!-- 右侧详情抽屉 -->
    <el-drawer v-model="drawerVisible" direction="rtl" size="400px" :show-close="false">
      <template #header>
        <div v-if="selectedService" style="display:flex;align-items:center;gap:12px">
          <div class="drawer-icon" :class="'status-' + selectedService.status">
            <el-icon :size="28"><component :is="resolveIcon(selectedService.icon)" /></el-icon>
          </div>
          <div>
            <h4 style="margin:0;font-size:16px;font-weight:600;color:var(--ops-text-primary)">{{ selectedService.name }}</h4>
            <el-tag :type="statusType(selectedService.status)" size="small" effect="dark" style="margin-top:4px">
              {{ statusLabel(selectedService.status) }}
            </el-tag>
          </div>
        </div>
      </template>
      <div v-if="selectedService" class="drawer-content">
        <div class="drawer-section">
          <div class="drawer-label">服务地址</div>
          <div class="drawer-url">
            <el-icon><Link /></el-icon>
            <span>{{ selectedService.url }}</span>
          </div>
        </div>
        <div class="drawer-section">
          <div class="drawer-label">描述</div>
          <div class="drawer-value">{{ selectedService.description || '暂无描述' }}</div>
        </div>
        <div class="drawer-section">
          <div class="drawer-label">备注</div>
          <div class="drawer-notes">{{ selectedService.notes || '暂无备注' }}</div>
        </div>
      </div>
      <template #footer>
        <el-button type="primary" @click="openService(selectedService!.url)">
          <el-icon><Position /></el-icon> 访问服务
        </el-button>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useServicesStore } from '../stores/services'
import { useDebouncedSearch } from '../composables/useDebouncedSearch'
import type { Service } from '../types'
import { fetchDict } from '../api/admin'
import { resolveIcon } from '../utils/icons'
import { ElMessage } from 'element-plus'
import BackButton from '../components/BackButton.vue'

const route = useRoute()
const router = useRouter()
const servicesStore = useServicesStore()

// 字典数据
const hosts = ref<any[]>([])
const selectedHostId = ref<number | null>(null)
const serviceCategories = ref<string[]>([])

onMounted(() => {
  servicesStore.loadServices()
  servicesStore.checkAllServices()
  // 加载字典
  fetchDict('service-hosts').then(data => { hosts.value = data }).catch((e: any) => { console.warn('加载主机列表失败:', e.message); ElMessage.warning('主机列表加载失败，请刷新重试') })
  fetchDict('service-categories').then(data => { serviceCategories.value = data.map((c: any) => c.name) }).catch((e: any) => { console.warn('加载服务分类失败:', e.message); ElMessage.warning('服务分类加载失败，请刷新重试') })
})

// 统计每个主机的服务数
function getHostServiceCount(hostId: number) {
  return servicesStore.services.filter(s => s.hostId === hostId).length
}

const { searchInput, search } = useDebouncedSearch()
searchInput.value = (route.query.search as string) || ''
const filterCategory = ref((route.query.category as string) || '')
const filterStatus = ref((route.query.status as string) || '')

// 筛选同步到 URL
watch([search, filterCategory, filterStatus], () => {
  router.replace({ query: { search: search.value || undefined, category: filterCategory.value || undefined, status: filterStatus.value || undefined } })
})

const filteredServices = computed(() => {
  return servicesStore.services.filter(s => {
    if (selectedHostId.value !== null && s.hostId !== selectedHostId.value) return false
    if (search.value) {
      const q = search.value.toLowerCase()
      if (!s.name.toLowerCase().includes(q) &&
          !s.description.toLowerCase().includes(q) &&
          !s.url.toLowerCase().includes(q)) return false
    }
    if (filterCategory.value && s.category !== filterCategory.value) return false
    if (filterStatus.value && s.status !== filterStatus.value) return false
    return true
  })
})

const filteredCount = computed(() => filteredServices.value.length)

const drawerVisible = ref(false)
const selectedService = ref<Service | null>(null)

function openDrawer(svc: Service) {
  selectedService.value = svc
  drawerVisible.value = true
}

function openService(url: string) {
  window.open(url, '_blank')
}

function statusType(status: string) {
  switch (status) {
    case 'online': return 'success'
    case 'offline': return 'danger'
    case 'maintenance': return 'warning'
    case 'checking': return 'info'
    default: return 'info'
  }
}

function statusLabel(status: string) {
  switch (status) {
    case 'online': return '在线'
    case 'offline': return '离线'
    case 'maintenance': return '维护中'
    case 'checking': return '检测中'
    default: return status
  }
}
</script>

<style scoped>
.services-page {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  min-height: 100vh;
  background: var(--ops-bg-page);
}

.top-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
  padding: 14px 0;
  border-bottom: 1px solid var(--ops-border-card);
}

.top-bar h3 {
  flex: 1;
  font-size: 16px;
  font-weight: 600;
  color: var(--ops-text-primary);
  margin: 0;
}

/* ---- 搜索/筛选栏 ---- */
.filter-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  padding: 12px 16px;
  align-items: center;
  background: var(--ops-bg-card);
  border-radius: 10px;
  border: 1px solid var(--ops-border-card);
}

.search-input {
  flex: 1;
  min-width: 200px;
}

.filter-select {
  width: 140px;
}

.host-bar {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.host-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: var(--ops-bg-card);
  border: 1px solid var(--ops-border-card);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  flex-shrink: 0;
}

.host-card:hover {
  border-color: var(--ops-accent-blue);
}

.host-card.active {
  background: rgba(88, 166, 255, 0.1);
  border-color: var(--ops-accent-blue);
}

.host-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--ops-text-primary);
}

.host-ip {
  font-size: 11px;
  color: var(--ops-text-tertiary);
  font-family: 'SF Mono', 'Consolas', monospace;
}

.host-count {
  font-size: 11px;
  color: var(--ops-accent-blue);
  background: rgba(88, 166, 255, 0.1);
  padding: 1px 6px;
  border-radius: 8px;
  font-weight: 600;
}

.result-count {
  font-size: 12px;
  color: var(--ops-text-tertiary);
  white-space: nowrap;
}

/* ---- 卡片网格 ---- */
.service-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

.empty-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 300px;
  padding: 40px 0;
}

.svc-card {
  background: var(--ops-bg-card);
  border-radius: 12px;
  border: 1px solid var(--ops-border-card);
  padding: 20px;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 12px;
  cursor: pointer;
  transition: all 0.25s ease;
}

.svc-card:hover {
  border-color: var(--ops-border-card);
  box-shadow: var(--ops-shadow-card);
  background: var(--ops-bg-card-hover);
  transform: translateY(-2px);
}

.svc-card.status-online {
  background: color-mix(in srgb, var(--ops-bg-card) 92%, var(--ops-status-online));
}
.svc-card.status-offline {
  background: var(--ops-bg-card);
}
.svc-card.status-maintenance {
  background: color-mix(in srgb, var(--ops-bg-card) 92%, var(--ops-status-maintenance));
}
.svc-card.status-checking {
  background: color-mix(in srgb, var(--ops-bg-card) 92%, var(--ops-accent-blue));
}

/* 状态指示条 */
.status-bar {
  position: absolute;
  top: 0; left: 0; bottom: 0;
  width: 4px;
}
.status-online .status-bar { background: var(--ops-status-online); }
.status-offline .status-bar { background: var(--ops-status-offline); }
.status-maintenance .status-bar { background: var(--ops-status-maintenance); }
.status-checking .status-bar { background: var(--ops-accent-blue); }

.top-actions {
  display: flex;
  gap: 10px;
}

/* 顶部行 */
.svc-top {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.svc-icon {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  position: relative;
}

/* 状态圆点 */
.status-dot {
  position: absolute;
  bottom: 2px;
  right: 2px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid var(--ops-bg-card);
}
.dot-online { background: var(--ops-status-online); }
.dot-offline { background: var(--ops-status-offline); }
.dot-maintenance { background: var(--ops-status-maintenance); }
.dot-checking { background: var(--ops-accent-blue); animation: pulse-dot 0.8s ease-in-out infinite; }
@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.status-online .svc-icon { background: rgba(63, 185, 80, 0.15); color: var(--ops-status-online); }
.status-offline .svc-icon { background: rgba(72, 79, 88, 0.3); color: var(--ops-text-tertiary); }
.status-maintenance .svc-icon { background: rgba(210, 153, 34, 0.15); color: var(--ops-status-maintenance); }
.status-checking .svc-icon { background: rgba(88, 166, 255, 0.15); color: var(--ops-accent-blue); }

.status-checking .status-bar {
  animation: pulse-bar 0.8s ease-in-out infinite;
}
.status-checking .svc-icon {
  animation: pulse-icon 0.8s ease-in-out infinite;
}
@keyframes pulse-bar {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
@keyframes pulse-icon {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.svc-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.svc-info .svc-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--ops-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.svc-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.svc-name-row .svc-name {
  flex: 1;
  min-width: 0;
}

/* 描述 */
.svc-desc {
  font-size: 13px;
  color: var(--ops-text-secondary);
  margin: 0;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* 元信息行 */
.svc-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: auto;
  padding-top: 8px;
  border-top: 1px solid var(--ops-border-card);
}

/* URL 行 */
.svc-url {
  font-size: 12px;
  color: var(--ops-text-tertiary);
  font-family: monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

/* 悬浮快速访问按钮 */
.quick-visit {
  position: absolute;
  bottom: 12px;
  right: 12px;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: var(--ops-accent-blue);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0;
  transform: translateY(4px);
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(88, 166, 255, 0.3);
}
.svc-card:hover .quick-visit {
  opacity: 1;
  transform: translateY(0);
}
.quick-visit:hover {
  background: #79b8ff;
  transform: scale(1.05);
}

/* ---- 图标网格选择器 ---- */
.icon-picker {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
}
.icon-option {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px;
  border-radius: 8px;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.2s;
}
.icon-option:hover {
  background: var(--ops-bg-card-hover);
}
.icon-option.selected {
  border-color: var(--ops-accent-blue);
  background: rgba(88, 166, 255, 0.15);
}

/* ---- 表单行 ---- */
.form-row {
  display: flex;
  gap: 16px;
}
.form-item-half {
  flex: 1;
}

/* ---- 详情弹窗 ---- */
.detail-content {
  padding: 0;
}

.detail-header {
  display: flex;
  gap: 16px;
  align-items: center;
}

.detail-icon {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.detail-icon.status-online { background: rgba(63, 185, 80, 0.15); color: var(--ops-status-online); }
.detail-icon.status-offline { background: rgba(72, 79, 88, 0.3); color: var(--ops-text-tertiary); }
.detail-icon.status-maintenance { background: rgba(210, 153, 34, 0.15); color: var(--ops-status-maintenance); }
.detail-icon.status-checking { background: rgba(88, 166, 255, 0.15); color: var(--ops-accent-blue); }

.detail-title {
  flex: 1;
}

.detail-title h3 {
  margin: 0 0 8px 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--ops-text-primary);
}

.detail-tags {
  display: flex;
  gap: 8px;
}

.detail-section {
  margin-bottom: 16px;
}

.detail-label {
  font-size: 12px;
  color: var(--ops-text-tertiary);
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.detail-url {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--ops-accent-blue);
  font-family: monospace;
  background: var(--ops-bg-page);
  padding: 10px 12px;
  border-radius: 8px;
}

.detail-value {
  font-size: 14px;
  color: var(--ops-text-secondary);
  line-height: 1.6;
}

.detail-notes {
  font-size: 14px;
  color: var(--ops-text-secondary);
  line-height: 1.6;
  background: var(--ops-bg-page);
  padding: 12px;
  border-radius: 8px;
  white-space: pre-wrap;
}

.detail-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.detail-actions-left {
  display: flex;
  gap: 8px;
}

:deep(.el-dialog) {
  background: var(--ops-bg-card);
  border: 1px solid var(--ops-border-card);
}

:deep(.el-dialog__header) {
  border-bottom: 1px solid var(--ops-border-card);
  padding: 16px 20px;
  margin: 0;
}

:deep(.el-dialog__title) {
  color: var(--ops-text-primary);
  font-weight: 600;
}

:deep(.el-dialog__body) {
  padding: 20px;
}

:deep(.el-dialog__footer) {
  border-top: 1px solid var(--ops-border-card);
  padding: 16px 20px;
}

:deep(.el-form-item__label) {
  color: var(--ops-text-secondary);
  font-size: 13px;
}

:deep(.el-divider) {
  border-color: var(--ops-border-card);
  margin: 16px 0;
}

/* ---- el-drawer 内容样式 ---- */
.drawer-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.drawer-icon.status-online { background: rgba(63, 185, 80, 0.15); color: var(--ops-status-online); }
.drawer-icon.status-offline { background: rgba(72, 79, 88, 0.3); color: var(--ops-text-tertiary); }
.drawer-icon.status-maintenance { background: rgba(210, 153, 34, 0.15); color: var(--ops-status-maintenance); }

.drawer-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.drawer-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.drawer-label {
  font-size: 12px;
  color: var(--ops-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.drawer-url {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--ops-accent-blue);
  font-family: monospace;
  background: var(--ops-bg-page);
  padding: 10px 12px;
  border-radius: 8px;
}

.drawer-value {
  font-size: 14px;
  color: var(--ops-text-secondary);
  line-height: 1.6;
}

.drawer-notes {
  font-size: 14px;
  color: var(--ops-text-secondary);
  line-height: 1.6;
  background: var(--ops-bg-page);
  padding: 12px;
  border-radius: 8px;
  white-space: pre-wrap;
  font-family: monospace;
}

</style>
