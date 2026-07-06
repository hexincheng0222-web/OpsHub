<template>
  <div class="editor-page">
    <!-- Header -->
    <div class="ed-header">
      <button class="back-btn" @click="$router.push('/operations')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        <span>返回手册</span>
      </button>
      <span class="ed-title">{{ isEdit ? '编辑' : '新建' }}操作手册</span>
      <div class="ed-header-right">
        <button v-if="isEdit" class="ed-btn-version" @click="showVersionHistory">📋 版本历史</button>
        <button v-if="!isEdit" class="ed-btn-cancel" @click="$router.push('/operations')">取消</button>
        <button class="ed-btn-save" :disabled="saving" @click="save">{{ saving ? '保存中...' : '💾 保存' }}</button>
      </div>
    </div>

    <!-- Meta row -->
    <div class="ed-meta">
      <input v-model="form.title" class="ed-input-title" placeholder="手册标题">
      <select v-if="isEdit || !route.query.folderId" v-model="form.folderId" class="ed-select">
        <option value="" disabled>选择文件夹</option>
        <option v-for="f in store.folders" :key="f.id" :value="f.id">{{ f.name }}</option>
      </select>
      <span v-else class="ed-folder-label">📂 {{ store.folders.find(f => f.id === form.folderId)?.name || '未选择' }}</span>
    </div>
    <div v-if="saveError" class="ed-error">{{ saveError }}</div>

    <!-- Quill Editor -->
    <div class="ed-body">
      <QuillEditor
        v-if="!versionPreview"
        v-model:content="form.content"
        contentType="html"
        theme="snow"
        :toolbar="toolbarOptions"
        style="height: 100%"
      />
      <div v-else class="version-preview">
        <div class="vp-header">
          <span class="vp-title">📋 预览版本 #{{ versionPreview.versionNumber }}</span>
          <span class="vp-time">{{ versionPreview.createdAt }}</span>
          <div class="vp-actions">
            <el-button size="small" @click="versionPreview = null">返回编辑</el-button>
            <el-button size="small" type="danger" @click="handleRollback(versionPreview)">回滚到此版本</el-button>
          </div>
        </div>
        <div class="vp-content" v-html="versionPreview.content"></div>
      </div>
    </div>

    <!-- 版本历史弹窗 -->
    <el-dialog v-model="versionDialogVisible" title="版本历史" width="700px" destroy-on-close>
      <div v-if="versionsLoading" v-loading="true" style="height:200px"></div>
      <div v-else-if="versions.length === 0" style="text-align:center;padding:40px;color:var(--ops-text-tertiary)">暂无历史版本</div>
      <div v-else class="version-list">
        <div
          v-for="v in versions"
          :key="v.id"
          class="version-item"
          :class="{ active: versionPreview?.id === v.id }"
          @click="previewVersion(v)"
        >
          <div class="vi-left">
            <span class="vi-badge">v{{ v.versionNumber }}</span>
          </div>
          <div class="vi-body">
            <span class="vi-title">{{ v.title }}</span>
            <span class="vi-meta">{{ v.createdAt }} · {{ v.author || '未知' }}</span>
          </div>
          <div class="vi-right">
            <el-button text type="primary" size="small" @click.stop="handleRollback(v)">回滚</el-button>
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import { QuillEditor } from '@vueup/vue-quill'
import '@vueup/vue-quill/dist/vue-quill.snow.css'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useOperationsStore } from '../stores/operations'
import { fetchVersions, rollbackVersion } from '../api/operations'

const route = useRoute()
const router = useRouter()
const store = useOperationsStore()

const isEdit = computed(() => !!route.params.id)
const saveError = ref('')
const saving = ref(false)
const draftKey = computed(() => isEdit.value ? `ops_draft_${route.params.id}` : 'ops_draft_new')

const form = reactive({
  title: '',
  content: '',
  folderId: '',
})

// ---- 草稿自动保存 ----
let draftTimer: ReturnType<typeof setTimeout> | null = null
watch(
  () => [form.title, form.content, form.folderId],
  () => {
    if (draftTimer) clearTimeout(draftTimer)
    draftTimer = setTimeout(() => {
      try {
        localStorage.setItem(draftKey.value, JSON.stringify({
          title: form.title,
          content: form.content,
          folderId: form.folderId,
        }))
      } catch { /* localStorage 满 */ }
    }, 2000)
  },
  { deep: true }
)

