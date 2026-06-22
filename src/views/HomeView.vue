<template>
  <div class="home-dark">
    <div class="bg-orbs">
      <div class="orb orb-1" />
      <div class="orb orb-2" />
      <div class="orb orb-3" />
    </div>
    <div class="grid-overlay" />
    <div class="particles">
      <div v-for="i in 40" :key="i" class="particle" :style="particleStyle(i)" />
    </div>
    <div class="hero">
      <div class="title-glow" />
      <router-link to="/admin" class="title-icon" title="系统管理后台">
        <el-icon :size="48"><Monitor /></el-icon>
      </router-link>
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
          <span class="stat-num">{{ servicesStore.services.length }}</span>
          <span class="stat-label">个服务</span>
        </div>
      </div>
      <div class="big-card card-green" @click="$router.push('/operations')">
        <div class="card-glow" /><div class="card-shine" /><div class="card-top-line" />
        <div class="card-icon-wrap"><el-icon :size="32"><Operation /></el-icon></div>
        <div class="card-body"><h3>运维操作手册</h3><p>系统运维操作手册，文档查阅与知识管理</p></div>
        <div class="card-stat">
          <span class="stat-num">{{ opsStore.total }}</span>
          <span class="stat-label">篇手册</span>
          <span class="stat-sub">{{ opsStore.activeCount }} 个分类</span>
        </div>
      </div>
      <div class="big-card card-purple" @click="$router.push('/devices')">
        <div class="card-glow" /><div class="card-shine" /><div class="card-top-line" />
        <div class="card-icon-wrap"><el-icon :size="32"><Cpu /></el-icon></div>
        <div class="card-body"><h3>设备信息</h3><p>公司设备资产详情，分类查询与管理</p></div>
        <div class="card-stat">
          <span class="stat-num">{{ devicesStore.total }}</span>
          <span class="stat-label">台设备</span>
          <span class="stat-sub">正常 {{ devicesStore.normalCount }}</span>
        </div>
      </div>
      <div class="big-card card-pink" @click="$router.push('/computer-procurement')">
        <div class="card-glow" /><div class="card-shine" /><div class="card-top-line" />
        <div class="card-icon-wrap"><el-icon :size="32"><Monitor /></el-icon></div>
        <div class="card-body"><h3>电脑采购登记</h3><p>电脑设备采购登记与资产追踪</p></div>
        <div class="card-stat">
          <span class="stat-num">{{ computerStore.total }}</span>
          <span class="stat-label">台电脑</span>
        </div>
      </div>
      <div class="big-card card-cyan" @click="$router.push('/phone-procurement')">
        <div class="card-glow" /><div class="card-shine" /><div class="card-top-line" />
        <div class="card-icon-wrap"><el-icon :size="32"><Cellphone /></el-icon></div>
        <div class="card-body"><h3>手机采购登记</h3><p>手机设备采购登记与资产追踪</p></div>
        <div class="card-stat">
          <span class="stat-num">{{ phoneStore.total }}</span>
          <span class="stat-label">部手机</span>
        </div>
      </div>
      <div class="big-card card-orange" @click="$router.push('/printers')">
        <div class="card-glow" /><div class="card-shine" /><div class="card-top-line" />
        <div class="card-icon-wrap"><el-icon :size="32"><Printer /></el-icon></div>
        <div class="card-body"><h3>打印机管理</h3><p>打印机列表、状态监控与耗材管理</p></div>
        <div class="card-stat">
          <span class="stat-num">{{ printersStore.total }}</span>
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
    <div class="theme-toggle" @click="themeStore.toggleTheme()">
      <el-icon :size="22">
        <Sunny v-if="themeStore.isDark" />
        <Moon v-else />
      </el-icon>
    </div>
    <div v-if="auth.isLoggedIn" class="logout-btn" @click="handleLogout" title="登出">
      <el-icon :size="22"><SwitchButton /></el-icon>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useServicesStore } from '../stores/services'
import { useOperationsStore } from '../stores/operations'
import { useDevicesStore } from '../stores/devices'
import { usePrintersStore } from '../stores/printers'
import { useComputerProcurementStore, usePhoneProcurementStore } from '../stores/procurement'
import { Monitor, Cellphone, Phone, DataAnalysis, SwitchButton } from '@element-plus/icons-vue'
import { useThemeStore } from '../stores/theme'
import { useAuthStore } from '../stores/auth'
import { fetchPhones } from '../api/phones'
import { getConfig } from '../api/log-monitor'
import { useRouter } from 'vue-router'
const servicesStore = useServicesStore()
const opsStore = useOperationsStore()
const devicesStore = useDevicesStore()
const printersStore = usePrintersStore()
const computerStore = useComputerProcurementStore()
const phoneStore = usePhoneProcurementStore()
const themeStore = useThemeStore()
const auth = useAuthStore()
const router = useRouter()
const phoneTotal = ref(0)
const phoneOnline = ref(0)
const lmDeviceCount = ref(0)

