<script setup lang="ts">
import { useLoginForm } from '../composables/useLoginForm'

const { form, formRef, rules, loading, rememberUsername, handleLogin } = useLoginForm()
defineExpose({ formRef })
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <h1 class="login-title">OpsHub</h1>
      <p class="login-subtitle">运维管理平台</p>

      <el-form ref="formRef" :model="form" :rules="rules" @submit.prevent="handleLogin" class="login-form">
        <el-form-item prop="username">
          <el-input
            v-model="form.username"
            placeholder="用户名"
            size="large"
          />
        </el-form-item>

        <el-form-item prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="密码"
            size="large"
            show-password
          />
        </el-form-item>

        <div class="remember-row">
          <el-checkbox v-model="rememberUsername" size="small">记住账号</el-checkbox>
        </div>

        <el-button
          type="primary"
          size="large"
          :loading="loading"
          native-type="submit"
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

.remember-row {
  display: flex;
  gap: 16px;
  margin-top: -8px;
}
</style>
