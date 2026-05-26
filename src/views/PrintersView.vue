<template>
  <div class="printers-page">
    <div class="top-bar">
      <span class="back-btn" @click="$router.push('/')">
        <el-icon><ArrowLeft /></el-icon> 返回首页
      </span>
      <h3>打印机管理</h3>
      <el-button type="primary" @click="openAddDialog">
        <el-icon><Plus /></el-icon> 添加打印机
      </el-button>
    </div>

    <!-- 打印机卡片网格 -->
    <div class="printer-grid">
      <el-card
        v-for="printer in printers"
        :key="printer.id"
        class="printer-card"
        shadow="hover"
      >
        <div class="printer-top">
          <div class="printer-icon" :class="printer.status === '正常' ? 'ok' : printer.status === '缺墨' ? 'warn' : 'err'">
            <el-icon :size="36"><Printer /></el-icon>
          </div>
          <div class="printer-main">
            <span class="printer-name">{{ printer.name }}</span>
            <span class="printer-model">{{ printer.model }}</span>
            <span class="printer-ip">{{ printer.ip }}</span>
          </div>
          <el-tag
            :type="printer.status === '正常' ? 'success' : printer.status === '缺墨' ? 'warning' : 'danger'"
            size="small"
            effect="dark"
          >
            {{ printer.status }}
          </el-tag>
        </div>

        <div class="printer-meta">
          <div class="meta-item">
            <span class="meta-label">位置</span>
            <span class="meta-value">{{ printer.location }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">墨量</span>
            <el-progress
              :percentage="printer.inkLevel"
              :color="printer.inkLevel < 20 ? '#f56c6c' : printer.inkLevel < 50 ? '#e6a23c' : '#67c23a'"
              :stroke-width="8"
              style="width: 120px"
            />
          </div>
        </div>

        <div class="printer-actions">
          <el-button size="small" @click="openEditDialog(printer)">编辑</el-button>
          <el-popconfirm title="确定删除？" @confirm="deletePrinter(printer.id)">
            <template #reference>
              <el-button size="small" type="danger">删除</el-button>
            </template>
          </el-popconfirm>
        </div>
      </el-card>
    </div>

    <!-- 新增/编辑弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="editingPrinter ? '编辑打印机' : '添加打印机'"
      width="500px"
    >
      <el-form :model="form" label-width="80px">
        <el-form-item label="名称">
          <el-input v-model="form.name" placeholder="如：3楼-东区-HP" />
        </el-form-item>
        <el-form-item label="型号">
          <el-input v-model="form.model" placeholder="如：HP LaserJet Pro M404dn" />
        </el-form-item>
        <el-form-item label="IP 地址">
          <el-input v-model="form.ip" placeholder="如：192.168.1.200" />
        </el-form-item>
        <el-form-item label="位置">
          <el-input v-model="form.location" placeholder="如：3楼东区茶水间旁" />
        </el-form-item>
        <el-form-item label="墨量">
          <el-slider v-model="form.inkLevel" :min="0" :max="100" show-input />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio value="正常">正常</el-radio>
            <el-radio value="缺墨">缺墨</el-radio>
            <el-radio value="故障">故障</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="savePrinter">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { usePrintersStore } from '../stores/printers'
import type { Printer } from '../mock/printers'

const store = usePrintersStore()
const printers = store.printers

const dialogVisible = ref(false)
const editingPrinter = ref<Printer | null>(null)

const form = reactive({
  name: '',
  model: '',
  ip: '',
  location: '',
  inkLevel: 100,
  status: '正常'
})

function openAddDialog() {
  editingPrinter.value = null
  form.name = ''
  form.model = ''
  form.ip = ''
  form.location = ''
  form.inkLevel = 100
  form.status = '正常'
  dialogVisible.value = true
}

function openEditDialog(row: Printer) {
  editingPrinter.value = row
  form.name = row.name
  form.model = row.model
  form.ip = row.ip
  form.location = row.location
  form.inkLevel = row.inkLevel
  form.status = row.status
  dialogVisible.value = true
}

function savePrinter() {
  if (editingPrinter.value) {
    store.updatePrinter(editingPrinter.value.id, { ...form })
  } else {
    const maxId = store.printers.reduce((max, p) => Math.max(max, p.id), 0)
    store.addPrinter({ id: maxId + 1, ...form } as Printer)
  }
  dialogVisible.value = false
}

function deletePrinter(id: number) {
  store.deletePrinter(id)
}
</script>

<style scoped>
.printers-page {
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

.printer-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 16px;
}

.printer-card {
  transition: transform 0.2s;
}
.printer-card:hover {
  transform: translateY(-2px);
}

.printer-top {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.printer-icon {
  width: 64px;
  height: 64px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.printer-icon.ok { background: #f0f9eb; color: #67c23a; }
.printer-icon.warn { background: #fdf6ec; color: #e6a23c; }
.printer-icon.err { background: #fef0f0; color: #f56c6c; }

.printer-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.printer-name {
  font-size: 15px;
  font-weight: 600;
  color: #333;
}

.printer-model {
  font-size: 12px;
  color: #999;
}

.printer-ip {
  font-size: 12px;
  color: #1890ff;
  font-family: monospace;
}

.printer-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-top: 1px solid #f0f0f0;
  border-bottom: 1px solid #f0f0f0;
  margin-bottom: 12px;
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.meta-label {
  font-size: 12px;
  color: #999;
}

.meta-value {
  font-size: 13px;
  color: #333;
}

.printer-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