function trackMouse(e: MouseEvent) {

function handleLogout() {
  auth.logout()
  router.push('/')
}
  const card = (e.target as HTMLElement).closest('.big-card') as HTMLElement | null
  if (!card) return
  const rect = card.getBoundingClientRect()
  card.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`)
  card.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`)
}

onMounted(() => {
  // 渐进式加载：各 store 独立加载，不互相阻塞
  Promise.all([
    servicesStore.loadServices(),
    opsStore.loadFolders().then(() => opsStore.loadDocs()),
    devicesStore.loadRacks(),
    printersStore.loadPrinters(),
    computerStore.loadComputers(),
    phoneStore.loadPhones(),
    fetchPhones().then(res => {
      if (res.code === 200) {
        phoneTotal.value = res.total
        phoneOnline.value = res.online
      }
    }).catch((e: any) => console.warn('首页加载话机数据失败:', e.message)),
    getConfig().then(cfg => { lmDeviceCount.value = cfg.devices?.length || 0 }).catch(() => {}),
  ])
})
const COLORS = ['#58a6ff','#3fb950','#a371f7','#d29922','#79c0ff','#7ee787','#bc8cff','#e3b341']
function particleStyle(i: number) {
  const color = COLORS[i % COLORS.length]; const size = 3 + Math.random() * 6
  return { left: Math.random()*100+'%', top: 60+Math.random()*40+'%', width: size+'px', height: size+'px', background: color, boxShadow: `0 0 ${size*3}px ${color}44, 0 0 ${size*6}px ${color}22`, animationDelay: Math.random()*8+'s', animationDuration: 6+Math.random()*8+'s', opacity: 0 }
}
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
.grid-overlay{position:absolute;inset:0;pointer-events:none;z-index:0;opacity:.03;background-image:linear-gradient(rgba(255,255,255,.3) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.3) 1px,transparent 1px);background-size:48px 48px}
.particles{position:absolute;inset:0;pointer-events:none;z-index:1}
.particle{position:absolute;border-radius:50%;animation:particleRise linear infinite;will-change:transform,opacity}
@keyframes particleRise{0%{transform:translateY(0) scale(.9);opacity:0}10%{opacity:.6}90%{opacity:.6}100%{transform:translateY(-100vh) scale(1.4);opacity:0}}
.hero{text-align:center;margin-bottom:56px;position:relative;z-index:2}
.title-glow{position:absolute;top:-120px;left:50%;transform:translateX(-50%);width:500px;height:500px;background:radial-gradient(ellipse,rgba(88,166,255,.10) 0%,transparent 65%);pointer-events:none;animation:titleGlowPulse 4s ease-in-out infinite}
.light-theme .title-glow{opacity:0;animation:none}
@keyframes titleGlowPulse{0%,100%{opacity:.7;transform:translateX(-50%) scale(1)}50%{opacity:1;transform:translateX(-50%) scale(1.1)}}
.title-icon{width:72px;height:72px;border-radius:20px;background:linear-gradient(135deg,rgba(88,166,255,.20),rgba(88,166,255,.05));border:1px solid rgba(88,166,255,.15);display:flex;align-items:center;justify-content:center;margin:0 auto 18px;color:#58a6ff;animation:float 4s ease-in-out infinite;backdrop-filter:blur(10px);cursor:pointer;text-decoration:none;transition:border-color .3s ease}
.title-icon:hover{border-color:rgba(88,166,255,.50);box-shadow:0 0 30px rgba(88,166,255,.20)}
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
.card-top-line{position:absolute;top:0;left:20px;right:20px;height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.06),transparent);opacity:0;transition:opacity .4s ease;z-index:1}
.big-card:hover .card-top-line{opacity:1}
.card-glow{position:absolute;inset:-1px;border-radius:inherit;opacity:0;transition:opacity .4s ease;pointer-events:none;z-index:0}
.big-card:hover .card-glow{opacity:1}
.card-shine{position:absolute;top:-50%;left:-50%;width:200%;height:200%;background:radial-gradient(ellipse at center,rgba(255,255,255,.03) 0%,transparent 60%);opacity:0;transition:opacity .4s ease;pointer-events:none;z-index:0;transform:rotate(-15deg)}
.big-card:hover .card-shine{opacity:1}
.card-blue .card-glow{background:linear-gradient(135deg,rgba(88,166,255,.30),transparent 45%,rgba(88,166,255,.06))}
.card-blue:hover{border-color:rgba(88,166,255,.35);box-shadow:0 0 60px rgba(88,166,255,.08),0 0 120px rgba(88,166,255,.04),0 8px 32px rgba(0,0,0,.5)}
.card-green .card-glow{background:linear-gradient(135deg,rgba(63,185,80,.30),transparent 45%,rgba(63,185,80,.06))}
.card-green:hover{border-color:rgba(63,185,80,.35);box-shadow:0 0 60px rgba(63,185,80,.08),0 0 120px rgba(63,185,80,.04),0 8px 32px rgba(0,0,0,.5)}
.card-purple .card-glow{background:linear-gradient(135deg,rgba(163,113,247,.30),transparent 45%,rgba(163,113,247,.06))}
.card-purple:hover{border-color:rgba(163,113,247,.35);box-shadow:0 0 60px rgba(163,113,247,.08),0 0 120px rgba(163,113,247,.04),0 8px 32px rgba(0,0,0,.5)}
.card-orange .card-glow{background:linear-gradient(135deg,rgba(210,153,34,.30),transparent 45%,rgba(210,153,34,.06))}
.card-orange:hover{border-color:rgba(210,153,34,.35);box-shadow:0 0 60px rgba(210,153,34,.08),0 0 120px rgba(210,153,34,.04),0 8px 32px rgba(0,0,0,.5)}
.card-icon-wrap{width:52px;height:52px;border-radius:16px;display:flex;align-items:center;justify-content:center;position:relative;z-index:1;transition:transform .35s ease,box-shadow .35s ease}
.big-card:hover .card-icon-wrap{transform:scale(1.08)}
.card-blue .card-icon-wrap{background:linear-gradient(135deg,rgba(88,166,255,.18),rgba(88,166,255,.06));color:#79c0ff;box-shadow:0 0 20px rgba(88,166,255,.10)}
.card-blue:hover .card-icon-wrap{box-shadow:0 0 30px rgba(88,166,255,.25)}
.card-green .card-icon-wrap{background:linear-gradient(135deg,rgba(63,185,80,.18),rgba(63,185,80,.06));color:#7ee787;box-shadow:0 0 20px rgba(63,185,80,.10)}
.card-green:hover .card-icon-wrap{box-shadow:0 0 30px rgba(63,185,80,.25)}
.card-purple .card-icon-wrap{background:linear-gradient(135deg,rgba(163,113,247,.18),rgba(163,113,247,.06));color:#bc8cff;box-shadow:0 0 20px rgba(163,113,247,.10)}
.card-purple:hover .card-icon-wrap{box-shadow:0 0 30px rgba(163,113,247,.25)}
.card-orange .card-icon-wrap{background:linear-gradient(135deg,rgba(210,153,34,.18),rgba(210,153,34,.06));color:#e3b341;box-shadow:0 0 20px rgba(210,153,34,.10)}
.card-orange:hover .card-icon-wrap{box-shadow:0 0 30px rgba(210,153,34,.25)}
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
.card-blue .stat-num{color:#79c0ff}
.card-green .stat-num{color:#7ee787}
.card-purple .stat-num{color:#bc8cff}
.card-orange .stat-num{color:#e3b341}
.card-pink .card-glow{background:linear-gradient(135deg,rgba(244,114,182,.30),transparent 45%,rgba(244,114,182,.06))}
.card-pink:hover{border-color:rgba(244,114,182,.35);box-shadow:0 0 60px rgba(244,114,182,.08),0 0 120px rgba(244,114,182,.04),0 8px 32px rgba(0,0,0,.5)}
.card-pink .card-icon-wrap{background:linear-gradient(135deg,rgba(244,114,182,.18),rgba(244,114,182,.06));color:#f472b6;box-shadow:0 0 20px rgba(244,114,182,.10)}
.card-pink:hover .card-icon-wrap{box-shadow:0 0 30px rgba(244,114,182,.25)}
.card-pink .stat-num{color:#f472b6}
.card-cyan .card-glow{background:linear-gradient(135deg,rgba(34,211,238,.30),transparent 45%,rgba(34,211,238,.06))}
.card-cyan:hover{border-color:rgba(34,211,238,.35);box-shadow:0 0 60px rgba(34,211,238,.08),0 0 120px rgba(34,211,238,.04),0 8px 32px rgba(0,0,0,.5)}
.card-cyan .card-icon-wrap{background:linear-gradient(135deg,rgba(34,211,238,.18),rgba(34,211,238,.06));color:#22d3ee;box-shadow:0 0 20px rgba(34,211,238,.10)}
.card-cyan:hover .card-icon-wrap{box-shadow:0 0 30px rgba(34,211,238,.25)}
.card-cyan .stat-num{color:#22d3ee}
.card-gold .card-glow{background:linear-gradient(135deg,rgba(210,153,34,.30),transparent 45%,rgba(210,153,34,.06))}
.card-gold:hover{border-color:rgba(210,153,34,.35);box-shadow:0 0 60px rgba(210,153,34,.08),0 0 120px rgba(210,153,34,.04),0 8px 32px rgba(0,0,0,.5)}
.card-gold .card-icon-wrap{background:linear-gradient(135deg,rgba(210,153,34,.18),rgba(210,153,34,.06));color:#e3b341;box-shadow:0 0 20px rgba(210,153,34,.10)}
.card-gold:hover .card-icon-wrap{box-shadow:0 0 30px rgba(210,153,34,.25)}
.card-gold .stat-num{color:#e3b341}
.light-theme .card-pink .stat-num{color:#db2777}
.light-theme .card-cyan .stat-num{color:#0891b2}
.light-theme .card-pink .card-icon-wrap{background:linear-gradient(135deg,rgba(219,39,119,.12),rgba(219,39,119,.04));color:#db2777;box-shadow:0 0 20px rgba(219,39,119,.08)}
.light-theme .card-cyan .card-icon-wrap{background:linear-gradient(135deg,rgba(8,145,178,.12),rgba(8,145,178,.04));color:#0891b2;box-shadow:0 0 20px rgba(8,145,178,.08)}
.light-theme .card-blue .stat-num{color:#0969da}
.light-theme .card-green .stat-num{color:#1a7f37}
.light-theme .card-purple .stat-num{color:#8250df}
.light-theme .card-orange .stat-num{color:#9a6700}
.light-theme .card-blue .card-icon-wrap{background:linear-gradient(135deg,rgba(9,105,218,.12),rgba(9,105,218,.04));color:#0969da;box-shadow:0 0 20px rgba(9,105,218,.08)}
.light-theme .card-green .card-icon-wrap{background:linear-gradient(135deg,rgba(26,127,55,.12),rgba(26,127,55,.04));color:#1a7f37;box-shadow:0 0 20px rgba(26,127,55,.08)}
.light-theme .card-purple .card-icon-wrap{background:linear-gradient(135deg,rgba(130,80,223,.12),rgba(130,80,223,.04));color:#8250df;box-shadow:0 0 20px rgba(130,80,223,.08)}
.light-theme .card-orange .card-icon-wrap{background:linear-gradient(135deg,rgba(154,103,0,.12),rgba(154,103,0,.04));color:#9a6700;box-shadow:0 0 20px rgba(154,103,0,.08)}
.light-theme .card-gold .stat-num{color:#9a6700}
.light-theme .card-gold .card-icon-wrap{background:linear-gradient(135deg,rgba(154,103,0,.12),rgba(154,103,0,.04));color:#9a6700;box-shadow:0 0 20px rgba(154,103,0,.08)}
.card-red .card-glow{background:linear-gradient(135deg,rgba(248,81,73,.30),transparent 45%,rgba(248,81,73,.06))}
.card-red:hover{border-color:rgba(248,81,73,.35);box-shadow:0 0 60px rgba(248,81,73,.08),0 0 120px rgba(248,81,73,.04),0 8px 32px rgba(0,0,0,.5)}
.card-red .card-icon-wrap{background:linear-gradient(135deg,rgba(248,81,73,.18),rgba(248,81,73,.06));color:#f85149;box-shadow:0 0 20px rgba(248,81,73,.10)}
.card-red:hover .card-icon-wrap{box-shadow:0 0 30px rgba(248,81,73,.25)}
.card-red .stat-num{color:#f85149}
.light-theme .card-red .stat-num{color:#cf222e}
.light-theme .card-red .card-icon-wrap{background:linear-gradient(135deg,rgba(207,34,46,.12),rgba(207,34,46,.04));color:#cf222e;box-shadow:0 0 20px rgba(207,34,46,.08)}
.stat-label{font-size:12px;color:#8b949e;margin-right:auto;font-weight:500}
.stat-sub{font-size:11px;color:#484f58;letter-spacing:.2px}
.theme-toggle{position:fixed;bottom:32px;right:32px;width:52px;height:52px;border-radius:50%;background:rgba(13,17,23,.80);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,.08);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .35s cubic-bezier(.25,.1,.25,1);z-index:1000;color:#8b949e}
.theme-toggle:hover{border-color:rgba(88,166,255,.4);color:#79c0ff;box-shadow:0 0 32px rgba(88,166,255,.15);transform:scale(1.08)}
.theme-toggle .el-icon{transition:transform .35s ease}
.theme-toggle:hover .el-icon{transform:rotate(30deg)}

.logout-btn {
  position: fixed; bottom: 96px; right: 32px;
  width: 52px; height: 52px; border-radius: 50%;
  background: rgba(13,17,23,.80); backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255,255,255,.08);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: all .35s cubic-bezier(.25,.1,.25,1);
  z-index: 1000; color: #8b949e;
}
.logout-btn:hover {
  border-color: rgba(248,81,73,.4); color: #f85149;
  box-shadow: 0 0 32px rgba(248,81,73,.15); transform: scale(1.08);
}
</style>
