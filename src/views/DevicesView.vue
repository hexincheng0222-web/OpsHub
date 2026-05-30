<template>
  <div class="devices-page">
    <div class="top-bar">
      <span class="back-btn" @click="$router.push('/')">
        <el-icon><ArrowLeft /></el-icon> 返回首页
      </span>
      <h3>设备信息</h3>
      <el-button type="primary" @click="openAddDialog">
        <el-icon><Plus /></el-icon> 添加设备
      </el-button>
    </div>

    <!-- 筛选区 -->
    <el-card class="filter-bar" style="margin-bottom: 16px">
      <el-row :gutter="16">
        <el-col :span="6">
          <el-input v-model="search" placeholder="搜索设备名称" clearable />
        </el-col>
        <el-col :span="4">
          <el-select v-model="filterType" placeholder="设备类型" clearable>
            <el-option label="服务器" value="服务器" />
            <el-option label="台式机" value="台式机" />
            <el-option label="笔记本" value="笔记本" />
            <el-option label="网络设备" value="网络设备" />
            <el-option label="存储设备" value="存储设备" />
          </el-select>
        </el-col>
        <el-col :span="4">
          <el-select v-model="filterDept" placeholder="所属部门" clearable>
            <el-option label="技术部" value="技术部" />
            <el-option label="运维部" value="运维部" />
            <el-option label="产品部" value="产品部" />
            <el-option label="行政部" value="行政部" />
          </el-select>
        </el-col>
      </el-row>
    </el-card>

    <!-- 设备表格 -->
    <el-card>
      <el-table :data="filteredDevices" stripe style="width: 100%">
        <el-table-column prop="name" label="设备名称" min-width="140" />
        <el-table-column prop="type" label="类型" width="100">
          <template #default="{ row }">
            <el-tag size="small">{{ row.type }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="brand" label="品牌型号" min-width="160" />
        <el-table-column prop="dept" label="所属部门" width="110" />
        <el-table-column prop="status" label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === '正常' ? 'success' : 'warning'" size="small" effect="dark">
              {{ row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="purchaseDate" label="购置日期" width="120" />
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openEditDialog(row)">编辑</el-button>
            <el-popconfirm title="确定删除？" @confirm="deleteDevice(row.id)">
              <template #reference>
                <el-button link type="danger" size="small">删除</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 新增/编辑弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="editingDevice ? '编辑设备' : '添加设备'"
      width="500px"
    >
      <el-form :model="form" label-width="80px">
        <el-form-item label="设备名称">
          <el-input v-model="form.name" placeholder="如：线上服务器-01" />
        </el-form-item>
        <el-form-item label="设备类型">
          <el-select v-model="form.type">
            <el-option label="服务器" value="服务器" />
            <el-option label="台式机" value="台式机" />
            <el-option label="笔记本" value="笔记本" />
            <el-option label="网络设备" value="网络设备" />
            <el-option label="存储设备" value="存储设备" />
          </el-select>
        </el-form-item>
        <el-form-item label="品牌型号">
          <el-input v-model="form.brand" placeholder="如：Dell R740" />
        </el-form-item>
        <el-form-item label="所属部门">
          <el-select v-model="form.dept">
            <el-option label="技术部" value="技术部" />
            <el-option label="运维部" value="运维部" />
            <el-option label="产品部" value="产品部" />
            <el-option label="行政部" value="行政部" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio value="正常">正常</el-radio>
            <el-radio value="维修中">维修中</el-radio>
            <el-radio value="已报废">已报废</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="购置日期">
          <el-date-picker v-model="form.purchaseDate" type="date" placeholder="选择日期" value-format="YYYY-MM-DD" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveDevice">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useDevicesStore } from '../stores/devices'
import type { Device } from '../mock/devices'

const store = useDevicesStore()
const devices = computed(() => store.devices)

const search = ref('')
const filterType = ref('')
const filterDept = ref('')
const dialogVisible = ref(false)
const editingDevice = ref<Device | null>(null)

const form = reactive({
  name: '',
  type: '服务器',
  brand: '',
  dept: '技术部',
  status: '正常',
  purchaseDate: ''
})

const filteredDevices = computed(() => {
  return devices.value.filter(d => {
    if (search.value && !d.name.includes(search.value) && !d.brand.includes(search.value)) return false
    if (filterType.value && d.type !== filterType.value) return false
    if (filterDept.value && d.dept !== filterDept.value) return false
    return true
  })
})

function openAddDialog() {
  editingDevice.value = null
  form.name = ''
  form.type = '服务器'
  form.brand = ''
  form.dept = '技术部'
  form.status = '正常'
  form.purchaseDate = ''
  dialogVisible.value = true
}

function openEditDialog(row: Device) {
  editingDevice.value = row
  form.name = row.name
  form.type = row.type
  form.brand = row.brand
  form.dept = row.dept
  form.status = row.status
  form.purchaseDate = row.purchaseDate
  dialogVisible.value = true
}

function saveDevice() {
  if (editingDevice.value) {
    store.updateDevice(editingDevice.value.id, { ...form })
  } else {
    const maxId = store.devices.reduce((max, d) => Math.max(max, d.id), 0)
    store.addDevice({ id: maxId + 1, ...form } as Device)
  }
  dialogVisible.value = false
}

function deleteDevice(id: number) {
  store.deleteDevice(id)
}
</script>

<style scoped>
.devices-page {
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
</style>
