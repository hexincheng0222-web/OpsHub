<template>
  <div class="services-page">
    <div class="top-bar">
      <span class="back-btn" @click="$router.push('/')">
        <el-icon><ArrowLeft /></el-icon> 返回首页
      </span>
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
        <el-button type="primary" @click="openAddDialog">
          <el-icon><Plus /></el-icon> 添加服务
        </el-button>
      </div>
    </div>

    <!-- 搜索/筛选栏 -->
    <div class="filter-bar">
      <el-input
        v-model="search"
        placeholder="搜索服务名称、描述或地址..."
        clearable
        class="search-input"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>
      <el-select v-model="filterCategory" placeholder="全部分类" clearable class="filter-select">
        <el-option v-for="cat in categories" :key="cat" :label="cat" :value="cat" />
      </el-select>
      <el-select v-model="filterStatus" placeholder="全部状态" clearable class="filter-select">
        <el-option label="在线" value="online" />
        <el-option label="离线" value="offline" />
        <el-option label="维护中" value="maintenance" />
      </el-select>
      <span v-if="filteredCount" class="result-count">共 {{ filteredCount }} 个</span>
    </div>

    <!-- 服务卡片网格 -->
    <div class="service-grid">
      <div
        v-for="svc in filteredServices"
        :key="svc.id"
        class="svc-card"
        :class="'status-' + svc.status"
      >
        <div class="status-bar" />
        <div class="svc-top">
          <div class="svc-icon">
            <el-icon :size="28"><component :is="svc.icon" /></el-icon>
          </div>
          <div class="svc-info">
            <span class="svc-name">{{ svc.name }}</span>
            <el-tag size="small">{{ svc.category }}</el-tag>
          </div>
          <el-tag :type="statusType(svc.status)" size="small" effect="dark">{{ statusLabel(svc.status) }}</el-tag>
        </div>
        <p class="svc-desc">{{ svc.description }}</p>
        <div class="svc-url" @click.stop="openService(svc.url)">
          <el-icon :size="14"><Link /></el-icon>
          <span>{{ svc.url }}</span>
        </div>
        <div class="svc-actions">
          <el-button size="small" type="primary" plain @click="openService(svc.url)">访问</el-button>
          <el-button size="small" plain @click="openEditDialog(svc)">编辑</el-button>
          <el-popconfirm title="确定删除？" @confirm="servicesStore.deleteService(svc.id)">
            <template #reference>
              <el-button size="small" type="danger" plain>删除</el-button>
            </template>
          </el-popconfirm>
        </div>
      </div>
      <div class="svc-card add-card" @click="openAddDialog">
        <div class="add-content">
          <el-icon :size="40"><CirclePlus /></el-icon>
          <span>添加服务</span>
        </div>
      </div>
    </div>

    <!-- 新增/编辑弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="editingService ? '编辑服务' : '添加服务'"
      width="500px"
    >
      <el-form :model="form" label-width="80px">
        <el-form-item label="服务名称">
          <el-input v-model="form.name" placeholder="如：Jenkins CI/CD" />
        </el-form-item>
        <el-form-item label="服务地址">
          <el-input v-model="form.url" placeholder="如：http://192.168.1.100:8080" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" placeholder="简要描述服务功能" />
        </el-form-item>
        <el-form-item label="图标">
          <el-select v-model="form.icon" placeholder="选择图标">
            <el-option label="设置" value="Setting" />
            <el-option label="文件夹" value="FolderOpened" />
            <el-option label="盒子" value="Box" />
            <el-option label="仪表盘" value="Odometer" />
            <el-option label="数据分析" value="DataAnalysis" />
            <el-option label="文档" value="Document" />
            <el-option label="阅读" value="Reading" />
            <el-option label="连接" value="Connection" />
            <el-option label="工具" value="Tools" />
            <el-option label="云" value="Cloudy" />
          </el-select>
        </el-form-item>
        <el-form-item label="分类">
          <el-input v-model="form.category" placeholder="如：DevOps / 监控 / 基础设施" />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio value="online">在线</el-radio>
            <el-radio value="offline">离线</el-radio>
            <el-radio value="maintenance">维护中</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveService">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useServicesStore } from '../stores/services'
import type { Service } from '../mock/services'

const servicesStore = useServicesStore()

onMounted(() => {
  servicesStore.checkAllServices()
})

