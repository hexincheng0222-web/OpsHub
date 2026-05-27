<template>
  <div class="services-page">
    <el-breadcrumb separator=">" class="breadcrumb-nav">
      <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
      <el-breadcrumb-item>内网服务管理</el-breadcrumb-item>
    </el-breadcrumb>
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
        <el-option v-for="cat in SERVICE_CATEGORIES" :key="cat" :label="cat" :value="cat" />
      </el-select>
      <el-select v-model="filterStatus" placeholder="全部状态" clearable class="filter-select">
        <el-option label="在线" value="online" />
        <el-option label="离线" value="offline" />
        <el-option label="维护中" value="maintenance" />
      </el-select>
      <span v-if="filteredCount" class="result-count">共 {{ filteredCount }} 个</span>
    </div>

    <!-- 骨架屏：首次加载且无数据时显示 -->
    <div v-if="loading && servicesStore.services.length === 0" class="service-grid">
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
            <div style="display: flex; gap: 8px; margin-top: 8px;">
              <el-skeleton-item variant="button" style="width: 60px; height: 28px;" />
              <el-skeleton-item variant="button" style="width: 60px; height: 28px;" />
              <el-skeleton-item variant="button" style="width: 60px; height: 28px;" />
            </div>
          </div>
        </template>
      </el-skeleton>
    </div>

    <!-- 筛选无结果时显示空状态 -->
    <div v-else-if="filteredServices.length === 0 && servicesStore.services.length > 0" class="empty-container">
      <el-empty description="未找到匹配的服务">
        <el-button type="primary" @click="search = ''; filterCategory = ''; filterStatus = ''">
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
          <el-popconfirm :title="`确定删除「${svc.name}」吗？`" @confirm="servicesStore.deleteService(svc.id)">
            <template #reference>
              <el-button size="small" type="danger" plain>删除</el-button>
            </template>
          </el-popconfirm>
        </div>
      </div>
    </div>

    <!-- 新增/编辑弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="editingService ? '编辑服务' : '添加服务'"
      :width="dialogWidth"
    >
      <el-form ref="serviceFormRef" :model="form" :rules="formRules" label-width="80px">
        <el-form-item label="服务名称" prop="name">
          <el-input v-model="form.name" placeholder="如：Jenkins CI/CD" />
        </el-form-item>
        <el-form-item label="服务地址" prop="url">
          <el-input v-model="form.url" placeholder="如：http://192.168.1.100:8080" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" placeholder="简要描述服务功能" />
        </el-form-item>
        <el-form-item label="图标">
          <div class="icon-picker">
            <div
              v-for="icon in iconOptions"
              :key="icon"
              class="icon-option"
              :class="{ selected: form.icon === icon }"
              @click="form.icon = icon"
            >
              <el-icon :size="24"><component :is="icon" /></el-icon>
              <span class="icon-label">{{ icon }}</span>
            </div>
          </div>
        </el-form-item>
        <el-form-item label="分类" prop="category">
          <el-select v-model="form.category" filterable allow-create placeholder="选择或输入分类">
            <el-option v-for="cat in SERVICE_CATEGORIES" :key="cat" :label="cat" :value="cat" />
          </el-select>
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
        <el-button type="primary" :loading="saving" @click="saveService">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useServicesStore } from '../stores/services'
import type { Service } from '../mock/services'
import { SERVICE_CATEGORIES } from '../mock/services'

const servicesStore = useServicesStore()

onMounted(() => {
  servicesStore.checkAllServices()
  loading.value = false
})

const loading = ref(true)
const saving = ref(false)

const search = ref('')
const filterCategory = ref('')
const filterStatus = ref('')

const iconOptions = ['Setting', 'FolderOpened', 'Box', 'Odometer', 'DataAnalysis', 'Document', 'Reading', 'Connection', 'Tools', 'Cloudy']

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
const serviceFormRef = ref()

const formRules = {
  name: [{ required: true, message: '请输入服务名称', trigger: 'blur' }],
  url: [
    { required: true, message: '请输入服务地址', trigger: 'blur' },
    { validator: validateUrl, trigger: 'blur' }
  ],
  category: [{ required: true, message: '请选择分类', trigger: 'blur' }]
}

function validateUrl(_rule: any, value: string, callback: Function) {
  if (!value) {
    callback(new Error('请输入服务地址'))
    return
  }
  const urlRegex = /^(https?:\/\/)?([\w.-]+)(:\d+)?(\/[^\s]*)?$/
  if (urlRegex.test(value)) {
    callback()
  } else {
    callback(new Error('请输入正确的地址格式'))
  }
}

const dialogWidth = computed(() => window.innerWidth < 768 ? '90%' : '500px')

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
  if (saving.value) return
  saving.value = true
  serviceFormRef.value.validate((valid: boolean) => {
    if (valid) {
      if (editingService.value) {
        servicesStore.updateService(editingService.value.id, { ...form })
      } else {
        servicesStore.addService({ ...form })
      }
      dialogVisible.value = false
    }
    saving.value = false
  })
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
  padding: 20px 0;
  background: var(--ops-bg-page);
  color-scheme: dark;
}

.breadcrumb-nav {
  font-size: 13px;
  margin-bottom: 12px;
}

:deep(.el-breadcrumb__item:last-child .el-breadcrumb__inner) {
  color: var(--ops-text-primary);
}

:deep(.el-breadcrumb__item:not(:last-child) .el-breadcrumb__inner) {
  color: var(--ops-text-tertiary);
}

.top-bar {
  display: flex;
  align-items: center;
  gap: 24px;
  margin-bottom: 20px;
  padding: 16px 0;
  border-bottom: 1px solid var(--ops-border-card);
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: var(--ops-text-tertiary);
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.2s;
}
.back-btn:hover {
  color: var(--ops-accent-blue);
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
  padding: 20px 20px 16px;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 220px;
}

.svc-card:hover {
  border-color: var(--ops-border-card);
  box-shadow: var(--ops-shadow-card);
  background: var(--ops-bg-card-hover);
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
}

.status-online .svc-icon { background: rgba(63, 185, 80, 0.15); color: var(--ops-status-online); }
.status-offline .svc-icon { background: rgba(72, 79, 88, 0.3); color: var(--ops-text-tertiary); }
.status-maintenance .svc-icon { background: rgba(210, 153, 34, 0.15); color: var(--ops-status-maintenance); }
.status-checking .svc-icon { background: rgba(88, 166, 255, 0.15); color: var(--ops-accent-blue); }

@media (prefers-reduced-motion: no-preference) {
  .svc-card {
    transition: all 0.25s ease;
  }
  .svc-card:hover {
    transform: translateY(-2px) scale(1.01);
  }
  .svc-icon {
    transition: all 0.3s ease;
  }
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
  color: var(--ops-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

/* URL 行 */
.svc-url {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--ops-accent-blue);
  font-family: monospace;
  background: var(--ops-bg-card);
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
  background: rgba(88, 166, 255, 0.1);
}

/* 底部操作 */
.svc-actions {
  display: flex;
  gap: 8px;
  padding-top: 4px;
}

/* ---- 图标网格选择器 ---- */
.icon-picker {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
}
.icon-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px;
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
.icon-label {
  font-size: 11px;
  color: var(--ops-text-secondary);
}
</style>
