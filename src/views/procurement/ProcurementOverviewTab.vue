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
      <div class="kpi-card">
        <div class="kpi-icon">🔄</div>
        <div class="kpi-body">
          <div class="kpi-label">手机换机率</div>
          <div class="kpi-value">{{ phoneExchangeRate }}<span class="kpi-unit">%</span></div>
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
          <div
            v-for="rec in recentRecords"
            :key="rec.id + rec.type"
            class="recent-item clickable"
            @click="emit('jump', rec)"
          >
            <span class="recent-icon">{{ rec.type === 'computer' ? '🖥' : '📱' }}</span>
            <div class="recent-body">
              <span class="recent-title">{{ rec.title }}</span>
              <span class="recent-meta">{{ rec.department }} · {{ rec.date }}</span>
            </div>
            <span class="recent-action">查看 ↗</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 图表区（纯 SVG 自绘，无新依赖） -->
    <div class="chart-grid">
      <!-- 手机品牌占比环形图 -->
      <div class="overview-card">
        <div class="card-header">手机品牌占比</div>
        <div class="card-body chart-body">
          <div v-if="phoneBrandStats.length === 0" class="empty">暂无数据</div>
          <svg v-else viewBox="0 0 200 200" class="donut-svg">
            <circle cx="100" cy="100" r="60" fill="none" stroke="var(--ops-bg-card-hover)" stroke-width="28" />
            <path
              v-for="(b, i) in phoneBrandStats"
              :key="b.name"
              :d="donutArc(100, 100, 60, b.percent, phoneBrandStats.slice(0, i).reduce((s, x) => s + x.percent, 0))"
              fill="none"
              :stroke="DONUT_COLORS[i % DONUT_COLORS.length]"
              stroke-width="28"
            />
            <text x="100" y="105" text-anchor="middle" class="donut-center-text">{{ phoneStore.phones.length }}台</text>
          </svg>
          <div class="legend-list">
            <div v-for="(b, i) in phoneBrandStats" :key="b.name" class="legend-item">
              <span class="legend-dot" :style="{ background: DONUT_COLORS[i % DONUT_COLORS.length] }"></span>
              <span class="legend-label">{{ b.name }}</span>
              <span class="legend-value">{{ b.count }}（{{ Math.round(b.percent * 100) }}%）</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 电脑型号 TOP10 柱状图 -->
      <div class="overview-card">
        <div class="card-header">电脑型号 TOP10</div>
        <div class="card-body chart-body">
          <div v-if="computerModelTop.length === 0" class="empty">暂无数据</div>
          <div v-else class="bar-chart">
            <div v-for="m in computerModelTop" :key="m.name" class="bar-row">
              <div class="bar-label" :title="m.name">{{ m.name }}</div>
              <div class="bar-track">
                <div class="bar-fill" :style="{ width: (m.count / computerModelTop[0].count * 100) + '%' }"></div>
              </div>
              <div class="bar-count">{{ m.count }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 近 6 月趋势折线图 -->
      <div class="overview-card chart-wide">
        <div class="card-header">近 6 个月采购趋势</div>
        <div class="card-body chart-body">
          <div v-if="monthTrend.every(m => m.count === 0)" class="empty">暂无数据</div>
          <svg v-else viewBox="0 0 300 120" class="trend-svg">
            <polyline
              :points="monthTrend.map((m, i) => `${i * 50 + 25},${100 - (m.count / Math.max(...monthTrend.map(x => x.count)) * 80)}`).join(' ')"
              fill="none"
              stroke="var(--ops-accent-blue)"
              stroke-width="2"
            />
            <circle
              v-for="(m, i) in monthTrend"
              :key="m.ym"
              :cx="i * 50 + 25"
              :cy="100 - (m.count / Math.max(...monthTrend.map(x => x.count)) * 80)"
              r="3"
              fill="var(--ops-accent-blue)"
            />
            <text
              v-for="(m, i) in monthTrend"
              :key="m.ym"
              :x="i * 50 + 25"
              y="115"
              text-anchor="middle"
              class="trend-label"
            >{{ m.label }}</text>
          </svg>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useComputerProcurementStore } from '../../stores/procurement'
import { usePhoneProcurementStore } from '../../stores/procurement'

const emit = defineEmits<{
  (e: 'jump', rec: { id: number; type: 'computer' | 'phone' }): void
}>()

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

