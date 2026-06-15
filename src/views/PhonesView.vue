<template>
  <div class="phones-page">
    <!-- 顶部栏 -->
    <div class="top-bar">
      <button class="back-btn" @click="$router.push('/')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        <span>返回</span>
      </button>
      <h3>话机管理</h3>
      <div class="top-right">
        <el-input v-model="searchText" size="small" placeholder="搜索分机号 / IP" clearable class="search-input">
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-button size="small" @click="loadDevices(true)" :loading="loading">
          <el-icon><Refresh /></el-icon> 刷新
        </el-button>
        <el-button size="small" @click="$router.push('/phonebook')">电话簿</el-button>
      </div>
    </div>

    <!-- 统计条 -->
    <div class="stats-bar">
      <span class="stat"><b>{{ total }}</b> 总计</span>
      <span class="stat"><b class="green">{{ onlineCount }}</b> 在线</span>
      <span class="stat"><b class="gray">{{ offlineCount }}</b> 离线</span>
    </div>

    <!-- 错误 -->
    <el-alert v-if="errorMsg" :title="errorMsg" type="error" show-icon closable @close="errorMsg = ''" style="margin-bottom:12px" />

    <!-- 表格 -->
    <div class="table-box">
      <el-table :data="filteredDevices" stripe size="default" v-loading="loading && !devices.length" style="width:100%"
        :header-cell-style="{ background:'var(--ops-bg-card-hover)', color:'var(--ops-text-secondary)', fontWeight:'500', fontSize:'13px' }"
        :cell-style="{ fontSize:'13px' }">
        <el-table-column label="分机号" width="100" fixed>
          <template #default="{ row }"><span class="ext">{{ row.extension }}</span></template>
        </el-table-column>
        <el-table-column label="IP 地址" width="140">
          <template #default="{ row }"><span v-if="row.ip" class="mono">{{ row.ip }}</span><span v-else class="muted">--</span></template>
        </el-table-column>
        <el-table-column label="上次IP" width="140">
          <template #default="{ row }">
            <span v-if="!row.ip && row.lastIp" class="mono" style="color:var(--ops-accent-yellow)">{{ row.lastIp }}</span>
            <span v-else-if="row.lastIp && row.lastIp !== row.ip" class="mono" style="color:var(--ops-text-tertiary);font-size:11px">{{ row.lastIp }}</span>
            <span v-else class="muted">--</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <span :class="row.online ? 'dot green' : 'dot gray'"></span>
            {{ row.online ? row.status : '离线' }}
          </template>
        </el-table-column>
        <el-table-column label="注册" width="90">
          <template #default="{ row }">
            <span v-if="row.registered === 'Avail'" class="green">已注册</span>
            <span v-else class="muted">--</span>
          </template>
        </el-table-column>
        <el-table-column label="延迟" width="90">
          <template #default="{ row }">
            <span v-if="row.delay !== 'n/a'" class="mono" :class="{ yellow: parseFloat(row.delay) > 50 }">{{ row.delay }}ms</span>
            <span v-else class="muted">--</span>
          </template>
        </el-table-column>
        <el-table-column label="SIP 地址" min-width="180">
          <template #default="{ row }">
            <span v-if="row.address !== 'n/a'" class="mono small">{{ row.address }}</span>
            <span v-else class="muted">--</span>
          </template>
        </el-table-column>
        <el-table-column label="" width="120" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" :disabled="!row.online" @click="openDetail(row)">详情</el-button>
            <el-button link type="primary" size="small" :disabled="!row.ip" @click="openWeb(row.ip)">访问</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 空状态 -->
    <div v-if="!loading && devices.length === 0 && !errorMsg" class="empty">
      <el-icon :size="40"><Phone /></el-icon>
      <p>未发现设备，请检查 PBX 配置或点击刷新</p>
    </div>

    <!-- 详情抽屉 -->
    <el-drawer v-model="drawerVisible" :title="`话机详情 — ${selectedPhone?.extension || ''}`" size="480px" destroy-on-close>
      <div v-if="detailLoading" v-loading="true" style="height:200px"></div>
      <template v-else-if="detail">
        <div class="detail-section">
          <div class="detail-title">📦 基本信息</div>
          <div class="detail-row"><span class="detail-label">分机号</span><span class="detail-value">{{ selectedPhone?.extension }}</span></div>
          <div class="detail-row"><span class="detail-label">IP 地址</span><span class="detail-value mono">{{ selectedPhone?.ip || '—' }}</span></div>
          <div class="detail-row"><span class="detail-label">MAC 地址</span><span class="detail-value mono">{{ detail.status?.wiredMac || '—' }}</span></div>
          <div class="detail-row"><span class="detail-label">产品型号</span><span class="detail-value">{{ detail.status?.product_name || '—' }}</span></div>
          <div class="detail-row"><span class="detail-label">固件版本</span><span class="detail-value">{{ detail.status?.fmVer || '—' }}</span></div>
          <div class="detail-row"><span class="detail-label">硬件版本</span><span class="detail-value">{{ detail.status?.hdVer || '—' }}</span></div>
          <div class="detail-row"><span class="detail-label">注册状态</span><span class="detail-value">{{ selectedPhone?.registered || '—' }}</span></div>
          <div class="detail-row"><span class="detail-label">延迟</span><span class="detail-value">{{ selectedPhone?.delay || '—' }}</span></div>
        </div>
        <div class="detail-section">
          <div class="detail-title">📞 账号配置 <el-button v-if="!editing" link type="primary" size="small" @click="startEdit">编辑</el-button></div>
          <template v-if="editing">
            <div class="form-row"><span class="form-label">SIP 服务器</span><el-input v-model="editForm.sipServer" size="small" style="width:200px" /></div>
            <div class="form-row"><span class="form-label">服务器端口</span><el-input v-model="editForm.sipServerPort" size="small" style="width:200px" /></div>
            <div class="form-row"><span class="form-label">用户名</span><el-input v-model="editForm.userName" size="small" style="width:200px" /></div>
            <div class="form-row"><span class="form-label">密码</span><el-input v-model="editForm.password" size="small" type="password" show-password style="width:200px" /></div>
            <div class="form-row"><span class="form-label">显示名称</span><el-input v-model="editForm.displayName" size="small" style="width:200px" /></div>
            <div class="form-row"><span class="form-label">注册名</span><el-input v-model="editForm.registerName" size="small" style="width:200px" /></div>
            <div class="form-row"><span class="form-label">传输协议</span>
              <el-select v-model="editForm.transport" size="small" style="width:200px">
                <el-option label="UDP" value="1" /><el-option label="TCP" value="2" /><el-option label="TLS" value="3" />
              </el-select>
            </div>
            <div class="form-row"><span class="form-label">NAT 穿越</span>
              <el-select v-model="editForm.natTraversal" size="small" style="width:200px">
                <el-option label="关闭" value="0" /><el-option label="开启" value="1" />
              </el-select>
            </div>
            <div class="form-row"><span class="form-label">语音信箱</span><el-input v-model="editForm.voiceMail" size="small" style="width:200px" /></div>
            <div style="margin-top:12px;display:flex;gap:8px">
              <el-button type="primary" size="small" @click="saveAccount" :loading="saving">保存并同步</el-button>
              <el-button size="small" @click="editing = false">取消</el-button>
            </div>
          </template>
          <template v-else>
            <div class="detail-row"><span class="detail-label">SIP 服务器</span><span class="detail-value mono">{{ detail.account?.sipServer || '—' }}:{{ detail.account?.sipServerPort || '5060' }}</span></div>
            <div class="detail-row"><span class="detail-label">用户名</span><span class="detail-value mono">{{ detail.account?.userName || '—' }}</span></div>
            <div class="detail-row"><span class="detail-label">显示名称</span><span class="detail-value">{{ detail.account?.displayName || '—' }}</span></div>
            <div class="detail-row"><span class="detail-label">传输协议</span><span class="detail-value">{{ ['—','UDP','TCP','TLS'][Number(detail.account?.transport)] || detail.account?.transport || '—' }}</span></div>
            <div class="detail-row"><span class="detail-label">NAT 穿越</span><span class="detail-value">{{ detail.account?.natTraversal === '1' ? '开启' : detail.account?.natTraversal === '0' ? '关闭' : detail.account?.natTraversal || '—' }}</span></div>
            <div class="detail-row"><span class="detail-label">语音信箱</span><span class="detail-value">{{ detail.account?.voiceMail || '—' }}</span></div>
          </template>
        </div>
      </template>
      <div v-else style="text-align:center;padding:40px;color:var(--ops-text-tertiary)">无法获取详情</div>
      <template #footer>
        <div style="display:flex;gap:8px">
          <el-button type="danger" plain size="small" @click="rebootPhone" :disabled="!selectedPhone?.online">重启话机</el-button>
          <div style="flex:1"></div>
          <el-button size="small" @click="drawerVisible = false">关闭</el-button>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Refresh, Phone, Search } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { fetchPhones } from '@/api/phones'

