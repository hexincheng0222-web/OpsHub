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
        <el-button size="small" type="primary" @click="openDeployDialog">批量下发通讯录</el-button>
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
          <div class="detail-title">📖 XML 远程电话本
            <el-button v-if="!pbEditing" link type="primary" size="small" @click="startPbEdit">编辑</el-button>
            <el-button v-else link type="default" size="small" @click="pbEditing = false">取消</el-button>
          </div>
          <template v-if="pbEditing">
            <div class="form-row"><span class="form-label">XML URL</span><el-input v-model="pbForm.xmlUrl" size="small" style="width:280px" placeholder="http://服务器IP:端口/api/v1/phones-public/phonebook.xml" /></div>
            <div class="form-row"><span class="form-label">名称</span><el-input v-model="pbForm.name" size="small" style="width:280px" placeholder="公司电话簿" /></div>
            <div style="margin-top:12px;display:flex;gap:8px">
              <el-button type="primary" size="small" @click="savePbConfig" :loading="pbSaving">保存并同步</el-button>
            </div>
          </template>
          <template v-else>
            <div class="detail-row"><span class="detail-label">远程 URL</span><span class="detail-value mono" style="font-size:12px">{{ pbUrl || '—' }}</span></div>
            <div class="detail-row"><span class="detail-label">名称</span><span class="detail-value">{{ pbName || '—' }}</span></div>
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

    <!-- 批量下发通讯录弹窗 -->
    <el-dialog v-model="deployVisible" title="批量下发通讯录" width="640px" :close-on-click-modal="!deployRunning">
      <!-- 配置态 -->
      <template v-if="!deployRunning && !deployDone">
        <div class="deploy-form-row"><span class="deploy-label">XML URL</span>
          <el-input v-model="deployForm.xmlUrl" size="small" style="width:420px" placeholder="http://服务器IP:端口/api/v1/phones-public/phonebook.xml" />
        </div>
        <div class="deploy-form-row"><span class="deploy-label">名称</span>
          <el-input v-model="deployForm.name" size="small" style="width:420px" placeholder="公司电话簿" />
        </div>
        <div class="deploy-form-row" style="align-items:flex-start"><span class="deploy-label">分机号选择</span>
          <div class="deploy-picker">
            <div class="deploy-picker-toolbar">
              <el-button size="small" @click="toggleDeploySelectAll">{{ deploySelected.length === deployOnlineDevices.length && deployOnlineDevices.length > 0 ? '取消全选' : '全选在线' }}</el-button>
              <span class="deploy-picker-count">{{ deploySelected.length }}/{{ deployOnlineDevices.length }} 在线可选</span>
            </div>
            <el-table :data="deployAllDevices" max-height="300" stripe size="small" @selection-change="onDeploySelectionChange" :row-key="(d: any) => d.id" ref="deployTableRef">
              <el-table-column type="selection" width="46" :selectable="(d: any) => d.online" reserve-selection />
              <el-table-column prop="extension" label="分机号" width="100" />
              <el-table-column prop="ip" label="IP 地址" min-width="140">
                <template #default="{ row }"><span class="mono">{{ row.ip || '--' }}</span></template>
              </el-table-column>
              <el-table-column label="状态" width="80" align="center">
                <template #default="{ row }">
                  <span class="deploy-picker-status" :class="row.online ? 'green' : 'gray'">{{ row.online ? '在线' : '离线' }}</span>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </div>
        <div class="deploy-form-row"><span class="deploy-label">并发上限</span>
          <el-radio-group v-model="deployForm.concurrency" size="small">
            <el-radio-button :value="3">3 台</el-radio-button>
            <el-radio-button :value="5">5 台</el-radio-button>
            <el-radio-button :value="10">10 台</el-radio-button>
            <el-radio-button :value="20">20 台</el-radio-button>
          </el-radio-group>
        </div>
      </template>

      <!-- 进度态 -->
      <template v-else-if="deployRunning">
        <div style="text-align:center;padding:20px 0">
          <el-progress :percentage="deployProgress" :status="deployProgress < 100 ? '' : 'success'" :stroke-width="18" :text-inside="true" :format="() => `${deployDoneCount}/${deployTotalCount}`" />
          <div class="deploy-progress-stats">
            <span class="green">成功 {{ deploySuccessCount }}</span>
            <span class="red">失败 {{ deployFailedCount }}</span>
            <span class="gray">待推 {{ deployTotalCount - deployDoneCount }}</span>
          </div>
          <p style="margin-top:16px;color:var(--ops-text-tertiary);font-size:13px">正在推送中…已取消后续批次可停止</p>
        </div>
      </template>

      <!-- 完成态 -->
      <template v-else>
        <div class="deploy-done-summary">
          <el-icon :size="32" color="var(--ops-accent-green)"><SuccessFilled /></el-icon>
          <p>推送完成</p>
          <div class="deploy-done-stats">
            <span class="green">成功 {{ deploySuccessCount }}</span>
            <span class="red">失败 {{ deployFailedCount }}</span>
          </div>
          <div v-if="deployFailedList.length" class="deploy-done-detail">
            <p class="deploy-done-detail-title">失败明细：</p>
            <div v-for="f in deployFailedList" :key="f.id" class="deploy-done-fail-row">
              <span>{{ f.extension }}</span><span class="muted">{{ f.error }}</span>
            </div>
          </div>
        </div>
      </template>

      <template #footer>
        <template v-if="!deployRunning && !deployDone">
          <el-button @click="deployVisible = false">取消</el-button>
          <el-button type="primary" @click="startDeploy" :disabled="!deploySelected.length || !deployForm.xmlUrl">推送 ({{ deploySelected.length }} 台)</el-button>
        </template>
        <template v-else-if="deployRunning">
          <el-button @click="deployCancelled = true">停止后续批次</el-button>
        </template>
        <template v-else>
          <el-button v-if="deployFailedList.length" type="warning" @click="redeployFailed">重推失败 ({{ deployFailedList.length }})</el-button>
          <el-button type="primary" @click="deployDone = false; deployVisible = false">关闭</el-button>
        </template>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Refresh, Phone, Search, SuccessFilled } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { fetchPhones, fetchPhoneDetail, updatePhoneAccount, updatePhoneRemark, updateRemotePhonebook, rebootPhone as rebootPhoneApi } from '@/api/phones'
