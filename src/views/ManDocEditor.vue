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
        <button v-if="!isEdit" class="ed-btn-cancel" @click="$router.push('/operations')">取消</button>
        <button class="ed-btn-save" @click="save">💾 保存</button>
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

    <!-- Editor body -->
    <div class="ed-body">
      <div class="ed-pane ed-pane-left">
        <div class="ed-pane-header">📝 编辑</div>
        <div class="ed-editor-wrap">
          <textarea
            ref="editorRef"
            v-model="form.content"
            class="ed-textarea"
            placeholder="在此编写 Markdown 内容...
            
支持 Ctrl+V 粘贴图片（自动转 base64）
支持 Markdown 语法排版"
            @paste="handlePaste"
            @keydown.tab.prevent="insertTab"
          />
        </div>
      </div>
      <div class="ed-pane ed-pane-right">
        <div class="ed-pane-header">👁️ 预览</div>
        <div class="ed-preview-wrap">
          <div class="markdown-body" v-html="previewHtml" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { marked } from 'marked'
import { sanitizeHtml } from '../utils/sanitize'
import { useOperationsStore } from '../stores/operations'

const route = useRoute()
const router = useRouter()
const store = useOperationsStore()

const renderer = new marked.Renderer()
renderer.heading = function (token: any) {
  const text = this.parser.parseInline(token.tokens)
  const id = text.toLowerCase().replace(/<[^>]*>/g, '').replace(/[^\w\u4e00-\u9fff]+/g, '-').replace(/(^-|-$)/g, '')
  return `<h${token.depth} id="${id}">${text}</h${token.depth}>\n`
}
marked.setOptions({ renderer, breaks: true, gfm: true })

const isEdit = computed(() => !!route.params.id)
const editorRef = ref<HTMLTextAreaElement>()
const saveError = ref('')

const form = reactive({
  title: '',
  content: '',
  folderId: '',
})

// Load existing doc for edit mode, or pre-select folder for new
onMounted(async () => {
  // 确保文件夹列表已加载
  if (store.folders.length === 0) await store.loadFolders()

  if (isEdit.value) {
    // 确保文档数据已加载
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
  // Ctrl+S save
  document.addEventListener('keydown', onKeyDown)
})
onUnmounted(() => {
  document.removeEventListener('keydown', onKeyDown)
})

function onKeyDown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault()
    save()
  }
}

// Live preview (XSS-safe)
const previewHtml = computed(() => {
  const raw = marked.parse(form.content) as string
  return sanitizeHtml(raw)
})

// Auto-save draft
const DRAFT_KEY = 'ops-editor-draft'
let draftTimer: ReturnType<typeof setInterval> | null = null
let dirty = false
watch(() => form.content, () => { dirty = true })
onMounted(() => {
  draftTimer = setInterval(() => {
    if (!dirty) return
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({
      title: form.title, content: form.content,
      folderId: form.folderId,
      editId: route.params.id || '',
    }))
  }, 3000)
  // Listen for beforeunload
  window.addEventListener('beforeunload', onBeforeUnload)
})
onUnmounted(() => {
  if (draftTimer) clearInterval(draftTimer)
  window.removeEventListener('beforeunload', onBeforeUnload)
})
function onBeforeUnload(e: BeforeUnloadEvent) {
  if (dirty) {
    e.preventDefault()
    e.returnValue = ''
  }
}

// Save
async function save() {
  saveError.value = ''
  if (!form.title.trim()) { saveError.value = '请输入标题'; return }
  if (!form.folderId) { saveError.value = '请选择文件夹'; return }
  if (isEdit.value) {
    await store.updateDoc(Number(route.params.id), { ...form })
  } else {
    await store.addDoc({
      title: form.title,
      content: form.content,
      folderId: form.folderId,
    })
  }
  dirty = false
  sessionStorage.removeItem(DRAFT_KEY)
  router.push('/operations')
}

// Image paste → base64
function handlePaste(e: ClipboardEvent) {
  const items = e.clipboardData?.items
  if (!items) return
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      e.preventDefault()
      const blob = item.getAsFile()
      if (!blob) continue
      const reader = new FileReader()
      reader.onload = () => {
        const base64 = reader.result as string
        const mdImage = `![image](${base64})`
        insertAtCursor(mdImage)
      }
      reader.readAsDataURL(blob)
    }
  }
}

// Insert text at cursor position
function insertAtCursor(text: string) {
  const el = editorRef.value
  if (!el) return
  const start = el.selectionStart
  const end = el.selectionEnd
  form.content = form.content.substring(0, start) + text + form.content.substring(end)
  // Set cursor after inserted text
  requestAnimationFrame(() => {
    el.focus()
    el.selectionStart = el.selectionEnd = start + text.length
  })
}