const loading = ref(false)
const searchText = ref('')
const devices = ref<any[]>([])
const errorMsg = ref('')
const total = ref(0)
const onlineCount = ref(0)
const offlineCount = ref(0)

// 详情抽屉
const drawerVisible = ref(false)
const selectedPhone = ref<any>(null)
const detailLoading = ref(false)
const detail = ref<any>(null)

async function openDetail(phone: any) {
  selectedPhone.value = phone
  drawerVisible.value = true
  detailLoading.value = true
  detail.value = null
  editing.value = false
  try {
    const res = await fetch(`/api/v1/phones/${phone.id}/details`).then(r => r.json())
    if (res.code === 200) detail.value = res.data
  } catch { detail.value = null }
  finally { detailLoading.value = false }
}

// 账号配置编辑
const editing = ref(false)
const saving = ref(false)
const editForm = ref<any>({})

function startEdit() {
  const acc = detail.value?.account || {}
  editForm.value = {
    sipServer: acc.sipServer || '',
    sipServerPort: acc.sipServerPort || '5060',
    userName: acc.userName || '',
    password: '',
    displayName: acc.displayName || '',
    registerName: acc.registerName || '',
    transport: String(acc.transport ?? '0'),
    natTraversal: String(acc.natTraversal ?? '0'),
    voiceMail: acc.voiceMail || '',
  }
  editing.value = true
}