import { deployPhonebook } from '@/api/phonebook'
import { request } from '@/utils/http'
import BackButton from '../components/BackButton.vue'

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const searchText = ref((route.query.search as string) || '')
const devices = ref<any[]>([])
const errorMsg = ref('')
const total = ref(0)
const onlineCount = ref(0)
const offlineCount = ref(0)

// 筛选关键字同步到 URL query（刷新可恢复、可分享）
watch(searchText, (v) => {
  router.replace({ query: { ...route.query, search: v || undefined } })
})

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
  // 编辑态重置 + 表单清空移到 try 之前——无论 fetch 成功失败都重置，避免串到另一台话机
  editing.value = false
  pbEditing.value = false
  remarkEditing.value = false
  remarkForm.value = ''
  pbForm.value = { xmlUrl: '', name: '' }
  pbUrl.value = ''
  pbName.value = ''
  try {
    const data = await fetchPhoneDetail(phone.id)
    detail.value = data
    // 解析远程电话本配置（ATCOM 返回 phonebook1_remote_url / phonebook1_display_name 等）
    const rp = data.remotePhonebook
    if (rp && typeof rp === 'object') {
      pbUrl.value = rp.phonebook1_remote_url || rp.phonebook2_remote_url || ''
      pbName.value = rp.phonebook1_display_name || rp.phonebook2_display_name || ''
    }
  } catch (e: any) {
    detail.value = null
    // 暴露真实错误，便于诊断；之前静默吞错导致前端只能笼统显示"无法获取详情"
    console.error('[PhonesView] openDetail failed:', e)
    ElMessage.error(`获取详情失败：${e?.message || e}`)
  } finally { detailLoading.value = false }
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
    // 同步刷掉 localStorage 缓存，强制下次加载走后端拿最新备注（避免回退到旧快照）
    try { localStorage.removeItem(CACHE_KEY) } catch {}
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

// 远程电话本编辑
const pbEditing = ref(false)
const pbSaving = ref(false)
const pbForm = ref({ xmlUrl: '', name: '' })
const pbUrl = ref('')
const pbName = ref('')

function startPbEdit() {
  pbForm.value = {
    xmlUrl: pbUrl.value || `${window.location.protocol}//${window.location.host}/api/v1/phones-public/phonebook.xml`,
    name: pbName.value || '公司电话簿',
  }
  pbEditing.value = true
}