// Tab key → 2 spaces
function insertTab() {
  insertAtCursor('  ')
}

function formatNow() {
  const n = new Date()
  const pad = (v: number) => String(v).padStart(2, '0')
  return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())} ${pad(n.getHours())}:${pad(n.getMinutes())}`
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
.ed-input-author {
  width: 120px; background: var(--ops-bg-card-hover);
  border: 1px solid var(--ops-border-card);
  color: var(--ops-text-secondary); font-size: 13px;
  padding: 6px 10px; border-radius: 6px; outline: none; font-family: inherit;
}
.ed-input-author:focus { border-color: var(--ops-accent-blue); }
.ed-error {
  padding: 4px 16px;
  color: #f87171; font-size: 12px;
  font-weight: 600; flex-shrink: 0;
  border-bottom: 1px solid var(--ops-border-card);
  background: rgba(220,50,50,0.08);
}

/* Body */
.ed-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}
.ed-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.ed-pane-left { border-right: 1px solid var(--ops-border-card); }
.ed-pane-header {
  font-size: 11px; font-weight: 600; color: var(--ops-text-tertiary);
  text-transform: uppercase; letter-spacing: 0.5px;
  padding: 8px 16px;
  background: var(--ops-bg-card);
  border-bottom: 1px solid var(--ops-border-card);
  flex-shrink: 0;
}
.ed-editor-wrap { flex: 1; overflow: hidden; }
.ed-textarea {
  width: 100%; height: 100%;
  background: var(--ops-bg-page);
  border: none; outline: none;
  color: var(--ops-text-primary);
  font-family: 'SF Mono', 'Consolas', 'Courier New', monospace;
  font-size: 13px; line-height: 1.7;
  padding: 16px; resize: none;
  tab-size: 2;
}
.ed-textarea::placeholder { color: var(--ops-text-tertiary); }

.ed-preview-wrap {
  flex: 1; overflow-y: auto; padding: 24px 32px;
  max-width: 800px;
}

/* Markdown styles (same as viewer) */
.markdown-body {
  color: var(--ops-text-primary);
  font-size: 14px;
  line-height: 1.8;
}
.markdown-body :deep(h1) { font-size: 24px; margin: 0 0 16px 0; padding-bottom: 8px; border-bottom: 1px solid var(--ops-border-card); }
.markdown-body :deep(h2) { font-size: 18px; margin: 28px 0 12px 0; }
.markdown-body :deep(h3) { font-size: 15px; margin: 20px 0 8px 0; }
.markdown-body :deep(p) { margin: 8px 0; }
.markdown-body :deep(strong) { color: var(--ops-accent-blue); }
.markdown-body :deep(code) {
  background: var(--ops-bg-card-hover);
  padding: 2px 6px; border-radius: 4px;
  font-family: 'SF Mono', 'Consolas', monospace;
  font-size: 13px; color: #e3b341;
}
.markdown-body :deep(pre) {
  background: #0d1117; border: 1px solid #21262d;
  border-radius: 8px; padding: 16px; overflow-x: auto; margin: 12px 0;
}
.markdown-body :deep(pre code) {
  background: none; padding: 0; color: #c9d1d9; font-size: 13px;
}
.markdown-body :deep(table) { border-collapse: collapse; width: 100%; margin: 12px 0; }
.markdown-body :deep(th) {
  background: var(--ops-bg-card-hover); color: var(--ops-text-primary);
  font-weight: 600; font-size: 12px; padding: 8px 12px; text-align: left;
  border: 1px solid var(--ops-border-card);
}
.markdown-body :deep(td) {
  padding: 8px 12px; font-size: 13px;
  border: 1px solid var(--ops-border-card); color: var(--ops-text-secondary);
}
.markdown-body :deep(blockquote) {
  border-left: 3px solid var(--ops-accent-yellow);
  margin: 12px 0; padding: 8px 16px;
  background: rgba(210,153,34,0.06); color: var(--ops-text-secondary);
  border-radius: 0 6px 6px 0;
}
.markdown-body :deep(ul), .markdown-body :deep(ol) { padding-left: 24px; margin: 8px 0; }
.markdown-body :deep(li) { margin: 4px 0; }
.markdown-body :deep(hr) { border: none; border-top: 1px solid var(--ops-border-card); margin: 24px 0; }
.markdown-body :deep(a) { color: var(--ops-accent-blue); }
.markdown-body :deep(img) { max-width: 100%; border-radius: 8px; margin: 8px 0; }
</style>
