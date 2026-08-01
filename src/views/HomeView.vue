<template>
  <div class="home-dark">
    <div class="bg-orbs">
      <div class="orb orb-1" />
      <div class="orb orb-2" />
      <div class="orb orb-3" />
    </div>
    <div class="particles">
      <div v-for="i in 12" :key="i" class="particle" :style="particles[i - 1]" />
    </div>
    <div class="hero">
      <div class="title-glow" />
      <router-link v-if="auth.isAdmin" to="/admin" class="title-icon" title="系统管理后台">
        <el-icon :size="48"><Monitor /></el-icon>
      </router-link>
      <div v-else class="title-icon locked" title="无后台管理权限">
        <el-icon :size="48"><Monitor /></el-icon>
      </div>
      <h1 class="main-title">
        <span class="title-text">运维中心</span>
      </h1>
      <p class="intro-text">一站式运维管理平台 — 集中管理内网服务、运维工单流程、公司设备资产与打印机</p>
    </div>
    <div class="big-cards" @mousemove="trackMouse">
      <div class="big-card card-blue" @click="$router.push('/services')">
        <div class="card-glow" /><div class="card-shine" /><div class="card-top-line" />
        <div class="card-icon-wrap"><el-icon :size="32"><Link /></el-icon></div>
        <div class="card-body"><h3>内网服务</h3><p>管理所有内网部署服务，一键跳转访问</p></div>
        <div class="card-stat">
          <span class="stat-num">{{ serviceCount || '--' }}</span>
          <span class="stat-label">个服务</span>
        </div>
      </div>
      <div class="big-card card-green" @click="$router.push('/operations')">
        <div class="card-glow" /><div class="card-shine" /><div class="card-top-line" />
        <div class="card-icon-wrap"><el-icon :size="32"><Operation /></el-icon></div>
        <div class="card-body"><h3>运维操作手册</h3><p>系统运维操作手册，文档查阅与知识管理</p></div>
        <div class="card-stat">
          <span class="stat-num">{{ manualCount || '--' }}</span>
          <span class="stat-label">篇手册</span>
        </div>
      </div>
      <div class="big-card card-purple" @click="$router.push('/devices')">
        <div class="card-glow" /><div class="card-shine" /><div class="card-top-line" />
        <div class="card-icon-wrap"><el-icon :size="32"><Cpu /></el-icon></div>
        <div class="card-body"><h3>设备信息</h3><p>公司设备资产详情，分类查询与管理</p></div>
        <div class="card-stat">
          <span class="stat-num">{{ deviceCount || '--' }}</span>
          <span class="stat-label">台设备</span>
        </div>
      </div>
      <div class="big-card card-pink" @click="$router.push('/procurement')">
        <div class="card-glow" /><div class="card-shine" /><div class="card-top-line" />
        <div class="card-icon-wrap"><el-icon :size="32"><ShoppingCart /></el-icon></div>
        <div class="card-body"><h3>采购管理</h3><p>电脑 / 手机采购登记与资产追踪</p></div>
        <div class="card-stat">
          <span class="stat-num">{{ (computerCount || 0) + (phoneCount || 0) }}</span>
          <span class="stat-label">台设备</span>
        </div>
      </div>
      <div class="big-card card-orange" @click="$router.push('/printers')">
        <div class="card-glow" /><div class="card-shine" /><div class="card-top-line" />
        <div class="card-icon-wrap"><el-icon :size="32"><Printer /></el-icon></div>
        <div class="card-body"><h3>打印机管理</h3><p>打印机列表、状态监控与耗材管理</p></div>
        <div class="card-stat">
          <span class="stat-num">{{ printerCount || '--' }}</span>
          <span class="stat-label">台打印机</span>
        </div>
      </div>
      <div class="big-card card-gold" @click="$router.push('/phones')">
        <div class="card-glow" /><div class="card-shine" /><div class="card-top-line" />
        <div class="card-icon-wrap"><el-icon :size="32"><Phone /></el-icon></div>
        <div class="card-body"><h3>ATCOM 话机管理</h3><p>IP 话机统一管控，设备发现与配置管理</p></div>
        <div class="card-stat">
          <span class="stat-num">{{ phoneTotal || '--' }}</span>
          <span class="stat-label">台话机</span>
          <span class="stat-sub" v-if="phoneTotal">{{ phoneOnline }} 在线</span>
          <span class="stat-sub" v-else>待接入</span>
        </div>
      </div>
      <div class="big-card card-red" @click="$router.push('/log-monitor')">
        <div class="card-glow" /><div class="card-shine" /><div class="card-top-line" />
        <div class="card-icon-wrap"><el-icon :size="32"><DataAnalysis /></el-icon></div>
        <div class="card-body"><h3>日志监控</h3><p>网络设备日志 LLM 分析与异常检测</p></div>
        <div class="card-stat">
          <span class="stat-num">{{ lmDeviceCount }}</span>
          <span class="stat-label">台设备</span>
        </div>
      </div>
    </div>
    <div class="top-right-actions">
      <span class="top-action-item" @click="themeStore.toggleTheme()" title="切换主题">
        {{ themeStore.isDark ? '☀️ 浅色' : '🌙 深色' }}
      </span>
      <template v-if="auth.isLoggedIn">
        <span class="top-action-user">{{ auth.user?.display_name || auth.user?.username }}</span>
        <el-dropdown trigger="click" @command="onUserCommand">
          <span class="top-action-item">账户 ▾</span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="change-password">修改密码</el-dropdown-item>
              <el-dropdown-item command="logout" divided>登出</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </template>
    </div>

    <!-- 修改密码对话框 -->
    <el-dialog
      v-model="pwdVisible"
      title="修改密码"
      width="400px"
      :close-on-click-modal="false"
    >
      <el-form label-width="80px" @submit.prevent>
        <el-form-item label="当前密码">
          <el-input v-model="pwdForm.oldPassword" type="password" show-password placeholder="请输入当前密码" />
        </el-form-item>
        <el-form-item label="新密码">
          <el-input v-model="pwdForm.newPassword" type="password" show-password placeholder="8-64 位，需包含字母和数字" />
        </el-form-item>
        <el-form-item label="确认密码">
          <el-input v-model="pwdForm.confirmPassword" type="password" show-password placeholder="再次输入新密码" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="pwdVisible = false">取消</el-button>
        <el-button type="primary" :loading="pwdSaving" @click="submitPassword">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Monitor, Phone, DataAnalysis, Link, Operation, Cpu, Printer, ShoppingCart } from '@element-plus/icons-vue'