async function savePbConfig() {
  if (!pbForm.value.xmlUrl) {
    ElMessage.warning('XML URL 不能为空')
    return
  }
  pbSaving.value = true
  try {
    await updateRemotePhonebook(selectedPhone.value.id, pbForm.value)
    ElMessage.success('远程电话本配置已同步到话机')
    pbUrl.value = pbForm.value.xmlUrl
    pbName.value = pbForm.value.name
    pbEditing.value = false
  } catch (e: any) {
    ElMessage.error(e.message || '同步失败')
  } finally {
    pbSaving.value = false
  }
}

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
        let parsed: any
        try { parsed = JSON.parse(cached) } catch { parsed = null }
        const { data, ts } = parsed || {}
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
    const data = await fetchPhones(force)
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

// ========== 批量下发通讯录 ==========
const deployVisible = ref(false)
const deployRunning = ref(false)
const deployDone = ref(false)
const deployCancelled = ref(false)
// 表单
const deployForm = ref({
  xmlUrl: `${window.location.protocol}//${window.location.host}/api/v1/phones-public/phonebook.xml`,
  name: '公司电话簿',
  concurrency: 5,
})
// 话机源数据（打开弹窗时一次性快照，避免推送过程中列表被刷新影响）
const deployAllDevices = ref<any[]>([])
const deployOnlineDevices = computed(() => deployAllDevices.value.filter((d: any) => d.online))
// 分机号勾选（el-table selection）
const deploySelected = ref<string[]>([])
const deployTableRef = ref()
function onDeploySelectionChange(rows: any[]) {
  deploySelected.value = rows.map((r: any) => r.id)
}
function toggleDeploySelectAll() {
  const table = deployTableRef.value
  if (!table) return
  const isAllSelected = deploySelected.value.length === deployOnlineDevices.value.length && deployOnlineDevices.value.length > 0
  if (isAllSelected) {
    table.clearSelection()
  } else {
    // 只选在线的
    deployAllDevices.value.forEach((d: any) => {
      if (d.online) table.toggleRowSelection(d, true)
      else table.toggleRowSelection(d, false)
    })
  }
}
// 进度统计
const deployTotalCount = ref(0)
const deployDoneCount = ref(0)
const deploySuccessCount = ref(0)
const deployFailedCount = ref(0)
const deployFailedList = ref<any[]>([])
const deployProgress = computed(() => deployTotalCount.value === 0 ? 0 : Math.round(deployDoneCount.value / deployTotalCount.value * 100))

// 打开弹窗：拍一份当前话机快照
function openDeployDialog() {
  if (!devices.value.length) {
    ElMessage.warning('话机列表为空，请先刷新')
    return
  }
  deployAllDevices.value = devices.value.slice()
  deploySelected.value = []
  deployRunning.value = false
  deployDone.value = false
  deployCancelled.value = false
  deployTotalCount.value = 0
  deployDoneCount.value = 0
  deploySuccessCount.value = 0
  deployFailedCount.value = 0
  deployFailedList.value = []
  // 默认填入当前 host 的 XML URL（若用户改过保留）
  if (!deployForm.value.xmlUrl) {
    deployForm.value.xmlUrl = `${window.location.protocol}//${window.location.host}/api/v1/phones-public/phonebook.xml`
  }
  deployVisible.value = true
}

// 开始推送：前端按 concurrency 切批，逐批调 deploy 接口
async function startDeploy() {
  if (!deploySelected.value.length) {
    ElMessage.warning('请至少选择一台话机')
    return
  }
  if (!deployForm.value.xmlUrl) {
    ElMessage.warning('XML URL 不能为空')
    return
  }
  // 二次确认
  try {
    await ElMessageBox.confirm(`将向 ${deploySelected.value.length} 台话机推送 XML 远程电话簿，确认开始？`, '批量下发确认', { type: 'warning', confirmButtonText: '开始推送', cancelButtonText: '取消' })
  } catch { return }

  deployRunning.value = true
  deployDone.value = false
  deployCancelled.value = false
  const selected = [...deploySelected.value]
  deployTotalCount.value = selected.length
  deployDoneCount.value = 0
  deploySuccessCount.value = 0
  deployFailedCount.value = 0
  deployFailedList.value = []

  const concurrency = deployForm.value.concurrency || 5
  // 切批
  const batches: string[][] = []
  for (let i = 0; i < selected.length; i += concurrency) {
    batches.push(selected.slice(i, i + concurrency))
  }

  for (const batch of batches) {
    if (deployCancelled.value) break
    try {
      const result = await deployPhonebook(batch, 'remote', { xmlUrl: deployForm.value.xmlUrl, name: deployForm.value.name })
      deploySuccessCount.value += result.success || 0
      if (result.failed) {
        deployFailedCount.value += result.failed
        const failedRows = (result.results || []).filter((r: any) => r.status === 'failed')
        deployFailedList.value.push(...failedRows)
      }
    } catch (e: any) {
      // 整批失败（网络/后端错误），整批计入失败
      deployFailedCount.value += batch.length
      deployFailedList.value.push(...batch.map(id => {
        const dev = deployAllDevices.value.find((d: any) => d.id === id)
        return { id, extension: dev?.extension || id, status: 'failed', error: e?.message || '批次请求失败' }
      }))
    }
    deployDoneCount.value += batch.length
  }

  deployRunning.value = false
  deployDone.value = true
  // 记录操作日志（含失败明细，便于后台 /admin/logs 排查）
  const failedDetail = deployFailedList.value.length
    ? `，失败: ${deployFailedList.value.map(f => `${f.extension}(${f.error})`).join(', ')}`
    : ''
  request('/api/v1/admin/logs', { method: 'POST', body: JSON.stringify({
    module: '电话簿', action: '批量下发',
    target: `${deploySuccessCount.value}/${selected.length} 台成功`,
    detail: `URL: ${deployForm.value.xmlUrl}${failedDetail}`,
  }) }).catch(() => {})
}