async function saveAccount() {
  saving.value = true
  try {
    const res = await fetch(`/api/v1/phones/${selectedPhone.value.id}/account`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm.value),
    }).then(r => r.json())
    if (res.code === 200) { ElMessage.success('配置已同步到话机'); editing.value = false; openDetail(selectedPhone.value) }
    else ElMessage.error(res.message || '同步失败')
  } catch (e: any) { ElMessage.error(e.message || '同步失败') }
  finally { saving.value = false }
}

async function rebootPhone() {
  try {
    await ElMessageBox.confirm(`确定重启话机 ${selectedPhone.value.extension}？`, '重启确认', { type: 'warning' })
  } catch { return }
  try {
    const res = await fetch(`/api/v1/phones/${selectedPhone.value.id}/reboot`, { method: 'POST' }).then(r => r.json())
    if (res.code === 200) ElMessage.success('重启指令已发送')
    else ElMessage.error(res.message)
  } catch (e: any) { ElMessage.error(e.message || '重启失败') }
}

const filteredDevices = computed(() => {
  if (!searchText.value) return devices.value
  const q = searchText.value.toLowerCase()
  return devices.value.filter(d =>
    d.extension?.toLowerCase().includes(q) ||
    d.ip?.toLowerCase().includes(q)
  )
})

const CACHE_KEY = 'opshub_phones_cache'
const CACHE_TTL = 30 * 60 * 1000 // 30 分钟

