<template>
  <div class="home-dark">
    <!-- 粒子背景 -->
    <div class="particles">
      <div v-for="i in 30" :key="i" class="particle" :style="particleStyle(i)" />
    </div>

    <!-- 标题区 -->
    <div class="hero">
      <div class="title-glow" />
      <div class="title-icon">
        <el-icon :size="48"><Monitor /></el-icon>
      </div>
      <h1 class="main-title">运维中心</h1>
      <p class="intro-text">
        一站式运维管理平台 — 集中管理内网服务、运维工单流程、公司设备资产与打印机
      </p>
    </div>

    <!-- 4 大功能卡片 -->
    <div class="big-cards">
      <!-- 内网服务 — 蓝色 -->
      <div class="big-card card-blue" @click="$router.push('/services')">
        <div class="card-glow" />
        <div class="card-icon-wrap">
          <el-icon :size="34"><Link /></el-icon>
        </div>
        <div class="card-body">
          <h3>内网服务</h3>
          <p>管理所有内网部署服务，一键跳转访问</p>
        </div>
        <div class="card-stat">
          <span class="stat-num">{{ servicesStore.services.length }}</span>
          <span class="stat-label">个服务</span>
        </div>
      </div>

      <!-- 系统运维 — 绿色 -->
      <div class="big-card card-green" @click="$router.push('/operations')">
        <div class="card-glow" />
        <div class="card-icon-wrap">
          <el-icon :size="34"><Operation /></el-icon>
        </div>
        <div class="card-body">
          <h3>系统运维操作</h3>
          <p>运维工单流程管理，操作记录汇总查看</p>
        </div>
        <div class="card-stat">
          <span class="stat-num">{{ opsStore.total }}</span>
          <span class="stat-label">个工单</span>
          <span class="stat-sub">进行中 {{ opsStore.activeCount }}</span>
        </div>
      </div>

      <!-- 设备信息 — 紫色 -->
      <div class="big-card card-purple" @click="$router.push('/devices')">
        <div class="card-glow" />
        <div class="card-icon-wrap">
          <el-icon :size="34"><Cpu /></el-icon>
        </div>
        <div class="card-body">
          <h3>设备信息</h3>
          <p>公司设备资产详情，分类查询与管理</p>
        </div>
        <div class="card-stat">
          <span class="stat-num">{{ devicesStore.total }}</span>
          <span class="stat-label">台设备</span>
          <span class="stat-sub">正常 {{ devicesStore.normalCount }}</span>
        </div>
      </div>

      <!-- 打印机管理 — 橙色 -->
      <div class="big-card card-orange" @click="$router.push('/printers')">
        <div class="card-glow" />
        <div class="card-icon-wrap">
          <el-icon :size="34"><Printer /></el-icon>
        </div>
        <div class="card-body">
          <h3>打印机管理</h3>
          <p>打印机列表、状态监控与耗材管理</p>
        </div>
        <div class="card-stat">
          <span class="stat-num">{{ printersStore.total }}</span>
          <span class="stat-label">台打印机</span>
          <span class="stat-sub">缺墨/故障 {{ printersStore.lowInkCount }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useServicesStore } from '../stores/services'
import { useOperationsStore } from '../stores/operations'
import { useDevicesStore } from '../stores/devices'
import { usePrintersStore } from '../stores/printers'

const servicesStore = useServicesStore()
const opsStore = useOperationsStore()
const devicesStore = useDevicesStore()
const printersStore = usePrintersStore()

function particleStyle(i: number) {
  const size = 2 + Math.random() * 3
  return {
    left: `${Math.random() * 100}%`,
    top: `${Math.random() * 100}%`,
    width: `${size}px`,
    height: `${size}px`,
    animationDelay: `${Math.random() * 6}s`,
    animationDuration: `${4 + Math.random() * 6}s`,
    opacity: 0.15 + Math.random() * 0.35
  }
}
</script>

<style scoped>
.home-dark {
  min-height: 100vh;
  background: #0a0e14;
  padding: 80px 40px 60px;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  overflow: hidden;
}