// 重推失败的话机：把失败明细的 id 重新作为选中态，直接走推送流程
function redeployFailed() {
  if (!deployFailedList.value.length) return
  // 把失败话机的 id 重新塞回 deploySelected，并同步勾选态
  const failedIds = deployFailedList.value.map((f: any) => f.id)
  deploySelected.value = [...failedIds]
  // 同步表格勾选态（只勾失败的话机）
  const table = deployTableRef.value
  if (table) {
    table.clearSelection()
    deployAllDevices.value.forEach((d: any) => {
      if (failedIds.includes(d.id)) table.toggleRowSelection(d, true)
    })
  }
  // 重置进度统计，重新走推送流程
  deployDone.value = false
  startDeploy()
}
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

/* 批量下发通讯录弹窗 */
.deploy-form-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.deploy-label {
  width: 90px;
  flex-shrink: 0;
  font-size: 13px;
  color: var(--ops-text-secondary);
  text-align: right;
}
.deploy-picker {
  flex: 1;
  border: 1px solid var(--ops-border-card);
  border-radius: 6px;
  background: var(--ops-bg-card);
  display: flex;
  flex-direction: column;
}
.deploy-picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--ops-border-card);
  background: var(--ops-bg-card-hover);
}
.deploy-picker-count {
  font-size: 12px;
  color: var(--ops-text-tertiary);
}
.deploy-picker-list {
  max-height: 280px;
  overflow-y: auto;
  padding: 4px 0;
}
.deploy-picker-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px;
  font-size: 13px;
}
.deploy-picker-item.offline {
  opacity: 0.5;
}
.deploy-picker-ip {
  flex: 1;
  font-size: 12px;
  color: var(--ops-text-tertiary);
}
.deploy-picker-status {
  font-size: 11px;
}
.deploy-picker-status.green { color: var(--ops-accent-green); }
.deploy-picker-status.gray { color: var(--ops-text-tertiary); }

.deploy-progress-stats {
  display: flex;
  gap: 24px;
  justify-content: center;
  margin-top: 16px;
  font-size: 14px;
  font-weight: 600;
}
.deploy-progress-stats .green { color: var(--ops-accent-green); }
.deploy-progress-stats .red { color: var(--ops-accent-red); }
.deploy-progress-stats .gray { color: var(--ops-text-tertiary); }

.deploy-done-summary {
  text-align: center;
  padding: 16px 0;
}
.deploy-done-summary p {
  margin: 12px 0 8px;
  font-size: 16px;
  font-weight: 600;
}
.deploy-done-stats {
  display: flex;
  gap: 24px;
  justify-content: center;
  font-size: 14px;
}
.deploy-done-stats .green { color: var(--ops-accent-green); }
.deploy-done-stats .red { color: var(--ops-accent-red); }
.deploy-done-detail {
  margin-top: 20px;
  border-top: 1px solid var(--ops-border-card);
  padding-top: 12px;
  max-height: 200px;
  overflow-y: auto;
}
.deploy-done-detail-title {
  font-size: 13px;
  color: var(--ops-text-secondary);
  text-align: left;
  margin: 0 0 8px;
}
.deploy-done-fail-row {
  display: flex;
  justify-content: space-between;
  padding: 4px 12px;
  font-size: 12px;
}
.deploy-done-fail-row .muted { color: var(--ops-text-tertiary); }
</style>
