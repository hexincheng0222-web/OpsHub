<template>
  <div class="phones-page">
    <!-- 顶部栏 -->
    <div class="top-bar">
      <BackButton to="/" />
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
        <el-table-column label="备注" min-width="120" show-overflow-tooltip>
          <template #default="{ row }"><span :class="{ muted: !row.remark }">{{ row.remark || '--' }}</span></template>
        </el-table-column>
        <el-table-column label="IP 地址" min-width="160">
          <template #default="{ row }"><span v-if="row.ip" class="mono">{{ row.ip }}</span><span v-else class="muted">--</span></template>
        </el-table-column>
        <el-table-column label="上次IP" min-width="120">
          <template #default="{ row }">
            <span v-if="!row.ip && row.lastIp" class="mono" style="color:var(--ops-accent-yellow)">{{ row.lastIp }}</span>
            <span v-else-if="row.lastIp && row.lastIp !== row.ip" class="mono muted small">{{ row.lastIp }}</span>
            <span v-else class="muted">--</span>
          </template>
        </el-table-column>
        <el-table-column label="状态/注册" width="120">
          <template #default="{ row }">
            <template v-if="row.online">
              <span class="dot green"></span>
              <span>{{ row.status }}</span>
              <span class="registered-tag" v-if="row.registered === 'Avail'">已注册</span>
            </template>
            <template v-else-if="row.registered === 'Avail'">
              <span class="dot yellow"></span>
              <span class="muted">已注册</span>
            </template>
            <template v-else>
              <span class="dot gray"></span>
              <span class="muted">离线</span>
            </template>
          </template>
        </el-table-column>
        <el-table-column label="延迟" width="90">
          <template #default="{ row }">
            <span v-if="row.delay && row.delay !== 'n/a' && !isNaN(parseFloat(row.delay))" class="mono" :class="{ yellow: parseFloat(row.delay) > 50 }">{{ row.delay }}ms</span>
            <span v-else class="muted">--</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
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
          <div class="detail-title">📝 备注 <el-button v-if="!remarkEditing" link type="primary" size="small" @click="startRemarkEdit">编辑</el-button></div>
          <template v-if="remarkEditing">
            <el-input v-model="remarkForm" type="textarea" :rows="2" maxlength="200" show-word-limit size="small" />
            <div style="margin-top:8px;display:flex;gap:8px">
              <el-button type="primary" size="small" @click="saveRemark" :loading="remarkSaving">保存</el-button>
              <el-button size="small" @click="remarkEditing = false">取消</el-button>
            </div>
          </template>
          <template v-else>
            <div class="detail-row"><span class="detail-label">备注内容</span><span class="detail-value" :class="{ muted: !selectedPhone?.remark }">{{ selectedPhone?.remark || '—' }}</span></div>
          </template>
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
          <el-button type="danger" plain size="small" @click="handleRebootPhone" :disabled="!selectedPhone?.online">重启话机</el-button>
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
import { fetchPhones, fetchPhoneDetail, updatePhoneAccount, updatePhoneRemark, rebootPhone as rebootPhoneApi } from '@/api/phones'
import { request } from '@/utils/http'
import BackButton from '../components/BackButton.vue'

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
    const data = await fetchPhoneDetail(phone.id)
    detail.value = data
  } catch { detail.value = null }
  finally { detailLoading.value = false }
}

// 备注编辑
const remarkEditing = ref(false)
const remarkSaving = ref(false)
const remarkForm = ref('')

function startRemarkEdit() {
  remarkForm.value = selectedPhone.value?.remark || ''
  remarkEditing.value = true
}

async function saveRemark() {
  remarkSaving.value = true
  try {
    await updatePhoneRemark(selectedPhone.value.id, remarkForm.value)
    // 更新选中话机对象 + 表格对应行的 remark
    selectedPhone.value.remark = remarkForm.value
    const row = devices.value.find((d: any) => d.id === selectedPhone.value.id)
    if (row) row.remark = remarkForm.value
    remarkEditing.value = false
    ElMessage.success('备注已保存')
    // 记录操作日志（不影响主流程）
    request('/api/v1/admin/logs', { method: 'POST', body: JSON.stringify({ module: 'phones', action: 'update_remark', detail: `话机 ${selectedPhone.value.extension} 备注已更新` }) }).catch(() => {})
  } catch (e: any) {
    ElMessage.error(e.message || '保存失败')
  } finally {
    remarkSaving.value = false
  }
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
  // 前置校验
  const port = parseInt(editForm.value.sipServerPort)
  if (isNaN(port) || port < 1 || port > 65535) {
    ElMessage.warning('服务器端口范围为 1-65535')
    return
  }
  if (editForm.value.userName && !editForm.value.sipServer) {
    ElMessage.warning('填写用户名后必须填写 SIP 服务器')
    return
  }

  saving.value = true
  try {
    await updatePhoneAccount(selectedPhone.value.id, editForm.value)
    ElMessage.success('配置已同步到话机')
    // 记录操作日志（不影响主流程）
    request('/api/v1/admin/logs', { method: 'POST', body: JSON.stringify({ module: 'phones', action: 'update_account', detail: `话机 ${selectedPhone.value.extension} 配置已更新` }) }).catch(() => {})
    editing.value = false
    openDetail(selectedPhone.value)
  } catch (e: any) { ElMessage.error(e.message || '同步失败') }
  finally { saving.value = false }
}

async function handleRebootPhone() {
  try {
    await ElMessageBox.confirm(`确定重启话机 ${selectedPhone.value.extension}？`, '重启确认', { type: 'warning' })
  } catch { return }
  try {
    await rebootPhoneApi(selectedPhone.value.id)
    ElMessage.success('重启指令已发送')
    // 记录操作日志
    request('/api/v1/admin/logs', { method: 'POST', body: JSON.stringify({ module: 'phones', action: 'reboot', detail: `话机 ${selectedPhone.value.extension} 已重启` }) }).catch(() => {})
  } catch (e: any) { ElMessage.error(e.message || '重启失败') }
}

const filteredDevices = computed(() => {
  if (!searchText.value) return devices.value
  const q = searchText.value.toLowerCase()
  return devices.value.filter(d =>
    d.extension?.toLowerCase().includes(q) ||
    d.ip?.toLowerCase().includes(q) ||
    d.address?.toLowerCase().includes(q)
  )
})

const CACHE_KEY = 'opshub_phones_cache'
const CACHE_TTL = 60 * 1000 // 1 分钟（后端已有缓存，前端只做短时保底）

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
    // fetchPhones 返回 { devices, total, online, offline } 对象
    const data = await fetchPhones()
    const list = data.devices || []
    devices.value = list
    total.value = data.total ?? list.length
    onlineCount.value = data.online ?? list.filter((d: any) => d.online).length
    offlineCount.value = data.offline ?? list.filter((d: any) => !d.online).length
    // 写入缓存
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: { devices: list, total: total.value, online: onlineCount.value, offline: offlineCount.value } }))
    } catch {}
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

/* 小屏幕响应式 */
@media (max-width: 640px) {
  .search-input { width: 120px; }
  .top-right .el-button:last-child { display: none; }
}

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
  overflow: auto;
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
.dot.yellow { background: var(--ops-accent-yellow); }
.dot.gray { background: var(--ops-text-tertiary); }

/* 注册标签 */
.registered-tag {
  display: inline-block;
  font-size: 10px;
  padding: 1px 6px;
  margin-left: 4px;
  background: rgba(64, 158, 255, 0.1);
  color: var(--ops-accent-blue);
  border-radius: 3px;
  vertical-align: middle;
}

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
