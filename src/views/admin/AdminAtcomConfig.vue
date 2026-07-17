<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchConfig, saveConfig } from '../../api/admin'
import { Phone, Connection, Loading } from '@element-plus/icons-vue'

interface ConfigItem {
  key: string
  value: string
  description: string
  updated_at: string
}

const loading = ref(true)
const saving = ref(false)
const configs = ref<ConfigItem[]>([])
const form = ref({
  pbx_ip: '192.168.35.250',
  pbx_user: 'admin',
  pbx_pass: '',  // 默认置空，留空则不修改 (#6)
})

onMounted(async () => {
  try {
    const data = await fetchConfig()
    configs.value = data
    for (const cfg of data) {
      if (cfg.key === 'atcom_pbx_ip') form.value.pbx_ip = cfg.value
      if (cfg.key === 'atcom_pbx_user') form.value.pbx_user = cfg.value
      if (cfg.key === 'atcom_pbx_pass') form.value.pbx_pass = cfg.value
    }
  } catch (e) {
    console.error('加载配置失败:', e)
    ElMessage.warning('ATCOM 配置加载失败，请刷新重试')
  } finally {
    loading.value = false
  }
})

async function handleSave() {
  saving.value = true
  try {
    await saveConfig([
      { key: 'atcom_pbx_ip', value: form.value.pbx_ip },
      { key: 'atcom_pbx_user', value: form.value.pbx_user },
      { key: 'atcom_pbx_pass', value: form.value.pbx_pass },
    ])
    ElMessage.success('配置已保存')
  } catch (e: any) {
    ElMessage.error(e.message || '保存失败')
  } finally {
    saving.value = false
  }
}

function getLastUpdated() {
  const cfg = configs.value.find(c => c.key === 'atcom_pbx_ip')
  if (!cfg?.updated_at) return ''
  return cfg.updated_at.replace('T', ' ').slice(0, 19)
}
</script>

<template>
  <div class="atcom-config" v-loading="loading">
    <div class="config-header">
      <div class="header-info">
        <el-icon :size="28" class="header-icon"><Phone /></el-icon>
        <div>
          <h3>ATCOM 话机管理配置</h3>
          <p class="header-desc">配置 IPPBX200 PBX 连接信息，用于自动发现和管控 ATCOM IP 话机</p>
        </div>
      </div>
    </div>

    <el-card class="config-card" shadow="never">
      <template #header>
        <div class="card-header">
          <div class="card-header-left">
            <el-icon :size="16"><Connection /></el-icon>
            <span>IPPBX200 连接配置</span>
          </div>
          <span v-if="getLastUpdated()" class="last-updated">
            上次更新: {{ getLastUpdated() }}
          </span>
        </div>
      </template>

      <el-form label-width="120px" label-position="left" class="config-form">
        <el-form-item label="PBX IP 地址">
          <el-input
            v-model="form.pbx_ip"
            placeholder="例如: 192.168.35.250"
            clearable
            style="max-width: 360px;"
          />
          <div class="form-tip">IPPBX200 设备的管理 IP 地址</div>
        </el-form-item>

        <el-form-item label="登录用户名">
          <el-input
            v-model="form.pbx_user"
            placeholder="默认: admin"
            clearable
            style="max-width: 360px;"
          />
          <div class="form-tip">IPPBX200 Web 管理界面登录账号</div>
        </el-form-item>

        <el-form-item label="登录密码">
          <el-input
            v-model="form.pbx_pass"
            type="password"
            show-password
            placeholder="留空则不修改"
            clearable
            style="max-width: 360px;"
          />
          <div class="form-tip">IPPBX200 Web 管理界面登录密码</div>
        </el-form-item>

        <el-form-item>
          <el-button
            type="primary"
            :icon="saving ? Loading : undefined"
            :loading="saving"
            @click="handleSave"
          >
            保存配置
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="info-card" shadow="never">
      <template #header>
        <span>配置说明</span>
      </template>
      <div class="info-content">
        <div class="info-item">
          <strong>设备发现流程：</strong>
          <span>登录 IPPBX200 → 获取分机列表 → 刷新在线状态 → 提取话机 IP</span>
        </div>
        <div class="info-item">
          <strong>话机网段：</strong>
          <span>10.21.2.0/24（DHCP 自动分配）</span>
        </div>
        <div class="info-item">
          <strong>默认账号：</strong>
          <span>IPPBX200 和 ATCOM 话机出厂默认账号请查阅设备文档，部署后请立即修改默认密码</span>
        </div>
        <div class="info-item">
          <strong>安全建议：</strong>
          <span>务必修改设备出厂默认密码；LuCI session 有超时机制，系统会自动重新登录</span>
        </div>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.atcom-config {
  width: 100%;
  max-width: 800px;
}

.config-header {
  margin-bottom: 24px;
}

.header-info {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}

.header-icon {
  color: var(--ops-accent-blue, #58a6ff);
  margin-top: 2px;
}

.header-info h3 {
  margin: 0 0 4px 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--ops-text-primary, #e6edf3);
}

.header-desc {
  margin: 0;
  font-size: 13px;
  color: var(--ops-text-secondary, #8b949e);
}

.config-card {
  margin-bottom: 16px;
  border-color: var(--ops-border-card, rgba(255,255,255,.08));
  background: var(--ops-bg-card, rgba(255,255,255,.03));
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: var(--ops-text-primary, #e6edf3);
}

.last-updated {
  font-size: 12px;
  color: var(--ops-text-secondary, #8b949e);
  font-weight: 400;
}

.config-form {
  padding-top: 8px;
}

.form-tip {
  font-size: 12px;
  color: var(--ops-text-secondary, #8b949e);
  margin-top: 4px;
  line-height: 1.4;
}

.info-card {
  border-color: var(--ops-border-card, rgba(255,255,255,.08));
  background: var(--ops-bg-card, rgba(255,255,255,.03));
}

.info-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.info-item {
  font-size: 13px;
  color: var(--ops-text-secondary, #8b949e);
  line-height: 1.5;
}

.info-item strong {
  color: var(--ops-text-primary, #e6edf3);
  margin-right: 4px;
}
</style>
