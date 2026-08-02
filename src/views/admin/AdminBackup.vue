<template>
  <div class="backup-page">
    <div class="page-header">
      <div class="header-left">
        <span class="page-title">数据备份</span>
        <span class="total-text">共 {{ backups.length }} 份备份</span>
      </div>
      <div class="header-actions">
        <el-button type="primary" size="small" :loading="backingUp" @click="handleBackup">
          <el-icon><Refresh /></el-icon> 立即备份
        </el-button>
      </div>
    </div>

    <el-alert
      type="info"
      :closable="false"
      show-icon
      style="margin-bottom: 16px"
      title="备份说明"
      description="数据库备份为 gzip 压缩的一致性快照，位于 data/backups/ 目录，默认保留 7 天，每日自动备份由 CI 或 cron 触发。"
    />

    <el-table :data="backups" v-loading="loading" size="small" style="width: 100%">
      <el-table-column prop="filename" label="备份文件" min-width="240" show-overflow-tooltip />
      <el-table-column label="大小" width="110" align="right">
        <template #default="{ row }">
          <span>{{ row.size_kb }} KB</span>
        </template>
      </el-table-column>
      <el-table-column prop="created_at" label="备份时间" width="170" />
      <el-table-column label="操作" width="110" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" text size="small" @click="handleDownload(row.filename)">下载</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-empty v-if="!loading && backups.length === 0" description="暂无备份，点击「立即备份」生成第一份" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import { fetchBackupList, triggerBackup, downloadBackup, type BackupFile } from '../../api/backup'

const backups = ref<BackupFile[]>([])
const loading = ref(false)
const backingUp = ref(false)

async function loadBackups() {
  loading.value = true
  try {
    backups.value = await fetchBackupList()
  } catch (e: any) {
    ElMessage.error(e.message || '加载备份列表失败')
  } finally {
    loading.value = false
  }
}

async function handleBackup() {
  backingUp.value = true
  try {
    await triggerBackup()
    ElMessage.success('备份完成')
    loadBackups()
  } catch (e: any) {
    ElMessage.error(e.message || '备份失败')
  } finally {
    backingUp.value = false
  }
}

function handleDownload(filename: string) {
  downloadBackup(filename)
}

onMounted(loadBackups)
</script>

<style scoped>
.backup-page { width: 100%; }
.page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.header-left { display: flex; align-items: baseline; gap: 12px; }
.page-title { font-size: 16px; font-weight: 500; color: var(--ops-text-primary); }
.total-text { font-size: 12px; color: var(--ops-text-tertiary); }
.header-actions { display: flex; align-items: center; gap: 8px; }
</style>
