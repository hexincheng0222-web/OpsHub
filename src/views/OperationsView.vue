<template>
  <div class="operations-page">
    <div class="top-bar">
      <span class="back-btn" @click="$router.push('/')">
        <el-icon><ArrowLeft /></el-icon> 返回首页
      </span>
      <h3>系统运维操作</h3>
      <el-button type="primary" @click="openCreateDialog">
        <el-icon><Plus /></el-icon> 新建工单
      </el-button>
    </div>

    <!-- 工单列表 — 钉钉流程卡片风格 -->
    <div class="ticket-list">
      <el-card
        v-for="ticket in tickets"
        :key="ticket.id"
        class="ticket-card"
        shadow="hover"
        @click="openDetail(ticket)"
      >
        <div class="ticket-header">
          <span class="ticket-title">{{ ticket.title }}</span>
          <el-tag :type="statusTagType(ticket.status)" size="small" effect="dark">
            {{ ticket.status }}
          </el-tag>
        </div>

        <!-- 步骤进度条 -->
        <div class="ticket-steps">
          <div
            v-for="(step, idx) in ticket.steps"
            :key="idx"
            class="step-item"
            :class="{
              done: idx < ticket.currentStep,
              active: idx === ticket.currentStep,
              pending: idx > ticket.currentStep
            }"
          >
            <div class="step-dot">
              <el-icon v-if="idx < ticket.currentStep"><Check /></el-icon>
              <span v-else>{{ idx + 1 }}</span>
            </div>
            <span class="step-label">{{ step }}</span>
            <div v-if="idx < ticket.steps.length - 1" class="step-line" :class="{ done: idx < ticket.currentStep }" />
          </div>
        </div>

        <div class="ticket-footer">
          <span><el-icon><User /></el-icon> {{ ticket.creator }}</span>
          <span>{{ ticket.createTime }}</span>
        </div>
      </el-card>
    </div>

    <!-- 工单详情抽屉 -->
    <el-drawer v-model="detailVisible" title="工单详情" size="500px">
      <template v-if="currentTicket">
        <div class="detail-title">{{ currentTicket.title }}</div>
        <el-descriptions :column="1" border style="margin: 16px 0">
          <el-descriptions-item label="发起人">{{ currentTicket.creator }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ currentTicket.createTime }}</el-descriptions-item>
          <el-descriptions-item label="当前状态">
            <el-tag :type="statusTagType(currentTicket.status)" size="small" effect="dark">
              {{ currentTicket.status }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="操作内容">{{ currentTicket.content }}</el-descriptions-item>
        </el-descriptions>

        <!-- 详细步骤 -->
        <el-steps :active="currentTicket.currentStep" finish-status="success" direction="vertical">
          <el-step
            v-for="(step, idx) in currentTicket.steps"
            :key="idx"
            :title="step"
            :description="idx === currentTicket.currentStep && currentTicket.status === '进行中' ? '正在处理...' : ''"
          />
        </el-steps>
      </template>
    </el-drawer>

    <!-- 新建工单 -->
    <el-dialog v-model="createVisible" title="新建运维工单" width="520px">
      <el-form :model="newForm" label-width="80px">
        <el-form-item label="工单标题">
          <el-input v-model="newForm.title" placeholder="如：生产环境 Nginx 配置更新" />
        </el-form-item>
        <el-form-item label="操作内容">
          <el-input v-model="newForm.content" type="textarea" :rows="3" placeholder="详细描述本次运维操作内容" />
        </el-form-item>
        <el-form-item label="发起人">
          <el-input v-model="newForm.creator" placeholder="输入姓名" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" @click="createTicket">提交工单</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useOperationsStore } from '../stores/operations'
import type { Ticket } from '../mock/operations'

const store = useOperationsStore()
const tickets = store.tickets

const detailVisible = ref(false)
const currentTicket = ref<Ticket | null>(null)
const createVisible = ref(false)

const newForm = reactive({
  title: '',
  content: '',
  creator: ''
})

function openDetail(ticket: Ticket) {
  currentTicket.value = ticket
  detailVisible.value = true
}

function openCreateDialog() {
  newForm.title = ''
  newForm.content = ''
  newForm.creator = ''
  createVisible.value = true
}

function createTicket() {
  const now = new Date()
  store.addTicket({
    id: Date.now(),
    title: newForm.title,
    content: newForm.content,
    creator: newForm.creator || '匿名',
    createTime: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
    status: '审批中',
    currentStep: 1,
    steps: ['发起', '审批', '执行', '验收', '完成']
  })
  createVisible.value = false
}

function statusTagType(status: string) {
  switch (status) {
    case '已完成': return 'success'
    case '进行中': return ''
    case '审批中': return 'warning'
    default: return 'info'
  }
}
</script>

<style scoped>
.operations-page {
  max-width: 1000px;
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

.ticket-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.ticket-card {
  cursor: pointer;
  transition: transform 0.2s;
}
.ticket-card:hover {
  transform: translateY(-2px);
}

.ticket-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.ticket-title {
  font-size: 15px;
  font-weight: 600;
  color: #333;
}

/* 步骤条 */
.ticket-steps {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.step-item {
  display: flex;
  align-items: center;
  flex: 1;
}

.step-dot {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
  transition: all 0.3s;
}

.step-item.done .step-dot {
  background: #52c41a;
  color: #fff;
}
.step-item.active .step-dot {
  background: #1890ff;
  color: #fff;
}
.step-item.pending .step-dot {
  background: #f0f0f0;
  color: #999;
}

.step-label {
  font-size: 12px;
  color: #666;
  margin-left: 6px;
  white-space: nowrap;
}

.step-line {
  flex: 1;
  height: 2px;
  background: #f0f0f0;
  margin: 0 4px;
}
.step-line.done {
  background: #52c41a;
}

.ticket-footer {
  display: flex;
  align-items: center;
  gap: 24px;
  font-size: 12px;
  color: #999;
}

.ticket-footer .el-icon {
  margin-right: 4px;
}

.detail-title {
  font-size: 18px;
  font-weight: 600;
  color: #333;
}
</style>