// 手机换机率：换 / (换 + 新购) × 100%
const phoneExchangeRate = computed(() => {
  const total = phoneStore.phones.length
  if (total === 0) return 0
  const exchange = phoneStore.phones.filter(p => p.purchaseType === '换').length
  return Math.round((exchange / total) * 100)
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

// 手机品牌占比（环形图）
const phoneBrandStats = computed(() => {
  const map = new Map<string, number>()
  for (const p of phoneStore.phones) map.set(p.brand, (map.get(p.brand) || 0) + 1)
  const total = phoneStore.phones.length
  if (total === 0) return []
  return [...map.entries()]
    .map(([name, count]) => ({ name, count, percent: count / total }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)
})

// 电脑采购型号 TOP10（柱状图）
const computerModelTop = computed(() => {
  const map = new Map<string, number>()
  for (const c of computerStore.computers) map.set(c.model, (map.get(c.model) || 0) + 1)
  if (map.size === 0) return []
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
})

// 近 6 个月采购趋势（折线图，电脑+手机合并按月）
const monthTrend = computed(() => {
  const now = new Date()
  const months: { label: string; ym: string; count: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = `${String(d.getMonth() + 1).padStart(2, '0')}月`
    months.push({ label, ym, count: 0 })
  }
  for (const c of computerStore.computers) {
    const ym = (c.receiveDate || '').slice(0, 7)
    const m = months.find(x => x.ym === ym)
    if (m) m.count++
  }
  for (const p of phoneStore.phones) {
    const ym = (p.arrivalDate || '').slice(0, 7)
    const m = months.find(x => x.ym === ym)
    if (m) m.count++
  }
  return months
})

// SVG 环形图扇形路径生成（cx,cy=圆心 r=半径 percent=0~1 offset=起始角度比例）
function donutArc(cx: number, cy: number, r: number, percent: number, offset: number) {
  const start = offset * 2 * Math.PI - Math.PI / 2
  const end = (offset + percent) * 2 * Math.PI - Math.PI / 2
  const x1 = cx + r * Math.cos(start), y1 = cy + r * Math.sin(start)
  const x2 = cx + r * Math.cos(end), y2 = cy + r * Math.sin(end)
  const large = percent > 0.5 ? 1 : 0
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`
}
const DONUT_COLORS = ['#5b8ff9', '#5ad8a6', '#5d709', '#f1bd3a', '#e8684a', '#6dc8ec']
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
.recent-item.clickable { cursor: pointer; transition: background 0.15s; border-radius: 6px; padding: 8px 10px; margin: 0 -10px; }
.recent-item.clickable:hover { background: var(--ops-bg-card-hover); }
.recent-item.clickable:hover .recent-title { color: var(--ops-accent-blue); }
.recent-item.clickable:hover .recent-action { opacity: 1; }
.recent-action { font-size: 12px; color: var(--ops-accent-blue); opacity: 0; transition: opacity 0.15s; flex-shrink: 0; }

@media (max-width: 900px) {
  .overview-grid { grid-template-columns: 1fr; }
}

/* 图表区 */
.chart-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 2fr;
  gap: 20px;
}
.chart-wide { grid-column: span 1; }
.chart-body { padding: 14px 18px; }
.donut-svg { width: 140px; height: 140px; display: block; margin: 0 auto 8px; }
.donut-center-text { font-size: 16px; font-weight: 700; fill: var(--ops-text-primary); }
.legend-list { display: flex; flex-direction: column; gap: 4px; }
.legend-item { display: flex; align-items: center; gap: 6px; font-size: 12px; }
.legend-dot { width: 10px; height: 10px; border-radius: 2px; flex-shrink: 0; }
.legend-label { color: var(--ops-text-secondary); flex: 1; }
.legend-value { color: var(--ops-text-tertiary); }
.bar-chart { display: flex; flex-direction: column; gap: 6px; }
.bar-row { display: flex; align-items: center; gap: 8px; }
.bar-label { width: 80px; font-size: 11px; color: var(--ops-text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex-shrink: 0; }
.bar-track { flex: 1; height: 16px; background: var(--ops-bg-card-hover); border-radius: 3px; overflow: hidden; }
.bar-fill { height: 100%; background: linear-gradient(90deg, rgba(88,166,255,0.6), rgba(88,166,255,0.9)); border-radius: 3px; transition: width 0.3s; min-width: 2px; }
.bar-count { width: 24px; text-align: right; font-size: 11px; color: var(--ops-text-tertiary); flex-shrink: 0; }
.trend-svg { width: 100%; height: 120px; display: block; }
.trend-label { font-size: 10px; fill: var(--ops-text-tertiary); }

@media (max-width: 900px) {
  .chart-grid { grid-template-columns: 1fr; }
}
</style>