// Quill toolbar config
const toolbarOptions = [
  ['bold', 'italic', 'underline', 'strike'],
  ['blockquote', 'code-block'],
  [{ header: 1 }, { header: 2 }, { header: 3 }],
  [{ list: 'ordered' }, { list: 'bullet' }],
  [{ indent: '-1' }, { indent: '+1' }],
  [{ size: ['small', false, 'large', 'huge'] }],
  [{ color: [] }, { background: [] }],
  [{ align: [] }],
  ['clean'],
  ['link', 'image', 'video'],
  ['table'],
]

// Load existing doc for edit mode
onMounted(async () => {
  if (store.folders.length === 0) await store.loadFolders()

  if (isEdit.value) {
    if (!store.getDoc(Number(route.params.id))) await store.loadDocs()
    const doc = store.getDoc(Number(route.params.id))
    if (doc) {
      form.title = doc.title
      form.content = doc.content
      form.folderId = doc.folderId
    }
  } else if (route.query.folderId) {
    form.folderId = route.query.folderId as string
  }

  // 恢复未保存的草稿
  try {
    const raw = localStorage.getItem(draftKey.value)
    if (raw) {
      const draft = JSON.parse(raw)
      if (draft.title || draft.content) {
        const useDraft = await ElMessageBox.confirm(
          '检测到未保存的编辑内容，是否恢复？',
          '恢复草稿',
          { confirmButtonText: '恢复', cancelButtonText: '丢弃', type: 'info' }
        ).catch(() => false)
        if (useDraft) {
          form.title = draft.title
          form.content = draft.content
          form.folderId = draft.folderId || form.folderId
        } else {
          localStorage.removeItem(draftKey.value)
        }
      }
    }
  } catch { /* ignore */ }

  document.addEventListener('keydown', onKeyDown)
})

onBeforeRouteLeave((_to, _from, next) => {
  const draft = localStorage.getItem(draftKey.value)
  if (draft) {
    ElMessageBox.confirm('有未保存的编辑内容，确定离开吗？', '未保存', {
      confirmButtonText: '离开', cancelButtonText: '留下', type: 'warning',
    }).then(() => {
      localStorage.removeItem(draftKey.value)
      next()
    }).catch(() => next(false))
  } else {
    next()
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeyDown)
  if (draftTimer) clearTimeout(draftTimer)
})

function onKeyDown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault()
    save()
  }
}

// ---- 版本历史 ----
const versionDialogVisible = ref(false)
const versions = ref<any[]>([])
const versionsLoading = ref(false)
const versionPreview = ref<any>(null)

async function showVersionHistory() {
  if (!route.params.id) return
  versionDialogVisible.value = true
  versionsLoading.value = true
  try {
    versions.value = await fetchVersions(Number(route.params.id))
  } catch (e: any) {
    ElMessage.error(e.message || '加载版本历史失败')
  } finally {
    versionsLoading.value = false
  }
}

function previewVersion(v: any) {
  versionPreview.value = v
  versionDialogVisible.value = false
}

async function handleRollback(v: any) {
  if (!route.params.id) return
  try {
    await ElMessageBox.confirm(
      `确定回滚到版本 #${v.versionNumber}？当前编辑内容将保存为版本 #${v.versionNumber + 1}。`,
      '回滚确认', { type: 'warning', confirmButtonText: '回滚', cancelButtonText: '取消' }
    )
  } catch { return }

  try {
    const doc = await rollbackVersion(Number(route.params.id), v.id)
    form.title = doc.title
    form.content = doc.content
    versionPreview.value = null
    versionDialogVisible.value = false
    ElMessage.success(`已回滚到版本 #${v.versionNumber}`)
  } catch (e: any) {
    ElMessage.error(e.message || '回滚失败')
  }
}

async function save() {
  if (saving.value) return
  saveError.value = ''
  if (!form.title.trim()) { saveError.value = '请输入标题'; return }
  if (!form.folderId) { saveError.value = '请选择文件夹'; return }
  saving.value = true
  try {
    if (isEdit.value) {
      await store.updateDoc(Number(route.params.id), { ...form })
    } else {
      await store.addDoc({
        title: form.title,
        content: form.content,
        folderId: form.folderId,
      })
    }
    localStorage.removeItem(draftKey.value)
    router.push('/operations')
  } catch (e: any) {
    saveError.value = e.message || '保存失败'
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.editor-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--ops-bg-page);
  overflow: hidden;
}