/* ---- 粒子背景 ---- */
.particles {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.particle {
  position: absolute;
  background: #58a6ff;
  border-radius: 50%;
  animation: drift linear infinite;
}

@keyframes drift {
  0%   { transform: translateY(0) scale(1); }
  50%  { transform: translateY(-40px) scale(1.5); }
  100% { transform: translateY(0) scale(1); }
}

/* ---- 标题区 ---- */
.hero {
  text-align: center;
  margin-bottom: 52px;
  position: relative;
  z-index: 1;
}

.title-glow {
  position: absolute;
  top: -80px;
  left: 50%;
  transform: translateX(-50%);
  width: 300px;
  height: 300px;
  background: radial-gradient(circle, rgba(88,166,255,0.12) 0%, transparent 70%);
  pointer-events: none;
}

.title-icon {
  color: #58a6ff;
  margin-bottom: 12px;
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}

.main-title {
  font-size: 38px;
  font-weight: 800;
  color: #e6edf3;
  letter-spacing: 8px;
  margin: 0 0 12px 0;
}

.intro-text {
  font-size: 14px;
  color: #6e7681;
  max-width: 500px;
  line-height: 1.7;
  margin: 0 auto;
}

/* ---- 4 大卡片 ---- */
.big-cards {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
  max-width: 880px;
  width: 100%;
  position: relative;
  z-index: 1;
}

.big-card {
  position: relative;
  background: #12161e;
  border: 1px solid #1e2430;
  border-radius: 16px;
  padding: 28px 28px 24px;
  cursor: pointer;
  overflow: hidden;
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.big-card:hover {
  transform: translateY(-3px);
}

/* 卡片发光边框 */
.card-glow {
  position: absolute;
  inset: -1px;
  border-radius: 16px;
  opacity: 0;
  transition: opacity 0.35s ease;
  pointer-events: none;
  z-index: 0;
}

.big-card:hover .card-glow {
  opacity: 1;
}

.card-blue .card-glow {
  background: linear-gradient(135deg, rgba(88,166,255,0.25), transparent 50%, rgba(88,166,255,0.1));
}
.card-blue:hover {
  border-color: rgba(88,166,255,0.5);
  box-shadow: 0 0 40px rgba(88,166,255,0.12), 0 8px 30px rgba(0,0,0,0.4);
}

.card-green .card-glow {
  background: linear-gradient(135deg, rgba(63,185,80,0.25), transparent 50%, rgba(63,185,80,0.1));
}
.card-green:hover {
  border-color: rgba(63,185,80,0.5);
  box-shadow: 0 0 40px rgba(63,185,80,0.12), 0 8px 30px rgba(0,0,0,0.4);
}

.card-purple .card-glow {
  background: linear-gradient(135deg, rgba(163,113,247,0.25), transparent 50%, rgba(163,113,247,0.1));
}
.card-purple:hover {
  border-color: rgba(163,113,247,0.5);
  box-shadow: 0 0 40px rgba(163,113,247,0.12), 0 8px 30px rgba(0,0,0,0.4);
}

.card-orange .card-glow {
  background: linear-gradient(135deg, rgba(210,153,34,0.25), transparent 50%, rgba(210,153,34,0.1));
}
.card-orange:hover {
  border-color: rgba(210,153,34,0.5);
  box-shadow: 0 0 40px rgba(210,153,34,0.12), 0 8px 30px rgba(0,0,0,0.4);
}

/* 图标 */
.card-icon-wrap {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 1;
}

.card-blue .card-icon-wrap {
  background: rgba(88,166,255,0.12);
  color: #58a6ff;
}
.card-green .card-icon-wrap {
  background: rgba(63,185,80,0.12);
  color: #3fb950;
}
.card-purple .card-icon-wrap {
  background: rgba(163,113,247,0.12);
  color: #a371f7;
}
.card-orange .card-icon-wrap {
  background: rgba(210,153,34,0.12);
  color: #d29922;
}

/* 文字 */
.card-body {
  position: relative;
  z-index: 1;
}

.card-body h3 {
  font-size: 17px;
  font-weight: 700;
  color: #e6edf3;
  margin: 0 0 6px 0;
}

.card-body p {
  font-size: 13px;
  color: #6e7681;
  margin: 0;
  line-height: 1.5;
}

/* 统计数 */
.card-stat {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding-top: 12px;
  border-top: 1px solid #1e2430;
}

.stat-num {
  font-size: 28px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.card-blue .stat-num { color: #58a6ff; }
.card-green .stat-num { color: #3fb950; }
.card-purple .stat-num { color: #a371f7; }
.card-orange .stat-num { color: #d29922; }

.stat-label {
  font-size: 13px;
  color: #6e7681;
  margin-right: auto;
}

.stat-sub {
  font-size: 11px;
  color: #484f58;
}
</style>