async function loadDevices(force = false) {
  // 先尝试缓存
  if (!force) {
    try {
      const cached = localStorage.getItem(CACHE_KEY)
      if (cached) {
        const { data, ts } = JSON.parse(cached)
        if (Date.now() - ts < CACHE_TTL && data) {
          devices.value = data.devices || []
          total.value = data.total || 0
          onlineCount.value = data.online || 0
          offlineCount.value = data.offline || 0
          return
        }
      }
    } catch {}
  }

  loading.value = true
  errorMsg.value = ''
  try {
    const res = await fetchPhones()
    if (res.code === 200) {
      devices.value = res.data
      total.value = res.total
      onlineCount.value = res.online
      offlineCount.value = res.offline
      // 写入缓存
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: { devices: res.data, total: res.total, online: res.online, offline: res.offline } }))
      } catch {}
    } else {
      errorMsg.value = res.message || '获取设备失败'
    }
  } catch (err: any) {
    errorMsg.value = err.message || '无法连接后端服务'
  } finally {
    loading.value = false
  }
}

function openWeb(ip: string) {
  if (ip) window.open(`http://${ip}`, '_blank')
}

onMounted(() => { loadDevices() })
</script>

<style scoped>
.phones-page {
  padding: 16px 20px;
  min-height: 100vh;
  background: var(--ops-bg-page);
  color: var(--ops-text-primary);
}

/* 顶部栏 */
.top-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}
.top-bar h3 {
  margin: 0;
  flex: 1;
  font-size: 15px;
  font-weight: 600;
}
.top-right {
  display: flex;
  gap: 8px;
  align-items: center;
}
.search-input { width: 170px; }

.back-btn {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 6px 14px 6px 10px;
  background: var(--ops-bg-card-hover);
  border: 1px solid var(--ops-border-card);
  border-radius: 20px;
  color: var(--ops-text-secondary);
  cursor: pointer; font-size: 12px; font-family: inherit;
  transition: all 0.2s ease;
}
.back-btn svg { transition: transform 0.2s ease; }
.back-btn:hover { color: var(--ops-accent-blue); border-color: rgba(88,166,255,0.3); }
.back-btn:hover svg { transform: translateX(-2px); }

/* 统计条 */
.stats-bar {
  display: flex;
  gap: 20px;
  margin-bottom: 12px;
  font-size: 13px;
  color: var(--ops-text-tertiary);
}
.stats-bar b {
  font-size: 16px;
  margin-right: 3px;
}

/* 表格容器 */
.table-box {
  background: var(--ops-bg-card);
  border: 1px solid var(--ops-border-card);
  border-radius: 8px;
  overflow: hidden;
}

/* 状态点 */
.dot {
  display: inline-block;
  width: 6px; height: 6px;
  border-radius: 50%;
  margin-right: 5px;
  vertical-align: middle;
}
.dot.green { background: var(--ops-accent-green); }
.dot.gray { background: var(--ops-text-tertiary); }

/* 文字 */
.ext { font-weight: 600; color: var(--ops-accent-blue); }
.mono { font-family: 'SF Mono', Consolas, monospace; font-size: 12px; }
.small { font-size: 11px; }
.green { color: var(--ops-accent-green); }
.gray { color: var(--ops-text-tertiary); }
.yellow { color: var(--ops-accent-yellow); }
.muted { color: var(--ops-text-tertiary); }

/* 空状态 */
.empty {
  text-align: center;
  padding: 48px 24px;
  color: var(--ops-text-tertiary);
}
.empty p { margin: 8px 0 0; font-size: 13px; }

/* 详情抽屉 */
.detail-section {
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--ops-border-card);
}
.detail-section:last-child { border-bottom: none; }
.detail-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 12px;
  color: var(--ops-text-primary);
}
.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 4px 0;
  font-size: 13px;
}
.detail-label {
  color: var(--ops-text-tertiary);
  flex-shrink: 0;
  margin-right: 12px;
}
.detail-value {
  color: var(--ops-text-primary);
  text-align: right;
  word-break: break-all;
}

/* 编辑表单 */
.form-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}
.form-label {
  width: 80px;
  flex-shrink: 0;
  font-size: 13px;
  color: var(--ops-text-secondary);
  text-align: right;
}
</style>
