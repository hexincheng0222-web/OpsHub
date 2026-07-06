<template>
  <router-view />

  <!-- 即将登出确认对话框 -->
  <el-dialog
    v-model="showIdleDialog"
    title="即将自动登出"
    width="360px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    @close="onIdleDialogClose"
  >
    <div style="font-size:14px;line-height:1.6;color:var(--ops-text-primary)">
          因长时间无操作，系统将在 <b style="color:var(--ops-accent-yellow)">{{ idleCountdown }} 秒</b> 后自动登出。<br/>
          是否继续保持登录？
    </div>
    <template #footer>
      <el-button type="primary" @click="keepLogin">保持登录</el-button>
      <el-button @click="confirmLogout">立即登出</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, onErrorCaptured } from 'vue'
import { useThemeStore } from './stores/theme'
import { useAuthStore } from './stores/auth'
import { ElMessage } from 'element-plus'

const themeStore = useThemeStore()
const auth = useAuthStore()

// 全局错误兜底：子组件渲染抛错时避免白屏
onErrorCaptured((err) => {
  console.error('[App] 渲染错误:', err)
  ElMessage.error('页面渲染异常，请刷新重试')
  return false // 阻止错误继续向上抛
})

// 自动登出：30 分钟无操作进入预警，60 秒倒计时后登出
const IDLE_MS = 30 * 60 * 1000      // 30 分钟无操作触发
const WARN_MS = 60 * 1000           // 预警 60 秒倒计时
let idleTimer: ReturnType<typeof setTimeout> | null = null
let countdownTimer: ReturnType<typeof setInterval> | null = null

const showIdleDialog = ref(false)
const idleCountdown = ref(60)

function startIdleWatch() {
  clearIdleTimer()
  if (auth.isLoggedIn) {
    idleTimer = setTimeout(() => {
      // 进入预警倒计时
      idleCountdown.value = 60
      showIdleDialog.value = true
      countdownTimer = setInterval(() => {
        idleCountdown.value -= 1
        if (idleCountdown.value <= 0) {
          showIdleDialog.value = false
          auth.logout()
        }
      }, 1000)
    }, IDLE_MS - WARN_MS)
  }
}

function clearIdleTimer() {
  if (idleTimer) { clearTimeout(idleTimer); idleTimer = null }
  if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null }
}

function keepLogin() {
  showIdleDialog.value = false
  startIdleWatch()
}

function confirmLogout() {
  showIdleDialog.value = false
  auth.logout()
}

function onIdleDialogClose() {
  // 对话框关闭时若倒计时还在跑，停止倒计时（保持登录按钮已重置计时）
  if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null }
}

function onUserActivity() {
  // 仅在未弹预警时重置，避免对话框显示期间被刷新
  if (!showIdleDialog.value) startIdleWatch()
}

// scroll 事件节流：最多每 200ms 触发一次
let lastScrollTime = 0
function onScrollThrottled() {
  const now = Date.now()
  if (now - lastScrollTime > 200) {
    lastScrollTime = now
    onUserActivity()
  }
}

onMounted(async () => {
  themeStore.watchSystemTheme()

  // 进入页面先验证 token 是否有效，恢复登录状态
  // 失败由 router guard 统一处理 logout，这里不再独立 logout
  if (auth.token) {
    try { await auth.fetchMe() } catch { /* guard 会处理 */ }
  }

  if (auth.isLoggedIn) {
    startIdleWatch()
  }

  window.addEventListener('click', onUserActivity)
  window.addEventListener('keydown', onUserActivity)
  window.addEventListener('scroll', onScrollThrottled)
})

onUnmounted(() => {
  clearIdleTimer()
  window.removeEventListener('click', onUserActivity)
  window.removeEventListener('keydown', onUserActivity)
  window.removeEventListener('scroll', onScrollThrottled)
})
</script>