import { useThemeStore } from '../stores/theme'
import { useAuthStore } from '../stores/auth'
import { changePassword } from '../api/auth'
import { fetchDashboardStats } from '../api/dashboard'
import { ElMessage } from 'element-plus'
const themeStore = useThemeStore()
const auth = useAuthStore()

// 账户下拉菜单命令
function onUserCommand(cmd: string) {
  if (cmd === 'logout') { auth.logout(); return }
  if (cmd === 'change-password') {
    pwdForm.value = { oldPassword: '', newPassword: '', confirmPassword: '' }
    pwdVisible.value = true
  }
}

// 修改密码
const pwdVisible = ref(false)
const pwdSaving = ref(false)
const pwdForm = ref({ oldPassword: '', newPassword: '', confirmPassword: '' })

async function submitPassword() {
  const { oldPassword, newPassword, confirmPassword } = pwdForm.value
  if (!oldPassword || !newPassword) return ElMessage.warning('请输入当前密码和新密码')
  if (newPassword.length < 8 || newPassword.length > 64) return ElMessage.warning('新密码长度需 8-64 字符')
  if (!/[a-zA-Z]/.test(newPassword) || !/\d/.test(newPassword)) return ElMessage.warning('新密码必须同时包含字母和数字')
  if (newPassword !== confirmPassword) return ElMessage.warning('两次输入的新密码不一致')
  pwdSaving.value = true
  try {
    await changePassword(oldPassword, newPassword)
    ElMessage.success('密码修改成功')
    pwdVisible.value = false
  } catch (e: any) {
    ElMessage.error(e.message || '修改失败')
  } finally {
    pwdSaving.value = false
  }
}

