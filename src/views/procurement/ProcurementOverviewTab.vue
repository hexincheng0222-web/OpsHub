<template>
  <div class="overview-page">
    <!-- KPI 卡片 -->
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-icon">🖥</div>
        <div class="kpi-body">
          <div class="kpi-label">电脑采购总数</div>
          <div class="kpi-value">{{ computerStore.computers.length }}<span class="kpi-unit">台</span></div>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon">📱</div>
        <div class="kpi-body">
          <div class="kpi-label">手机采购总数</div>
          <div class="kpi-value">{{ phoneStore.phones.length }}<span class="kpi-unit">台</span></div>
        </div>
      </div>
      <div class="kpi-card kpi-highlight">
        <div class="kpi-icon">💰</div>
        <div class="kpi-body">
          <div class="kpi-label">电脑采购总额</div>
          <div class="kpi-value">¥{{ totalComputerPrice.toLocaleString() }}</div>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon">📊</div>
        <div class="kpi-body">
          <div class="kpi-label">本月新增</div>
          <div class="kpi-value">{{ thisMonthCount }}<span class="kpi-unit">台</span></div>
        </div>
      </div>
    </div>

    <!-- 两栏分布 -->
    <div class="overview-grid">
      <!-- 各部门采购占比 -->
      <div class="overview-card">
        <div class="card-header">各部门采购占比</div>
        <div class="card-body">
          <div v-if="departmentStats.length === 0" class="empty">暂无数据</div>
          <div v-for="dept in departmentStats" :key="dept.name" class="stat-row">
            <div class="stat-label">{{ dept.name }}</div>
            <div class="stat-bar-wrap">
              <div class="stat-bar" :style="{ width: dept.percent + '%' }"></div>
            </div>
            <div class="stat-count">{{ dept.count }} 台</div>
          </div>
        </div>
      </div>

      <!-- 最近采购记录 -->
      <div class="overview-card">
        <div class="card-header">最近采购记录</div>
        <div class="card-body">
          <div v-if="recentRecords.length === 0" class="empty">暂无数据</div>
          <div v-for="rec in recentRecords" :key="rec.id + rec.type" class="recent-item">
            <span class="recent-icon">{{ rec.type === 'computer' ? '🖥' : '📱' }}</span>
            <div class="recent-body">
              <span class="recent-title">{{ rec.title }}</span>
              <span class="recent-meta">{{ rec.department }} · {{ rec.date }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useComputerProcurementStore } from '../../stores/procurement'
import { usePhoneProcurementStore } from '../../stores/procurement'

const computerStore = useComputerProcurementStore()
const phoneStore = usePhoneProcurementStore()

// 电脑采购总额
const totalComputerPrice = computed(() =>
  computerStore.computers.reduce((sum, c) => sum + (c.price || 0), 0)
)

// 本月新增数量（电脑 + 手机）
const thisMonthCount = computed(() => {
  const now = new Date()
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const cCount = computerStore.computers.filter(c => (c.receiveDate || '').startsWith(ym)).length
  const pCount = phoneStore.phones.filter(p => (p.arrivalDate || '').startsWith(ym)).length
  return cCount + pCount
})

// 各部门采购统计
const departmentStats = computed(() => {
  const map = new Map<string, number>()
  for (const c of computerStore.computers) {
    map.set(c.department, (map.get(c.department) || 0) + 1)
  }
  for (const p of phoneStore.phones) {
    map.set(p.department, (map.get(p.department) || 0) + 1)
  }
  const total = computerStore.computers.length + phoneStore.phones.length
  if (total === 0) return []
  return [...map.entries()]
    .map(([name, count]) => ({ name, count, percent: Math.round((count / total) * 100) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
})

// 最近采购记录（合并，按时间倒序）
const recentRecords = computed(() => {
  const computers = computerStore.computers
    .filter(c => c.receiveDate)
    .map(c => ({ id: c.id, type: 'computer' as const, title: c.model, department: c.department, date: c.receiveDate }))
  const phones = phoneStore.phones
    .filter(p => p.arrivalDate)
    .map(p => ({ id: p.id, type: 'phone' as const, title: `${p.brand} ${p.model}`, department: p.department, date: p.arrivalDate }))
  return [...computers, ...phones]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10)
})
</script>

<style scoped>
.overview-page {
  padding: 24px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* KPI 卡片 */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}
.kpi-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 20px;
  background: var(--ops-bg-card);
  border: 1px solid var(--ops-border-card);
  border-radius: 10px;
  transition: all 0.2s;
}
.kpi-card:hover {
  border-color: rgba(88,166,255,0.3);
  box-shadow: 0 2px 12px rgba(88,166,255,0.1);
}
.kpi-highlight {
  background: linear-gradient(135deg, rgba(88,166,255,0.08), transparent);
  border-color: rgba(88,166,255,0.2);
}
.kpi-icon { font-size: 28px; }
.kpi-body { flex: 1; }
.kpi-label { font-size: 12px; color: var(--ops-text-tertiary); margin-bottom: 4px; }
.kpi-value { font-size: 22px; font-weight: 700; color: var(--ops-text-primary); }
.kpi-unit { font-size: 13px; font-weight: 400; color: var(--ops-text-secondary); margin-left: 4px; }
.kpi-highlight .kpi-value { color: var(--ops-accent-blue); }

/* 两栏分布 */
.overview-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}
.overview-card {
  background: var(--ops-bg-card);
  border: 1px solid var(--ops-border-card);
  border-radius: 10px;
  overflow: hidden;
}
.card-header {
  font-size: 13px;
  font-weight: 600;
  color: var(--ops-text-primary);
  padding: 14px 18px;
  border-bottom: 1px solid var(--ops-border-card);
  background: rgba(88,166,255,0.04);
}
.card-body { padding: 14px 18px; }
.empty { text-align: center; color: var(--ops-text-tertiary); padding: 20px; font-size: 13px; }

/* 部门统计 */
.stat-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.stat-label {
  width: 80px;
  font-size: 12px;
  color: var(--ops-text-secondary);
  flex-shrink: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.stat-bar-wrap {
  flex: 1;
  height: 18px;
  background: var(--ops-bg-card-hover);
  border-radius: 4px;
  overflow: hidden;
}
.stat-bar {
  height: 100%;
  background: linear-gradient(90deg, rgba(88,166,255,0.6), rgba(88,166,255,0.9));
  border-radius: 4px;
  transition: width 0.3s;
  min-width: 4px;
}
.stat-count {
  width: 50px;
  text-align: right;
  font-size: 12px;
  color: var(--ops-text-tertiary);
  flex-shrink: 0;
}

/* 最近记录 */
.recent-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid var(--ops-border-card);
}
.recent-item:last-child { border-bottom: none; }
.recent-icon { font-size: 16px; }
.recent-body { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.recent-title { font-size: 13px; color: var(--ops-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.recent-meta { font-size: 11px; color: var(--ops-text-tertiary); }

@media (max-width: 900px) {
  .overview-grid { grid-template-columns: 1fr; }
}
</style>
