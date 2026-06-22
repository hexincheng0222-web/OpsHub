<template>
  <router-view />
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useThemeStore } from './stores/theme'
import { useAuthStore } from './stores/auth'

const router = useRouter()
const themeStore = useThemeStore()
const auth = useAuthStore()

// 自动登出：10 分钟无操作
const TIMEOUT_MS = 10 * 60 * 1000
let timer: ReturnType<typeof setTimeout> | null = null

function resetTimer() {
  if (timer) clearTimeout(timer)
  if (auth.isLoggedIn) {
    timer = setTimeout(() => {
      auth.logout()
      router.push('/login')
    }, TIMEOUT_MS)
  }
}

function onUserActivity() {
  resetTimer()
}

onMounted(() => {
  themeStore.initTheme()
  themeStore.watchSystemTheme()

  if (auth.isLoggedIn) {
    resetTimer()
  }

  window.addEventListener('click', onUserActivity)
  window.addEventListener('keydown', onUserActivity)
  window.addEventListener('scroll', onUserActivity)
})

onUnmounted(() => {
  if (timer) clearTimeout(timer)
  window.removeEventListener('click', onUserActivity)
  window.removeEventListener('keydown', onUserActivity)
  window.removeEventListener('scroll', onUserActivity)
})
</script>