// 首页卡片统计（通过单次 dashboard 接口加载）
const serviceCount = ref(0)
const manualCount = ref(0)
const deviceCount = ref(0)
const printerCount = ref(0)
const computerCount = ref(0)
const phoneCount = ref(0)
const phoneTotal = ref(0)
const phoneOnline = ref(0)
const lmDeviceCount = ref(0)

function trackMouse(e: MouseEvent) {
  const card = (e.target as HTMLElement).closest('.big-card') as HTMLElement | null
  if (!card) return
  const rect = card.getBoundingClientRect()
  card.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`)
  card.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`)
}

onMounted(async () => {
  try {
    const stats = await fetchDashboardStats()
    serviceCount.value = stats.services
    manualCount.value = stats.manuals
    deviceCount.value = stats.devices
    printerCount.value = stats.printers
    computerCount.value = stats.computers
    phoneCount.value = stats.procurementPhones
    phoneTotal.value = stats.phones
    phoneOnline.value = stats.phonesOnline
    lmDeviceCount.value = stats.lmDevices
  } catch (e: any) {
    console.warn('首页加载统计数据失败:', e.message)
  }
})
const COLORS = ['#58a6ff','#3fb950','#a371f7','#d29922','#79c0ff','#7ee787','#bc8cff','#e3b341']
const particles = computed(() =>
  Array.from({ length: 40 }, (_, i) => {
    const color = COLORS[i % COLORS.length]; const size = 3 + Math.random() * 6
    return { left: `${Math.random()*100}%`, top: `${60+Math.random()*40}%`, width: `${size}px`, height: `${size}px`, background: color, boxShadow: `0 0 ${size*3}px ${color}44, 0 0 ${size*6}px ${color}22`, animationDelay: `${Math.random()*8}s`, animationDuration: `${6+Math.random()*8}s`, opacity: 0 }
  })
)
</script>

