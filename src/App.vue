<template>
  <router-view />

  <!-- 默认密码修改引导对话框（安全加固） -->
  <el-dialog
    v-model="showDefaultPwdDialog"
    title="⚠️ 检测到默认密码"
    width="420px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    :show-close="false"
  >
    <div style="font-size:14px;line-height:1.7;color:var(--ops-text-primary)">
      当前账号 <b>{{ auth.user?.username }}</b> 仍在使用默认密码
      <b style="color:var(--ops-accent-red)">admin123</b>，存在被入侵风险。<br/>
      请立即修改密码。
    </div>
    <el-form :model="pwdForm" label-width="90px" style="margin-top: 16px">
      <el-form-item label="当前密码">
        <el-input v-model="pwdForm.oldPassword" type="password" show-password placeholder="输入当前默认密码" />
      </el-form-item>
      <el-form-item label="新密码">
        <el-input v-model="pwdForm.newPassword" type="password" show-password placeholder="8-64 位，含字母和数字" />
      </el-form-item>
      <el-form-item label="确认密码">
        <el-input v-model="pwdForm.confirmPassword" type="password" show-password placeholder="再次输入新密码" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button :disabled="pwdSaving" @click="auth.logout()">稍后处理</el-button>
      <el-button type="primary" :loading="pwdSaving" @click="submitDefaultPwdChange">立即修改</el-button>
    </template>
  </el-dialog>

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
import { changePassword } from './api/auth'
import { ElMessage } from 'element-plus'

const themeStore = useThemeStore()
const auth = useAuthStore()

// 全局错误兜底：子组件渲染抛错时避免白屏
onErrorCaptured((err) => {
  console.error('[App] 渲染错误:', err)
  ElMessage.error('页面渲染异常，请刷新重试')
  return false // 阻止错误继续向上抛
})

// ========== 默认密码引导 ==========
const showDefaultPwdDialog = ref(false)
const pwdSaving = ref(false)
const pwdForm = ref({ oldPassword: '', newPassword: '', confirmPassword: '' })

function validatePassword(pwd: string): string | null {
  if (!pwd) return '请输入新密码'
  if (pwd.length < 8) return '密码长度至少 8 字符'
  if (pwd.length > 64) return '密码长度最多 64 字符'
  if (!/[a-zA-Z]/.test(pwd)) return '密码必须包含字母'
  if (!/\d/.test(pwd)) return '密码必须包含数字'
  return null
}

async function submitDefaultPwdChange() {
  if (!pwdForm.value.oldPassword) return ElMessage.warning('请输入当前密码')
  const err = validatePassword(pwdForm.value.newPassword)
  if (err) return ElMessage.warning(err)
  if (pwdForm.value.newPassword !== pwdForm.value.confirmPassword) return ElMessage.warning('两次输入的新密码不一致')
  pwdSaving.value = true
  try {
    await changePassword(pwdForm.value.oldPassword, pwdForm.value.newPassword)
    ElMessage.success('密码修改成功，请使用新密码登录')
    showDefaultPwdDialog.value = false
    auth.logout()
  } catch (e: any) {
    ElMessage.error(e.message || '修改失败')
  } finally {
    pwdSaving.value = false
  }
}


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
  themeStore.initTheme()
  themeStore.watchSystemTheme()

  // 进入页面先验证 token 是否有效，恢复登录状态
  // 失败由 router guard 统一处理 logout，这里不再独立 logout
  if (auth.token) {
    try {
      await auth.fetchMe()
      // 默认密码引导：检测到 admin 仍用 admin123 时弹窗要求修改（安全加固）
      if (auth.user?.is_default_password) {
        showDefaultPwdDialog.value = true
      }
    } catch { /* guard 会处理 */ }
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