const search = ref('')
const filterCategory = ref('')
const filterStatus = ref('')

const categories = computed(() => {
  return [...new Set(servicesStore.services.map(s => s.category))]
})

const filteredServices = computed(() => {
  return servicesStore.services.filter(s => {
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

const dialogVisible = ref(false)
const editingService = ref<Service | null>(null)

const form = reactive({
  name: '',
  url: '',
  description: '',
  icon: 'Setting',
  category: '',
  status: 'online' as Service['status']
})

function openAddDialog() {
  editingService.value = null
  form.name = ''
  form.url = ''
  form.description = ''
  form.icon = 'Setting'
  form.category = ''
  form.status = 'online'
  dialogVisible.value = true
}

function openEditDialog(row: Service) {
  editingService.value = row
  form.name = row.name
  form.url = row.url
  form.description = row.description
  form.icon = row.icon
  form.category = row.category
  form.status = row.status
  dialogVisible.value = true
}

function saveService() {
  if (editingService.value) {
    servicesStore.updateService(editingService.value.id, { ...form })
  } else {
    servicesStore.addService({ ...form })
  }
  dialogVisible.value = false
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
  max-width: 1200px;
  margin: 0 auto;
}

.top-bar {
  display: flex;
  align-items: center;
  gap: 24px;
  margin-bottom: 20px;
  padding: 16px 0;
  border-bottom: 1px solid #e8e8e8;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: #666;
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.2s;
}
.back-btn:hover {
  color: #1890ff;
}

.top-bar h3 {
  flex: 1;
  font-size: 16px;
  font-weight: 600;
  color: #333;
  margin: 0;
}

/* ---- 搜索/筛选栏 ---- */
.filter-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  align-items: center;
}

.search-input {
  max-width: 320px;
}

.filter-select {
  width: 140px;
}

.result-count {
  font-size: 12px;
  color: #999;
  white-space: nowrap;
}

/* ---- 卡片网格 ---- */
.service-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

.svc-card {
  background: #fff;
  border-radius: 12px;
  border: 1px solid #e8e8e8;
  padding: 20px 20px 16px;
  position: relative;
  overflow: hidden;
  transition: all 0.25s ease;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.svc-card:hover {
  border-color: #c0c0c0;
  box-shadow: 0 4px 16px rgba(0,0,0,0.08);
  transform: translateY(-2px);
}

/* 状态指示条 */
.status-bar {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 3px;
}
.status-online .status-bar { background: #52c41a; }
.status-offline .status-bar { background: #d9d9d9; }
.status-maintenance .status-bar { background: #faad14; }
.status-checking .status-bar { background: #1890ff; animation: pulse-bar 0.8s ease-in-out infinite; }

@keyframes pulse-bar {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.top-actions {
  display: flex;
  gap: 10px;
}

/* 顶部行 */
.svc-top {
  display: flex;
  align-items: center;
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
  transition: all 0.3s ease;
}

.status-online .svc-icon { background: #f0f9eb; color: #52c41a; }
.status-offline .svc-icon { background: #f5f5f5; color: #bfbfbf; }
.status-maintenance .svc-icon { background: #fef7e0; color: #faad14; }
.status-checking .svc-icon { background: #e6f7ff; color: #1890ff; animation: pulse-icon 0.8s ease-in-out infinite; }

@keyframes pulse-icon {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.svc-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.svc-info .svc-name {
  font-size: 15px;
  font-weight: 600;
  color: #1a1a1a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 描述 */
.svc-desc {
  font-size: 13px;
  color: #888;
  margin: 0;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* URL 行 */
.svc-url {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #1890ff;
  font-family: monospace;
  background: #f6f8fa;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
  overflow: hidden;
}
.svc-url span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.svc-url:hover {
  background: #e6f0ff;
}

/* 底部操作 */
.svc-actions {
  display: flex;
  gap: 8px;
  padding-top: 4px;
}

/* 添加卡片 */
.add-card {
  border: 2px dashed #d9d9d9;
  background: #fafafa;
  cursor: pointer;
  justify-content: center;
  align-items: center;
  min-height: 200px;
}
.add-card:hover {
  border-color: #1890ff;
  background: #f0f5ff;
}

.add-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  color: #aaa;
}
.add-card:hover .add-content {
  color: #1890ff;
}
.add-content span {
  font-size: 14px;
}
</style>
