<template>
  <router-view />
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, onErrorCaptured } from 'vue'
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

// 自动登出：10 分钟无操作
const TIMEOUT_MS = 10 * 60 * 1000
let timer: ReturnType<typeof setTimeout> | null = null

function resetTimer() {
  if (timer) clearTimeout(timer)
  if (auth.isLoggedIn) {
    timer = setTimeout(() => {
      auth.logout()
    }, TIMEOUT_MS)
  }
}

function onUserActivity() {
  resetTimer()
}

// scroll 事件节流：最多每 200ms 触发一次
let lastScrollTime = 0
function onScrollThrottled() {
  const now = Date.now()
  if (now - lastScrollTime > 200) {
    lastScrollTime = now
    resetTimer()
  }
}

onMounted(async () => {
  themeStore.watchSystemTheme()

  // 进入页面先验证 token 是否有效，恢复登录状态
  if (auth.token) {
    await auth.fetchMe()
  }

  if (auth.isLoggedIn) {
    resetTimer()
  }

  window.addEventListener('click', onUserActivity)
  window.addEventListener('keydown', onUserActivity)
  window.addEventListener('scroll', onScrollThrottled)
})

onUnmounted(() => {
  if (timer) clearTimeout(timer)
  window.removeEventListener('click', onUserActivity)
  window.removeEventListener('keydown', onUserActivity)
  window.removeEventListener('scroll', onScrollThrottled)
})
</script>