<style scoped>
.home-dark{min-height:100vh;background:var(--ops-bg-page);padding:70px 40px 60px;display:flex;flex-direction:column;align-items:center;position:relative;overflow:hidden}
.bg-orbs{position:absolute;inset:0;pointer-events:none;z-index:0}
.light-theme .bg-orbs{display:none}
.orb{position:absolute;border-radius:50%;filter:blur(120px);opacity:.15}
.orb-1{width:600px;height:600px;background:var(--ops-accent-blue);top:-200px;left:-150px;animation:orbFloat1 12s ease-in-out infinite}
.orb-2{width:500px;height:500px;background:var(--ops-accent-purple);top:30%;right:-200px;animation:orbFloat2 15s ease-in-out infinite}
.orb-3{width:400px;height:400px;background:var(--ops-accent-green);bottom:-100px;left:40%;animation:orbFloat3 18s ease-in-out infinite}
@keyframes orbFloat1{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(60px,40px) scale(1.1)}66%{transform:translate(-30px,-20px) scale(.95)}}
@keyframes orbFloat2{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-50px,-50px) scale(1.15)}}
@keyframes orbFloat3{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(30px,-40px) scale(1.2)}}
.particles{position:absolute;inset:0;pointer-events:none;z-index:1}
.particle{position:absolute;border-radius:50%;animation:particleRise linear infinite;will-change:transform,opacity}
@keyframes particleRise{0%{transform:translateY(0) scale(.9);opacity:0}10%{opacity:.6}90%{opacity:.6}100%{transform:translateY(-100vh) scale(1.4);opacity:0}}
.hero{text-align:center;margin-bottom:56px;position:relative;z-index:2}
.title-glow{position:absolute;top:-120px;left:50%;transform:translateX(-50%);width:500px;height:500px;background:radial-gradient(ellipse,rgba(88,166,255,.10) 0%,transparent 65%);pointer-events:none;animation:titleGlowPulse 4s ease-in-out infinite}
.light-theme .title-glow{opacity:0;animation:none}
@keyframes titleGlowPulse{0%,100%{opacity:.7;transform:translateX(-50%) scale(1)}50%{opacity:1;transform:translateX(-50%) scale(1.1)}}
.title-icon{width:72px;height:72px;border-radius:20px;background:linear-gradient(135deg,rgba(88,166,255,.20),rgba(88,166,255,.05));border:1px solid rgba(88,166,255,.15);display:flex;align-items:center;justify-content:center;margin:0 auto 18px;color:#58a6ff;animation:float 4s ease-in-out infinite;backdrop-filter:blur(10px);cursor:pointer;text-decoration:none;transition:border-color .3s ease}
.title-icon:hover{border-color:rgba(88,166,255,.50);box-shadow:0 0 30px rgba(88,166,255,.20)}
.title-icon.locked{opacity:.4;cursor:not-allowed;filter:grayscale(60%)}
.title-icon.locked:hover{border-color:rgba(88,166,255,.15);box-shadow:none}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
.main-title{margin:0 0 14px 0}
.title-text{font-size:40px;font-weight:800;letter-spacing:10px;color:#e6edf3;background:linear-gradient(180deg,#fff 0%,#e6edf3 40%,#8b949e 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.light-theme .title-text{background:linear-gradient(180deg,#1f2328 0%,#1f2328 40%,#656d76 100%);-webkit-background-clip:text;background-clip:text}
.intro-text{font-size:14px;color:#8b949e;max-width:520px;line-height:1.8;margin:0 auto;letter-spacing:.5px}
.light-theme .intro-text{color:#656d76}
.light-theme .title-icon{background:linear-gradient(135deg,rgba(9,105,218,.12),rgba(9,105,218,.03));border-color:rgba(9,105,218,.12);color:#0969da;backdrop-filter:none}
.big-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:22px;max-width:1200px;width:100%;position:relative;z-index:2}
.big-card{position:relative;background:rgba(13,17,23,.70);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border:1px solid rgba(255,255,255,.06);border-radius:20px;padding:26px 28px 22px;cursor:pointer;overflow:hidden;transition:all .4s cubic-bezier(.25,.1,.25,1);display:flex;flex-direction:column;gap:18px}
.big-card::before{content:'';position:absolute;inset:0;border-radius:inherit;background:radial-gradient(600px circle at var(--mouse-x,50%) var(--mouse-y,50%),rgba(255,255,255,.03),transparent 40%);opacity:0;transition:opacity .4s ease;pointer-events:none;z-index:0}
.big-card:hover::before{opacity:1}
.big-card:hover{transform:translateY(-4px);border-color:rgba(255,255,255,.10)}
.light-theme .big-card{background:rgba(255,255,255,.80);border:1px solid rgba(0,0,0,.08)}
.light-theme .big-card:hover{border-color:rgba(0,0,0,.15);box-shadow:0 0 40px rgba(0,0,0,.06),0 8px 24px rgba(0,0,0,.08)}

/* ---- 卡片颜色：CSS 自定义属性 ---- */
.card-blue    { --cr: 88;  --cg: 166; --cb: 255; --icon-hex: #79c0ff; --bg-hex: #79c0ff }
.card-green   { --cr: 63;  --cg: 185; --cb: 80;  --icon-hex: #7ee787; --bg-hex: #7ee787 }
.card-purple  { --cr: 163; --cg: 113; --cb: 247; --icon-hex: #bc8cff; --bg-hex: #bc8cff }
.card-pink    { --cr: 244; --cg: 114; --cb: 182; --icon-hex: #f472b6; --bg-hex: #f472b6 }
.card-cyan    { --cr: 34;  --cg: 211; --cb: 238; --icon-hex: #22d3ee; --bg-hex: #22d3ee }
.card-orange,
.card-gold    { --cr: 210; --cg: 153; --cb: 34;  --icon-hex: #e3b341; --bg-hex: #e3b341 }
.card-red     { --cr: 248; --cg: 81;  --cb: 73;  --icon-hex: #f85149; --bg-hex: #f85149 }

.light-theme .card-blue   { --cr: 9;   --cg: 105; --cb: 218; --icon-hex: #0969da; --bg-hex: #0969da }
.light-theme .card-green  { --cr: 26;  --cg: 127; --cb: 55;  --icon-hex: #1a7f37; --bg-hex: #1a7f37 }
.light-theme .card-purple { --cr: 130; --cg: 80;  --cb: 223; --icon-hex: #8250df; --bg-hex: #8250df }
.light-theme .card-pink   { --cr: 219; --cg: 39;  --cb: 119; --icon-hex: #db2777; --bg-hex: #db2777 }
.light-theme .card-cyan   { --cr: 8;   --cg: 145; --cb: 178; --icon-hex: #0891b2; --bg-hex: #0891b2 }
.light-theme .card-orange,
.light-theme .card-gold   { --cr: 154; --cg: 103; --cb: 0;   --icon-hex: #9a6700; --bg-hex: #9a6700 }
.light-theme .card-red    { --cr: 207; --cg: 34;  --cb: 46;  --icon-hex: #cf222e; --bg-hex: #cf222e }

.card-glow{background:linear-gradient(135deg,rgba(var(--cr),var(--cg),var(--cb),.30),transparent 45%,rgba(var(--cr),var(--cg),var(--cb),.06))}
.big-card:hover{border-color:rgba(var(--cr),var(--cg),var(--cb),.35);box-shadow:0 0 60px rgba(var(--cr),var(--cg),var(--cb),.08),0 0 120px rgba(var(--cr),var(--cg),var(--cb),.04),0 8px 32px rgba(0,0,0,.5)}
.card-icon-wrap{background:linear-gradient(135deg,rgba(var(--cr),var(--cg),var(--cb),.18),rgba(var(--cr),var(--cg),var(--cb),.06));color:var(--icon-hex);box-shadow:0 0 20px rgba(var(--cr),var(--cg),var(--cb),.10)}
.big-card:hover .card-icon-wrap{box-shadow:0 0 30px rgba(var(--cr),var(--cg),var(--cb),.25)}
.stat-num{color:var(--bg-hex)}
.card-top-line{position:absolute;top:0;left:20px;right:20px;height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.06),transparent);opacity:0;transition:opacity .4s ease;z-index:1}
.big-card:hover .card-top-line{opacity:1}
.card-glow{position:absolute;inset:-1px;border-radius:inherit;opacity:0;transition:opacity .4s ease;pointer-events:none;z-index:0}
.big-card:hover .card-glow{opacity:1}
.card-shine{position:absolute;top:-50%;left:-50%;width:200%;height:200%;background:radial-gradient(ellipse at center,rgba(255,255,255,.03) 0%,transparent 60%);opacity:0;transition:opacity .4s ease;pointer-events:none;z-index:0;transform:rotate(-15deg)}
.big-card:hover .card-shine{opacity:1}
.card-icon-wrap{width:52px;height:52px;border-radius:16px;display:flex;align-items:center;justify-content:center;position:relative;z-index:1;transition:transform .35s ease,box-shadow .35s ease}
.big-card:hover .card-icon-wrap{transform:scale(1.08)}
.card-body{position:relative;z-index:1}
.card-body h3{font-size:16px;font-weight:700;color:#e6edf3;margin:0 0 5px 0;letter-spacing:.3px}
.card-body p{font-size:13px;color:#8b949e;margin:0;line-height:1.55;letter-spacing:.2px}
.light-theme .card-body h3{color:#1f2328}
.light-theme .card-body p{color:#656d76}
.card-stat{position:relative;z-index:1;display:flex;align-items:baseline;gap:8px;padding-top:14px;border-top:1px solid rgba(255,255,255,.05)}
.light-theme .card-stat{border-top:1px solid rgba(0,0,0,.06)}
.light-theme .stat-label{color:#656d76}
.light-theme .stat-sub{color:#8b949e}
.stat-num{font-size:30px;font-weight:800;font-variant-numeric:tabular-nums;font-feature-settings:"tnum";line-height:1;transition:transform .3s ease}
.big-card:hover .stat-num{transform:scale(1.05)}
.stat-label{font-size:12px;color:#8b949e;margin-right:auto;font-weight:500}
.stat-sub{font-size:11px;color:#484f58;letter-spacing:.2px}
.top-right-actions {
  position: fixed; top: 24px; right: 24px;
  display: flex; align-items: center; gap: 16px;
  z-index: 1000;
}
.top-action-item {
  font-size: 13px; color: #8b949e;
  cursor: pointer; transition: color .2s ease;
  user-select: none;
}
.top-action-item:hover { color: #e6edf3; }
.logout-item:hover { color: #f85149 !important; }
.top-action-user {
  font-size: 13px; color: #79c0ff;
  font-weight: 500;
}
</style>