/* Header */
.ed-header {
  display: flex; align-items: center; gap: 16px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--ops-border-card);
  flex-shrink: 0;
}
.back-btn {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 6px 14px 6px 10px;
  background: var(--ops-bg-card-hover);
  border: 1px solid var(--ops-border-card);
  border-radius: 20px;
  color: var(--ops-text-secondary);
  cursor: pointer; font-size: 12px; font-family: inherit;
  transition: all 0.2s ease;
}
.back-btn svg { transition: transform 0.2s ease; }
.back-btn:hover { color: var(--ops-accent-blue); border-color: rgba(88,166,255,0.3); }
.back-btn:hover svg { transform: translateX(-2px); }
.ed-title { font-size: 15px; font-weight: 700; color: var(--ops-text-primary); flex: 1; }
.ed-header-right { display: flex; gap: 8px; }
.ed-btn-cancel {
  background: var(--ops-bg-card-hover); border: 1px solid var(--ops-border-card);
  color: var(--ops-text-secondary); cursor: pointer;
  font-size: 12px; padding: 5px 14px; border-radius: 6px; font-family: inherit;
}
.ed-btn-save {
  background: rgba(88,166,255,0.15); border: 1px solid rgba(88,166,255,0.3);
  color: var(--ops-accent-blue); cursor: pointer;
  font-size: 12px; padding: 5px 14px; border-radius: 6px;
  font-weight: 600; font-family: inherit;
}
.ed-btn-save:hover { background: rgba(88,166,255,0.25); }
.ed-btn-version {
  background: transparent; border: 1px solid var(--ops-border-card);
  color: var(--ops-text-secondary); cursor: pointer;
  font-size: 12px; padding: 5px 14px; border-radius: 6px; font-family: inherit;
}
.ed-btn-version:hover { background: var(--ops-bg-card-hover); color: var(--ops-text-primary); }

/* Meta row */
.ed-meta {
  display: flex; gap: 12px; padding: 8px 16px;
  border-bottom: 1px solid var(--ops-border-card);
  flex-shrink: 0;
}
.ed-input-title {
  flex: 2; background: var(--ops-bg-card-hover);
  border: 1px solid var(--ops-border-card);
  color: var(--ops-text-primary); font-size: 14px; font-weight: 600;
  padding: 6px 10px; border-radius: 6px; outline: none; font-family: inherit;
}
.ed-input-title:focus { border-color: var(--ops-accent-blue); }
.ed-folder-label {
  font-size: 13px; color: var(--ops-text-secondary);
  padding: 7px 12px; white-space: nowrap;
  display: flex; align-items: center; gap: 6px;
}
.ed-select {
  flex: 1; background: var(--ops-bg-card-hover);
  border: 1px solid var(--ops-border-card);
  color: var(--ops-text-primary); font-size: 13px;
  padding: 6px 10px; border-radius: 6px; outline: none; font-family: inherit;
}
.ed-select:focus { border-color: var(--ops-accent-blue); }
.ed-error {
  padding: 4px 16px;
  color: var(--ops-accent-red); font-size: 12px;
  font-weight: 600; flex-shrink: 0;
  border-bottom: 1px solid var(--ops-border-card);
  background: rgba(220,50,50,0.08);
}

/* Body */
.ed-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Quill editor height fix */
.ed-body :deep(.ql-container) {
  flex: 1;
  min-height: 0;
}

.ed-body :deep(.ql-editor) {
  min-height: 100%;
}

/* 版本预览 */
.version-preview {
  flex: 1; display: flex; flex-direction: column; overflow: hidden;
}
.vp-header {
  display: flex; align-items: center; gap: 12px; padding: 8px 16px;
  background: var(--ops-bg-card-hover); border-bottom: 1px solid var(--ops-border-card);
  flex-shrink: 0;
}
.vp-title { font-size: 13px; font-weight: 600; color: var(--ops-text-primary); }
.vp-time { font-size: 11px; color: var(--ops-text-tertiary); flex: 1; }
.vp-actions { display: flex; gap: 8px; }
.vp-content {
  flex: 1; overflow-y: auto; padding: 20px 24px;
  color: var(--ops-text-primary); font-size: 14px; line-height: 1.8;
}

/* 版本列表 */
.version-list { max-height: 400px; overflow-y: auto; }
.version-item {
  display: flex; align-items: center; gap: 12px; padding: 10px 12px;
  border-bottom: 1px solid var(--ops-border-card); cursor: pointer;
  transition: background 0.15s;
}
.version-item:hover { background: var(--ops-bg-card-hover); }
.version-item.active { background: rgba(88,166,255,0.08); }
.vi-badge {
  font-size: 11px; font-weight: 700; color: var(--ops-accent-blue);
  background: rgba(88,166,255,0.1); padding: 2px 8px; border-radius: 10px;
  white-space: nowrap;
}
.vi-body { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.vi-title { font-size: 13px; color: var(--ops-text-primary); }
.vi-meta { font-size: 11px; color: var(--ops-text-tertiary); }
</style>
