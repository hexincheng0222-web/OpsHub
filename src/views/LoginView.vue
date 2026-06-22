<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth = useAuthStore()

const username = ref('')
const password = ref('')
const loading = ref(false)

async function handleLogin() {
  if (!username.value || !password.value) {
    ElMessage.warning('请输入用户名和密码')
    return
  }

  loading.value = true
  try {
    await auth.login(username.value, password.value)
    ElMessage.success('登录成功')
    router.push('/')
  } catch (e: any) {
    ElMessage.error(e.message || '登录失败')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <h1 class="login-title">OpsHub</h1>
      <p class="login-subtitle">运维管理平台</p>

      <el-form @submit.prevent="handleLogin" class="login-form">
        <el-form-item>
          <el-input
            v-model="username"
            placeholder="用户名"
            size="large"
          />
        </el-form-item>

        <el-form-item>
          <el-input
            v-model="password"
            type="password"
            placeholder="密码"
            size="large"
            show-password
            @keyup.enter="handleLogin"
          />
        </el-form-item>

        <el-button
          type="primary"
          size="large"
          :loading="loading"
          @click="handleLogin"
          style="width: 100%"
        >
          登录
        </el-button>
      </el-form>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--ops-bg-page, #0d1117);
}

.login-card {
  width: 360px;
  padding: 40px;
  background: var(--ops-bg-card, #161b22);
  border: 1px solid var(--ops-border-card, #30363d);
  border-radius: 12px;
}

.login-title {
  text-align: center;
  font-size: 28px;
  font-weight: 600;
  color: var(--ops-text-primary, #e6edf3);
  margin: 0 0 4px;
}

.login-subtitle {
  text-align: center;
  font-size: 14px;
  color: var(--ops-text-tertiary, #7d8590);
  margin: 0 0 32px;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
</style>
