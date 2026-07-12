<template>
  <div class="ops-page" v-loading="loading" element-loading-text="加载中...">
    <!-- Sidebar -->
    <aside class="ops-sidebar">
      <div class="sb-header">
        <span class="sb-title">📚 操作手册</span>
        <div class="sb-header-actions">
          <button class="sb-add-btn" @click="showAddFolder = true" title="新建文件夹">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
        </div>
      </div>

      <!-- Search -->
      <div class="sb-search">
        <input ref="searchInputRef" v-model="searchQuery" class="sb-search-input" placeholder="搜索手册... (Ctrl+K)">
        <button v-if="searchQuery" class="sb-search-clear" @click="clearSearch(); searchInputRef?.focus()" title="清空">✕</button>
      </div>

      <!-- Sidebar Tabs: All / Favorites -->
      <div class="sb-tabs">
        <div class="sb-tab" :class="{ active: sidebarTab === 'all' }" @click="sidebarTab = 'all'">📁 所有文件夹</div>
        <div class="sb-tab" :class="{ active: sidebarTab === 'fav' }" @click="sidebarTab = 'fav'">⭐ 收藏夹</div>
      </div>

      <div class="sb-list" ref="sbListRef" role="tree">
        <!-- Favorites mode -->
        <template v-if="sidebarTab === 'fav'">
          <div v-if="favoriteDocs.length === 0" class="sb-empty">暂无收藏文档 — 点击文档标题旁的 ☆ 收藏</div>
          <div
            v-for="doc in favoriteDocs" :key="doc.id"
            class="sb-doc sb-doc-flat"
            :class="{ active: selectedDoc?.id === doc.id }"
            role="treeitem"
            tabindex="0"
            :aria-selected="selectedDoc?.id === doc.id"
            @click="selectDoc(doc)"
            @keydown.enter="selectDoc(doc)"
          >
            <span class="sb-doc-icon">📄</span>
            <div class="sb-doc-info">
              <span class="sb-doc-title">{{ doc.title }}</span>
              <span class="sb-doc-meta">{{ getFolderName(doc.folderId) }}</span>
            </div>
          </div>
        </template>
        <!-- Search results mode -->
        <template v-else-if="searchQuery">
          <div v-if="searchResults.length === 0" class="sb-empty">无匹配结果</div>
          <div
            v-for="doc in searchResults" :key="doc.id"
            class="sb-doc sb-doc-flat"
            :class="{ active: selectedDoc?.id === doc.id }"
            role="treeitem"
            tabindex="0"
            :aria-selected="selectedDoc?.id === doc.id"
            @click="selectDoc(doc)"
            @keydown.enter="selectDoc(doc)"
          >
            <span class="sb-doc-icon">📄</span>
            <div class="sb-doc-info">
              <span class="sb-doc-title">{{ doc.title }}</span>
              <span class="sb-doc-meta">{{ getFolderName(doc.folderId) }}</span>
            </div>
          </div>
        </template>

        <!-- Folder tree mode -->
        <template v-else-if="sidebarTab === 'all'">
          <div v-for="folder in store.folders" :key="folder.id" class="sb-folder" :class="{ open: openFolder === folder.id }">
            <div class="sb-folder-row" @click="toggleFolder(folder.id)" @contextmenu.prevent="openContextMenu($event, folder)" role="treeitem" tabindex="0" :aria-expanded="openFolder === folder.id" @keydown.enter="toggleFolder(folder.id)">
              <span class="sb-arrow">{{ openFolder === folder.id ? '▾' : '▸' }}</span>
              <span class="sb-folder-icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              </span>
              <span class="sb-folder-name">{{ folder.name }}</span>
              <span class="sb-count">{{ getDocs(folder.id).length }}</span>
              <button class="sb-folder-add-doc" @click.stop="newDocInFolder(folder.id)" title="在此文件夹新建文档">＋</button>
            </div>
            <div v-if="openFolder === folder.id" class="sb-docs">
              <div
                v-for="doc in getDocs(folder.id)"
                :key="doc.id"
                class="sb-doc"
                :class="{ active: selectedDoc?.id === doc.id }"
                role="treeitem"
                tabindex="0"
                :aria-selected="selectedDoc?.id === doc.id"
                @click="selectDoc(doc)"
                @keydown.enter="selectDoc(doc)"
              >
                <span class="sb-doc-icon">📄</span>
                <span class="sb-doc-title">{{ doc.title }}</span>
              </div>
              <div v-if="getDocs(folder.id).length === 0" class="sb-empty">暂无文档 — 点击 ＋ 新建</div>
            </div>
          </div>
        </template>
      </div>
    </aside>

    <!-- Main -->
    <main class="ops-main">
      <!-- Empty state -->
      <div v-if="!selectedDoc" class="ops-empty">
        <span class="ops-empty-icon">📖</span>
        <p>选择一个手册文档开始阅读</p>
        <p class="ops-empty-sub">左侧目录树点击文档即可查看内容</p>
        <button class="ops-empty-btn" @click="newDoc()">＋ 新建手册</button>
      </div>

      <!-- Document viewer -->
      <template v-else>
        <div class="ops-doc-header">
          <BackButton to="/" />
          <h2 class="doc-title">{{ selectedDoc.title }}</h2>
          <div class="doc-actions">
            <button class="act-btn" @click="onToggleFavorite">
              <span v-if="selectedDoc && store.isFavorited(selectedDoc.id)" title="取消收藏">★</span>
              <span v-else title="收藏文档">☆</span>
            </button>
            <button class="act-btn" @click="importDoc">📥 导入</button>
            <el-dropdown @command="handleExport" trigger="click">
              <button class="act-btn">📤 导出 ▾</button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="md">Markdown (.md)</el-dropdown-item>
                  <el-dropdown-item command="docx">Word (.doc)</el-dropdown-item>
                  <el-dropdown-item command="html">HTML (.html)</el-dropdown-item>
                  <el-dropdown-item command="print">打印</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
            <button class="act-btn" @click="editDoc(selectedDoc.id)">✏️ 编辑</button>
            <button class="act-btn act-btn-danger" @click="confirmDelete">🗑️ 删除</button>
          </div>
        </div>
        <div class="ops-doc-subhead">
          <span class="doc-folder-tag">{{ getFolderName(selectedDoc.folderId) }}</span>
          <span>更新于 {{ selectedDoc.updateTime }}</span>
          <span class="doc-stats">{{ wordCount }} 字 · {{ readTime }} 分钟</span>
        </div>
        <div class="ops-doc-content">
          <div class="ops-doc-body" @scroll="onDocScroll">
            <div class="markdown-body" v-html="renderedContent" />
          </div>
          <aside v-if="tocItems.length > 0" class="ops-toc">
            <div class="toc-title">目录</div>
            <a
              v-for="item in tocItems" :key="item.id"
              :href="'#' + item.id"
              class="toc-link"
              :class="{ active: activeHeading === item.id }"
              :style="{ paddingLeft: (item.level - 2) * 12 + 8 + 'px' }"
              @click.prevent="scrollToHeading(item.id)"
            >{{ item.text }}</a>
          </aside>
        </div>
      </template>
    </main>

    <!-- Folder context menu -->
    <Teleport to="body">
      <div v-if="contextMenu.visible" class="ctx-overlay" @click="closeContextMenu" @contextmenu.prevent="closeContextMenu">
        <div class="ctx-menu" :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }">
          <div class="ctx-item" @click="renameFolderAction">✏️ 重命名</div>
          <div class="ctx-item ctx-item-danger" @click="deleteFolderAction">🗑️ 删除文件夹</div>
        </div>
      </div>
    </Teleport>

    <!-- Rename Folder Dialog -->
    <Teleport to="body">
      <div v-if="showRenameDialog" class="mo-overlay" role="dialog" aria-modal="true" aria-label="重命名文件夹" @click.self="showRenameDialog = false">
        <div class="mo-dialog">
          <div class="mo-dlg-header">重命名文件夹</div>
          <div class="mo-body">
            <label class="mo-field"><span>新名称</span><input v-model="renameForm.name" class="mo-input" maxlength="50" @keyup.enter="doRename"></label>
          </div>
          <div class="mo-footer">
            <button class="mo-btn-cancel" @click="showRenameDialog = false">取消</button>
            <button class="mo-btn-confirm" @click="doRename">确定</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Add Folder Dialog -->
    <Teleport to="body">
      <div v-if="showAddFolder" class="mo-overlay" role="dialog" aria-modal="true" aria-label="新建文件夹" @click.self="showAddFolder = false">
        <div class="mo-dialog">
          <div class="mo-dlg-header">新建文件夹</div>
          <div class="mo-body">
            <label class="mo-field"><span>名称</span><input v-model="newFolder.name" class="mo-input" placeholder="如：网络运维" maxlength="50" @keyup.enter="createFolder"></label>
          </div>
          <div class="mo-footer">
            <button class="mo-btn-cancel" @click="showAddFolder = false">取消</button>
            <button class="mo-btn-confirm" @click="createFolder">确定</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Import Dialog -->
    <el-dialog v-model="showImportDialog" title="导入文档" width="480px" destroy-on-close>
      <el-form label-width="70px">
        <el-form-item label="文件">
          <input ref="importFileInput" type="file" accept=".md,.html,.htm,.txt,.docx" style="width:100%" @change="onImportFileChange" />
          <div class="import-tip">支持 Markdown (.md)、HTML (.html)、纯文本 (.txt)、Word (.docx)</div>
        </el-form-item>
        <el-form-item label="标题">
          <el-input v-model="importForm.title" placeholder="文档标题" />
        </el-form-item>
        <el-form-item label="文件夹">
          <el-select v-model="importForm.folderId" placeholder="选择文件夹" style="width:100%">
            <el-option v-for="f in store.folders" :key="f.id" :label="f.name" :value="f.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showImportDialog = false">取消</el-button>
        <el-button type="primary" @click="doImport" :disabled="!importForm.title || !importForm.folderId || !importForm.content || importForm.loading">
          <span v-if="importForm.loading">解析中...</span>
          <span v-else>导入</span>
        </el-button>
      </template>
    </el-dialog>

    <!-- Delete Confirm -->
    <Teleport to="body">
      <div v-if="showDeleteConfirm" class="mo-overlay" role="dialog" aria-modal="true" aria-label="确认删除" @click.self="showDeleteConfirm = false">
        <div class="mo-dialog" style="width:360px">
          <div class="mo-dlg-header">确认删除</div>
          <div class="mo-body">
            <p style="color:var(--ops-text-secondary);margin:0">确定删除「{{ deleteTargetTitle }}」吗？此操作不可恢复。</p>
          </div>
          <div class="mo-footer">
            <button class="mo-btn-cancel" @click="showDeleteConfirm = false">取消</button>
            <button class="mo-btn-danger" @click="doDelete">删除</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { marked } from 'marked'
import { sanitizeHtml } from '../utils/sanitize'
import { ElMessageBox } from 'element-plus'
import { useOperationsStore } from '../stores/operations'
import { useDebouncedSearch } from '../composables/useDebouncedSearch'
import type { ManualDoc, ManualFolder } from '../mock/operations'
import BackButton from '../components/BackButton.vue'

// Marked config for reading mode (docs stored as Markdown)
const renderer = new marked.Renderer()
renderer.heading = function (token: any) {
  const text = this.parser.parseInline(token.tokens)
  const id = text
    .toLowerCase()
    .replace(/<[^>]*>/g, '')
    .replace(/[^\w一-鿿]+/g, '-')
    .replace(/(^-|-$)/g, '')
  return `<h${token.depth} id="${id}">${text}</h${token.depth}>\n`
}
marked.setOptions({ renderer, breaks: true, gfm: true })

const router = useRouter()
const store = useOperationsStore()
const loading = ref(true)

// ---- Search (debounced) ----
const searchInputRef = ref<HTMLInputElement>()
const { searchInput: searchQuery, search: searchDebounced, clearSearch } = useDebouncedSearch(250)
const searchResults = computed(() => {
  const q = searchDebounced.value.toLowerCase()
  if (!q) return []
  return store.manuals.filter(m =>
    m.title.toLowerCase().includes(q) ||
    m.content.toLowerCase().includes(q)
  )
})
watch(searchQuery, (q) => { if (q) selectedDoc.value = null })

// ---- Sidebar state ----
const SESSION_KEY = 'ops-selected'
const openFolder = ref('')
const sidebarTab = ref<'all' | 'fav'>('all')
const selectedDoc = ref<ManualDoc | null>(null)

// 收藏文档列表（从所有文档中过滤出已收藏的）
const favoriteDocs = computed(() => {
  return store.manuals.filter(m => store.isFavorited(m.id))
})

async function onToggleFavorite() {
  if (!selectedDoc.value) return
  try {
    await store.toggleFavorite(selectedDoc.value.id)
  } catch (e: any) {
    const { ElMessage } = await import('element-plus')
    ElMessage.error(e.message || '操作失败')
  }
}

// Restore state from sessionStorage
onMounted(async () => {
  // 先从后端加载数据
  await store.loadFolders()
  await store.loadDocs()
  await store.loadFavorites()
  loading.value = false

  // 恢复上次选中状态
  const saved = sessionStorage.getItem(SESSION_KEY)
  if (saved) {
    try {
      const { folderId, docId } = JSON.parse(saved)
      openFolder.value = folderId
      if (docId) {
        const doc = store.getDoc(docId)
        if (doc) selectedDoc.value = doc
      }
      return
    } catch {}
  }
  // Default: open first folder, select first doc
  if (store.folders.length) {
    openFolder.value = store.folders[0].id
    const docs = getDocs(store.folders[0].id)
    if (docs.length) selectedDoc.value = docs[0]
  }
})

// Persist selection + scroll position
watch([openFolder, selectedDoc], () => {
  const scrollTop = document.querySelector('.ops-doc-body')?.scrollTop || 0
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({
    folderId: openFolder.value,
    docId: selectedDoc.value?.id || null,
    scrollTop,
  }))
})

function toggleFolder(id: string) { openFolder.value = openFolder.value === id ? '' : id }
function getDocs(folderId: string) { return store.manuals.filter(m => m.folderId === folderId) }
function getFolderName(folderId: string) { return store.folders.find(f => f.id === folderId)?.name || folderId }

function selectDoc(doc: ManualDoc) {
  selectedDoc.value = doc
  openFolder.value = doc.folderId
  clearSearch() // clear search when selecting
}

// ---- Navigation ----
function newDoc() { router.push('/operations/edit') }
function newDocInFolder(folderId: string) { router.push(`/operations/edit?folderId=${folderId}`) }
function editDoc(id: number) { router.push(`/operations/edit/${id}`) }

// ---- Import ----
const showImportDialog = ref(false)
const importFileInput = ref<HTMLInputElement>()
const importForm = reactive({ title: '', folderId: '', content: '', fileName: '', loading: false })

function importDoc() {
  importForm.title = ''
  importForm.folderId = openFolder.value || store.folders[0]?.id || ''
  importForm.content = ''
  importForm.fileName = ''
  importForm.loading = false
  if (importFileInput.value) importFileInput.value.value = ''
  showImportDialog.value = true
  nextTick(() => importFileInput.value?.click())
}

async function onImportFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const ext = file.name.split('.').pop()?.toLowerCase()
  importForm.fileName = file.name
  importForm.title = importForm.title || file.name.replace(/\.\w+$/, '')
  importForm.content = ''
  importForm.loading = true

  try {
    if (ext === 'docx') {
      // Word 文档：用 mammoth 转为 HTML
      const mammoth = await import('mammoth')
      const arrayBuffer = await file.arrayBuffer()
      const result = await mammoth.convertToHtml({ arrayBuffer })
      importForm.content = result.value
      if (result.messages?.length) {
        console.warn('[import] Word 解析警告:', result.messages)
      }
    } else {
      // 其他格式：按文本读取
      const text = await file.text()
      if (ext === 'md' || ext === 'txt') {
        importForm.content = marked.parse(text) as string
      } else {
        importForm.content = text
      }
    }
  } catch (err: any) {
    console.error('[import] 文件解析失败:', err)
    importForm.content = ''
    // 通过 ElMessage 提示错误（动态导入避免循环依赖）
    const { ElMessage } = await import('element-plus')
    ElMessage.error(`文件解析失败: ${err.message || '未知错误'}`)
  } finally {
    importForm.loading = false
  }
}

async function doImport() {
  if (!importForm.title || !importForm.folderId || !importForm.content) return
  try {
    await store.addDoc({ title: importForm.title, content: importForm.content, folderId: importForm.folderId })
    showImportDialog.value = false
  } catch { /* error already shown by store */ }
}

// ---- Export ----
// HTML 转义：doc.title 拼进 document.write / HTML 模板前先转义，防 XSS
function escapeHtml(s: string): string {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]!))
}
// 文件名 sanitize：防路径穿越 + 非法字符（注意：不要 HTML 转义，否则文件名含实体）
function sanitizeFilename(s: string): string {
  return String(s ?? '').replace(/[<>:"/\\|?*]/g, '_').slice(0, 100) || 'document'
}
function handleExport(command: string) {
  if (!selectedDoc.value) return
  const doc = selectedDoc.value
  const safeTitle = escapeHtml(doc.title)
  if (command === 'print') {
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${safeTitle}</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:800px;margin:40px auto;padding:0 20px;line-height:1.8;color:#222}
h1,h2,h3{color:#1a1a1a;border-bottom:1px solid #eee;padding-bottom:8px}
code{background:#f4f4f4;padding:2px 6px;border-radius:3px;font-size:0.9em}
pre{background:#f4f4f4;padding:16px;border-radius:6px;overflow-x:auto}
blockquote{border-left:4px solid #58a6ff;margin:0;padding-left:16px;color:#555}
table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:8px}
img{max-width:100%}@media print{body{margin:0;padding:20px}}
</style></head><body><h1>${safeTitle}</h1>${renderedContent.value}</body></html>`)
    w.document.close()
    setTimeout(() => w.print(), 300)
    return
  }

  let content: string
  let filename: string
  let mime: string
  if (command === 'md') {
    content = htmlToMarkdown(doc.content)
    filename = sanitizeFilename(doc.title) + '.md'
    mime = 'text/markdown'
  } else if (command === 'docx') {
    // 导出为 Word 兼容格式（HTML 包装，Word 可直接打开）
    content = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>${safeTitle}</title>
<style>
body{font-family:"Microsoft YaHei","SimSun",sans-serif;margin:40px 60px;line-height:1.8;color:#222}
h1,h2,h3,h4{color:#1a1a1a;margin:24px 0 12px}
h1{font-size:24px;border-bottom:2px solid #333;padding-bottom:8px}
h2{font-size:20px}
h3{font-size:16px}
p{margin:8px 0}
code,pre{background:#f4f4f4;padding:2px 6px;border-radius:3px;font-family:"Consolas",monospace;font-size:0.9em}
pre{padding:16px;overflow-x:auto}
blockquote{border-left:4px solid #58a6ff;margin:12px 0;padding:8px 16px;color:#555;background:#f8f9fa}
table{border-collapse:collapse;width:100%;margin:12px 0}
td,th{border:1px solid #ddd;padding:8px 12px}
img{max-width:100%}
a{color:#58a6ff}
ul,ol{padding-left:24px}
li{margin:4px 0}
</style>
</head>
<body>
<h1>${safeTitle}</h1>
${renderedContent.value}
</body>
</html>`
    filename = sanitizeFilename(doc.title) + '.doc'
    mime = 'application/msword'
  } else {
    content = doc.content
    filename = sanitizeFilename(doc.title) + '.html'
    mime = 'text/html'
  }
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ---- Delete (doc or folder) ----
const showDeleteConfirm = ref(false)
const deleteTargetTitle = ref('')
function confirmDelete() {
  if (!selectedDoc.value) return
  deleteTargetTitle.value = selectedDoc.value.title
  contextMenu.value.folder = null // ensure we're deleting a doc now
  showDeleteConfirm.value = true
}

// ---- Add folder ----
const showAddFolder = ref(false)
const newFolder = ref({ name: '' })
async function createFolder() {
  if (!newFolder.value.name.trim()) return
  await store.addFolder(newFolder.value.name.trim())
  newFolder.value = { name: '' }
  showAddFolder.value = false
}

// ---- Context menu (right-click on folder) ----
const contextMenu = ref<{ visible: boolean; x: number; y: number; folder: ManualFolder | null }>({
  visible: false, x: 0, y: 0, folder: null,
})
function openContextMenu(e: MouseEvent, folder: ManualFolder) {
  contextMenu.value = { visible: true, x: e.clientX, y: e.clientY, folder }
}
function closeContextMenu() { contextMenu.value.visible = false }

// ---- Rename folder ----
const showRenameDialog = ref(false)
const renameForm = ref({ name: '' })
function renameFolderAction() {
  if (!contextMenu.value.folder) return
  renameForm.value.name = contextMenu.value.folder.name
  showRenameDialog.value = true
  closeContextMenu()
}
async function doRename() {
  if (!contextMenu.value.folder || !renameForm.value.name.trim()) return
  await store.renameFolder(contextMenu.value.folder.id, renameForm.value.name.trim())
  showRenameDialog.value = false
}

// ---- Delete folder ----
function deleteFolderAction() {
  if (!contextMenu.value.folder) return
  deleteTargetTitle.value = contextMenu.value.folder.name
  // hijack delete confirm for folder
  showDeleteConfirm.value = true
  closeContextMenu()
}

async function doDelete() {
  // If context menu was used, it's a folder delete
  if (contextMenu.value.folder) {
    const folder = contextMenu.value.folder
    const count = store.manuals.filter(m => m.folderId === folder.id).length
    if (count > 0) {
      try {
        await ElMessageBox.confirm(`文件夹「${folder.name}」中有 ${count} 篇手册，删除文件夹将同时删除所有手册。`, '确认删除', { type: 'warning' })
      } catch {
        showDeleteConfirm.value = false
        return
      }
    }
    await store.deleteFolder(folder.id)
    if (selectedDoc.value && !store.manuals.find(m => m.id === selectedDoc.value!.id)) {
      selectedDoc.value = null
    }
    showDeleteConfirm.value = false
    contextMenu.value.folder = null
    return
  }
  // Otherwise it's a document delete
  if (selectedDoc.value) {
    await store.deleteDoc(selectedDoc.value.id)
    selectedDoc.value = null
  }
  showDeleteConfirm.value = false
}

// ---- Rendered content (Markdown → HTML, XSS-safe) ----
const renderedContent = computed(() => {
  if (!selectedDoc.value) return ''
  const raw = selectedDoc.value.content
  // If content already looks like HTML (starts with <), use directly
  const html = raw.trim().startsWith('<') ? raw : (marked.parse(raw) as string)
  return sanitizeHtml(html)
})

// ---- Word count & reading time ----
const wordCount = computed(() => {
  if (!selectedDoc.value) return 0
  // Strip HTML tags for word count
  const text = selectedDoc.value.content.replace(/<[^>]*>/g, '')
  return text.replace(/[`\-\[\]()>#]/g, '').length
})
const readTime = computed(() => Math.max(1, Math.ceil(wordCount.value / 400)))

// ---- Table of contents ----
interface TocItem { id: string; text: string; level: number }
const tocItems = computed<TocItem[]>(() => {
  if (!selectedDoc.value) return []
  const html = selectedDoc.value.content
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const headings = doc.querySelectorAll('h1[id], h2[id], h3[id], h4[id]')
  const items: TocItem[] = []
  headings.forEach((h) => {
    items.push({
      id: h.id,
      text: h.textContent || '',
      level: parseInt(h.tagName[1]),
    })
  })
  return items
})

const activeHeading = ref('')
let scrollTimer: ReturnType<typeof setTimeout> | null = null

onMounted(() => {
  document.addEventListener('keydown', onGlobalKey)
})
onUnmounted(() => {
  document.removeEventListener('keydown', onGlobalKey)
  if (scrollTimer) clearTimeout(scrollTimer)
})

watch(selectedDoc, () => {
  activeHeading.value = ''
  nextTick(() => {
    const container = document.querySelector('.ops-doc-body')
    if (!container) return
    restoreScrollPosition(container)
    updateActiveHeading()
  })
})

/** 恢复滚动位置，等待图片加载后自动修正 */
function restoreScrollPosition(container: Element) {
  const saved = sessionStorage.getItem(SESSION_KEY)
  if (!saved) return
  let targetScroll = 0
  try {
    const { docId, scrollTop } = JSON.parse(saved)
    if (docId === selectedDoc.value?.id && scrollTop) {
      targetScroll = scrollTop
    }
  } catch { return }

  const setPos = () => { container.scrollTop = targetScroll }
  setPos()

  // 图片加载后内容高度可能变化，重新修正一次
  const imgs = container.querySelectorAll('img')
  if (imgs.length) {
    let loaded = 0
    imgs.forEach(img => {
      if (img.complete) { loaded++; return }
      img.addEventListener('load', () => { loaded++; if (loaded === imgs.length) setPos() }, { once: true })
      img.addEventListener('error', () => { loaded++; if (loaded === imgs.length) setPos() }, { once: true })
    })
  }
}

function onDocScroll() {
  if (scrollTimer) clearTimeout(scrollTimer)
  scrollTimer = setTimeout(updateActiveHeading, 80)
}

function updateActiveHeading() {
  const container = document.querySelector('.ops-doc-body')
  if (!container) return
  const containerTop = container.getBoundingClientRect().top
  const headings = container.querySelectorAll('.markdown-body h1[id], .markdown-body h2[id], .markdown-body h3[id]')
  let active = ''
  for (const h of headings) {
    const rect = (h as HTMLElement).getBoundingClientRect()
    if (rect.top <= containerTop + 80) {
      active = h.id
    }
  }
  if (active) activeHeading.value = active
}

function scrollToHeading(id: string) {
  let el = document.getElementById(id)
  if (!el) {
    const headings = document.querySelectorAll('.markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4')
    const item = tocItems.value.find(i => i.id === id)
    for (const h of headings) {
      if (h.textContent?.trim() === item?.text) { el = h as HTMLElement; break }
    }
  }
  if (!el) return
  const container = document.querySelector('.ops-doc-body')
  if (!container) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); return }
  const offsetTop = el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - 24
  container.scrollTo({ top: offsetTop, behavior: 'smooth' })
  activeHeading.value = id
}

// ---- Keyboard navigation ----
function onGlobalKey(e: KeyboardEvent) {
  const tag = (e.target as HTMLElement)?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
  // Ctrl+K → focus search
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault()
    searchInputRef.value?.focus()
    return
  }
  // Arrow keys → navigate sidebar docs
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    e.preventDefault()
    const allDocs = store.manuals
      .filter(m => openFolder.value === m.folderId || !openFolder.value)
      .sort((a, b) => b.updateTime.localeCompare(a.updateTime))
    const idx = allDocs.findIndex(d => d.id === selectedDoc.value?.id)
    const next = e.key === 'ArrowUp' ? idx - 1 : idx + 1
    if (next >= 0 && next < allDocs.length) selectDoc(allDocs[next])
  }
}

// Simple HTML → Markdown converter for export
function htmlToMarkdown(html: string): string {
  let md = html
  // Headings
  md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (_, c) => `\n# ${c.trim()}\n`)
  md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_, c) => `\n## ${c.trim()}\n`)
  md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_, c) => `\n### ${c.trim()}\n`)
  md = md.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, (_, c) => `\n#### ${c.trim()}\n`)
  md = md.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, (_, c) => `\n##### ${c.trim()}\n`)
  md = md.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, (_, c) => `\n###### ${c.trim()}\n`)
  // Code blocks
  md = md.replace(/<pre><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, (_, c) => {
    const code = c.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    return `\n\`\`\`\n${code}\n\`\`\`\n`
  })
  md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_, c) => {
    const code = c.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    return `\`${code}\``
  })
  // Bold / italic
  md = md.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, (_, c) => `**${c}**`)
  md = md.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, (_, c) => `**${c}**`)
  md = md.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, (_, c) => `*${c}*`)
  md = md.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, (_, c) => `*${c}*`)
  // Links
  md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, text) => `[${text}](${href})`)
  // Images
  md = md.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, (_, src, alt) => `![${alt}](${src})`)
  md = md.replace(/<img[^>]*src="([^"]*)"[^>]*\/?>/gi, (_, src) => `![](${src})`)
  // Blockquote
  md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, c) => {
    const inner = c.trim().split('\n').map((l: string) => `> ${l}`).join('\n')
    return `\n${inner}\n`
  })
  // Lists
  md = md.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_, c) => {
    const items = c.match(/<li[^>]*>([\s\S]*?)<\/li>/gi) || []
    return '\n' + items.map((i: string) => {
      const t = i.replace(/<li[^>]*>/, '').replace(/<\/li>/, '').trim()
      return `- ${t}`
    }).join('\n') + '\n'
  })
  md = md.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_, c) => {
    const items = c.match(/<li[^>]*>([\s\S]*?)<\/li>/gi) || []
    return '\n' + items.map((i: string, idx: number) => {
      const t = i.replace(/<li[^>]*>/, '').replace(/<\/li>/, '').trim()
      return `${idx + 1}. ${t}`
    }).join('\n') + '\n'
  })
  // Line breaks and paragraphs
  md = md.replace(/<br\s*\/?>/gi, '\n')
  md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, c) => `\n${c.trim()}\n`)
  // Tables
  md = md.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (_, tableHtml) => {
    const rows: string[][] = []
    const trs = tableHtml.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || []
    for (const tr of trs) {
      const cells = tr.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) || []
      const row = cells.map((c: string) => c.replace(/<[^>]+>/g, '').trim())
      rows.push(row)
    }
    if (rows.length === 0) return ''
    const header = rows[0]
    const body = rows.slice(1)
    let result = '| ' + header.join(' | ') + ' |\n'
    result += '| ' + header.map(() => '---').join(' | ') + ' |\n'
    for (const row of body) {
      result += '| ' + row.join(' | ') + ' |\n'
    }
    return '\n' + result
  })
  // Horizontal rule
  md = md.replace(/<hr\s*\/?>/gi, '\n---\n')
  // Remove remaining HTML tags
  md = md.replace(/<[^>]+>/g, '')
  // Decode common entities
  md = md.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  // Clean up excess blank lines
  md = md.replace(/\n{3,}/g, '\n\n').trim()
  return md
}
</script>

<style scoped>
/* ===== Layout ===== */
.ops-page {
  display: flex;
  height: 100vh;
  background: var(--ops-bg-page);
  overflow: hidden;
}

/* ===== Sidebar ===== */
.ops-sidebar {
  width: 290px;
  min-width: 290px;
  background: var(--ops-bg-card);
  border-right: 1px solid var(--ops-border-card);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.sb-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 16px; height: 50px;
  background: linear-gradient(135deg, rgba(88,166,255,0.06), transparent);
  border-bottom: 1px solid var(--ops-border-card);
  flex-shrink: 0;
}
.sb-title { font-size: 14px; font-weight: 700; color: var(--ops-text-primary); }
.sb-header-actions { display: flex; gap: 4px; }
.sb-add-btn {
  width: 32px; height: 32px; border-radius: 8px;
  background: transparent; color: var(--ops-text-tertiary);
  border: 1px solid transparent; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.2s ease;
}
.sb-add-btn:hover { color: var(--ops-accent-blue); background: rgba(88,166,255,0.08); border-color: rgba(88,166,255,0.2); }

/* Search */
.sb-search { padding: 8px 12px; border-bottom: 1px solid var(--ops-border-card); flex-shrink: 0; display: flex; align-items: center; gap: 0; position: relative; }
.sb-search-input {
  width: 100%; box-sizing: border-box;
  background: var(--ops-bg-card-hover);
  border: 1px solid var(--ops-border-card);
  color: var(--ops-text-secondary);
  padding: 8px 28px 8px 10px;
  font-size: 13px; outline: none; font-family: inherit;
  border-radius: 8px;
}
.sb-search-input::placeholder { color: var(--ops-text-tertiary); }
.sb-search-input:focus { border-color: var(--ops-accent-blue); background: var(--ops-bg-card); }
.sb-search-clear {
  position: absolute; right: 16px;
  background: none; border: none;
  color: var(--ops-text-tertiary); cursor: pointer;
  font-size: 14px; padding: 0; line-height: 1;
}
.sb-search-clear:hover { color: var(--ops-text-secondary); }

/* Sidebar tabs (All / Favorites) */
.sb-tabs {
  display: flex;
  padding: 6px 12px;
  gap: 4px;
  border-bottom: 1px solid var(--ops-border-card);
  flex-shrink: 0;
}
.sb-tab {
  flex: 1;
  text-align: center;
  padding: 6px 8px;
  font-size: 12px;
  color: var(--ops-text-tertiary);
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.15s;
  user-select: none;
}
.sb-tab:hover {
  background: var(--ops-bg-card-hover);
  color: var(--ops-text-secondary);
}
.sb-tab.active {
  background: rgba(88,166,255,0.1);
  color: var(--ops-accent-blue);
  font-weight: 600;
}

/* Folder list container */
.sb-list { flex: 1; overflow-y: auto; padding: 4px 0; }

/* Folder */
.sb-folder {
  margin: 0 8px 2px;
  border-radius: 8px;
  overflow: hidden;
}
.sb-folder + .sb-folder { margin-top: 2px; }
.sb-folder.open { background: rgba(88,166,255,0.03); }
.sb-folder-row {
  display: flex; align-items: center; gap: 6px;
  padding: 10px 12px; cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}
.sb-folder-row:hover { background: var(--ops-bg-card-hover); }
.sb-folder.open > .sb-folder-row { background: rgba(88,166,255,0.04); }
.sb-arrow { font-size: 14px; color: var(--ops-text-tertiary); width: 14px; flex-shrink: 0; transition: transform 0.2s ease; text-align: center; line-height: 1; }
.sb-folder.open > .sb-folder-row .sb-arrow { color: var(--ops-accent-blue); }
.sb-folder-icon {
  display: flex; align-items: center; color: var(--ops-accent-blue); opacity: 0.7; flex-shrink: 0;
}
.sb-folder.open > .sb-folder-row .sb-folder-icon { opacity: 1; }
.sb-folder-name { font-size: 13px; color: var(--ops-text-primary); font-weight: 600; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sb-count {
  font-size: 10px; color: var(--ops-text-tertiary);
  background: var(--ops-bg-card-hover); padding: 2px 7px; border-radius: 8px;
  flex-shrink: 0; font-weight: 600;
}

.sb-folder-add-doc {
  width: 24px; height: 24px; border-radius: 5px;
  background: transparent; color: var(--ops-text-tertiary);
  border: 1px solid transparent; cursor: pointer;
  font-size: 15px; display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; transition: all 0.2s ease;
  opacity: 0;
}
.sb-folder-row:hover .sb-folder-add-doc { opacity: 1; }
.sb-folder-add-doc:hover { color: var(--ops-accent-blue); background: rgba(88,166,255,0.1); border-color: rgba(88,166,255,0.2); transform: scale(1.1); }

/* Documents — with indentation guide line */
.sb-docs { padding: 0; position: relative; }
.sb-docs::before {
  content: ''; position: absolute; left: 20px; top: 4px; bottom: 4px;
  width: 1px; background: var(--ops-border-card); opacity: 0.5;
}
.sb-doc {
  display: flex; align-items: center; gap: 6px;
  padding: 7px 12px 7px 32px; cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}
.sb-doc:hover { background: var(--ops-bg-card-hover); }
.sb-doc.active {
  background: rgba(88,166,255,0.1);
  border-right: 2px solid var(--ops-accent-blue);
  box-shadow: inset 2px 0 0 var(--ops-accent-blue);
}
.sb-doc-icon { font-size: 12px; flex-shrink: 0; opacity: 0.7; }
.sb-doc.active .sb-doc-icon { opacity: 1; }
.sb-doc-title {
  font-size: 12px; color: var(--ops-text-secondary);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.sb-doc.active .sb-doc-title { color: var(--ops-accent-blue); }

/* Focus visible for keyboard nav */
.sb-folder-row:focus-visible,
.sb-doc:focus-visible {
  outline: 2px solid var(--ops-accent-blue);
  outline-offset: -2px;
  border-radius: 4px;
  background: var(--ops-bg-card-hover);
}

/* Search result items */
.sb-doc-flat { padding: 8px 12px !important; }
.sb-doc-info { display: flex; flex-direction: column; gap: 1px; flex: 1; min-width: 0; }
.sb-doc-meta { font-size: 10px; color: var(--ops-text-tertiary); }
.sb-empty { padding: 16px 32px; font-size: 11px; color: var(--ops-text-tertiary); text-align: center; }

/* ===== Main ===== */
.ops-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.ops-empty {
  flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 12px; color: var(--ops-text-tertiary);
}
.ops-empty-icon { font-size: 56px; opacity: 0.3; }
.ops-empty p { margin: 0; font-size: 15px; }
.ops-empty-sub { font-size: 12px !important; opacity: 0.6; }
.ops-empty-btn {
  margin-top: 8px; padding: 8px 20px; border-radius: 8px;
  background: rgba(88,166,255,0.12); color: var(--ops-accent-blue);
  border: 1px solid rgba(88,166,255,0.25); cursor: pointer;
  font-size: 13px; font-weight: 600; font-family: inherit;
  transition: all 0.15s;
}
.ops-empty-btn:hover { background: rgba(88,166,255,0.22); }

.ops-doc-header {
  display: flex; align-items: center; gap: 16px;
  padding: 0 28px; height: 50px;
  background: var(--ops-bg-card);
  border-bottom: 1px solid var(--ops-border-card);
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  flex-shrink: 0;
}
.doc-title { font-size: 15px; font-weight: 700; color: var(--ops-text-primary); flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin: 0; }
.doc-actions { display: flex; gap: 8px; flex-shrink: 0; }
.act-btn {
  background: var(--ops-bg-card-hover); border: 1px solid var(--ops-border-card);
  color: var(--ops-text-secondary); cursor: pointer;
  font-size: 12px; padding: 5px 12px; border-radius: 6px; font-family: inherit;
  transition: all 0.2s ease; white-space: nowrap; font-weight: 500;
}
.act-btn:hover { border-color: var(--ops-accent-blue); color: var(--ops-accent-blue); background: rgba(88,166,255,0.06); }
.act-btn-danger:hover { border-color: var(--ops-accent-red); color: var(--ops-accent-red); background: rgba(220,50,50,0.06); }

/* Sub-header meta bar */
.ops-doc-subhead {
  display: flex; align-items: center; gap: 10px;
  padding: 5px 28px; font-size: 11px; color: var(--ops-text-tertiary);
  border-bottom: 1px solid var(--ops-border-card);
  flex-shrink: 0; flex-wrap: wrap;
}
.ops-doc-subhead .doc-folder-tag {
  font-size: 10px; padding: 2px 8px; border-radius: 10px;
  background: rgba(88,166,255,0.08); color: var(--ops-accent-blue);
  font-weight: 600;
}
.ops-doc-subhead .doc-stats { color: var(--ops-text-tertiary); }

/* Document content area (body + TOC) */
.ops-doc-content {
  flex: 1; display: flex; overflow: hidden;
}
.ops-doc-body {
  flex: 1; overflow-y: auto; padding: 32px 48px;
  scroll-behavior: smooth;
}

/* TOC */
.ops-toc {
  width: 200px; min-width: 170px;
  overflow-y: auto; padding: 24px 12px 24px 4px;
  border-left: 1px solid var(--ops-border-card);
  flex-shrink: 0;
  position: sticky; top: 0;
  align-self: flex-start;
  max-height: 100vh;
}
.ops-toc .toc-title {
  font-size: 11px; font-weight: 700; color: var(--ops-text-tertiary);
  text-transform: uppercase; letter-spacing: 0.5px;
  margin-bottom: 12px;
}
.ops-toc .toc-link {
  display: block; padding: 4px 8px; margin-bottom: 2px;
  font-size: 12px; color: var(--ops-text-secondary);
  text-decoration: none; border-radius: 4px;
  border-left: 2px solid transparent;
  transition: all 0.15s;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.ops-toc .toc-link:hover {
  color: var(--ops-accent-blue); background: var(--ops-bg-card-hover);
}
.ops-toc .toc-link.active {
  color: var(--ops-accent-blue); font-weight: 600;
  background: rgba(88,166,255,0.14);
  border-left-color: var(--ops-accent-blue);
  font-size: 13px;
  padding-top: 6px; padding-bottom: 6px;
  box-shadow: inset 4px 0 8px rgba(88,166,255,0.08);
}

/* ===== Context Menu ===== */
.ctx-overlay { position: fixed; inset: 0; z-index: 999; }
.ctx-menu {
  position: fixed; z-index: 1000;
  background: var(--ops-bg-card);
  border: 1px solid var(--ops-border-card);
  border-radius: 8px;
  padding: 4px; min-width: 150px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.4);
}
.ctx-item {
  padding: 6px 12px; font-size: 12px; color: var(--ops-text-secondary);
  border-radius: 4px; cursor: pointer; transition: background 0.1s;
}
.ctx-item:hover { background: var(--ops-bg-card-hover); }
.ctx-item-danger { color: var(--ops-accent-red); }
.ctx-item-danger:hover { background: rgba(220,50,50,0.12); }

/* ===== Rendered HTML content ===== */
.markdown-body {
  color: var(--ops-text-primary);
  font-size: 14px;
  line-height: 1.8;
}
.markdown-body :deep(h1) { font-size: 24px; margin: 0 0 16px 0; padding-bottom: 8px; border-bottom: 1px solid var(--ops-border-card); }
.markdown-body :deep(h2) { font-size: 18px; margin: 28px 0 12px 0; }
.markdown-body :deep(h3) { font-size: 15px; margin: 20px 0 8px 0; }
.markdown-body :deep(h4) { font-size: 14px; margin: 16px 0 6px 0; }
.markdown-body :deep(p) { margin: 8px 0; }
.markdown-body :deep(strong) { color: var(--ops-accent-blue); }
.markdown-body :deep(a) { color: var(--ops-accent-blue); text-decoration: none; }
.markdown-body :deep(a:hover) { text-decoration: underline; }
.markdown-body :deep(code) {
  background: var(--ops-bg-card-hover);
  padding: 2px 6px; border-radius: 4px;
  font-family: 'SF Mono', 'Consolas', monospace;
  font-size: 13px; color: var(--ops-accent-yellow);
}
.markdown-body :deep(pre) {
  background: var(--ops-bg-code); border: 1px solid var(--ops-border-code);
  border-radius: 8px; padding: 16px; overflow-x: auto; margin: 12px 0;
}
.markdown-body :deep(pre code) {
  background: none; padding: 0; color: var(--ops-text-code); font-size: 13px;
}
.markdown-body :deep(table) { border-collapse: collapse; width: 100%; margin: 12px 0; }
.markdown-body :deep(th) {
  background: var(--ops-bg-card-hover); color: var(--ops-text-primary);
  font-weight: 600; font-size: 12px; padding: 10px 14px; text-align: left;
  border: 1px solid var(--ops-border-card);
}
.markdown-body :deep(td) {
  padding: 9px 14px; font-size: 13px;
  border: 1px solid var(--ops-border-card); color: var(--ops-text-secondary);
}
.markdown-body :deep(tr:nth-child(even) td) {
  background: var(--ops-bg-card-hover);
}
.markdown-body :deep(blockquote) {
  border-left: 3px solid var(--ops-accent-yellow);
  margin: 12px 0; padding: 10px 18px;
  background: rgba(210,153,34,0.06); color: var(--ops-text-secondary);
  border-radius: 0 6px 6px 0;
}
.markdown-body :deep(ul), .markdown-body :deep(ol) { padding-left: 24px; margin: 8px 0; }
.markdown-body :deep(li) { margin: 4px 0; }
.markdown-body :deep(hr) { border: none; border-top: 1px solid var(--ops-border-card); margin: 24px 0; }
.markdown-body :deep(img) { max-width: 100%; border-radius: 8px; margin: 8px 0; }

/* ===== Dialogs ===== */
.mo-overlay {
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(0,0,0,0.45);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
  animation: fadeIn 0.15s ease;
}
.mo-dialog {
  background: var(--ops-bg-card); border: 1px solid var(--ops-border-card);
  border-radius: 12px; padding: 24px; width: 400px;
  box-shadow: 0 24px 80px rgba(0,0,0,0.5);
  animation: slideUp 0.2s ease;
}
@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
@keyframes slideUp { from { opacity: 0; transform: translateY(12px) scale(0.98) } to { opacity: 1; transform: translateY(0) scale(1) } }
.mo-dlg-header { font-size: 16px; font-weight: 600; color: var(--ops-text-primary); margin-bottom: 16px; }
.mo-body { display: flex; flex-direction: column; gap: 12px; }
.mo-field { display: flex; flex-direction: column; gap: 4px; }
.mo-field span { font-size: 12px; color: var(--ops-text-tertiary); }
.mo-input { background: var(--ops-bg-card-hover); border: 1px solid var(--ops-border-card); color: var(--ops-text-primary); border-radius: 6px; padding: 6px 10px; font-size: 13px; outline: none; font-family: inherit; }
.mo-input:focus { border-color: var(--ops-accent-blue); }
.mo-footer { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
.mo-btn-cancel { background: var(--ops-bg-card-hover); color: var(--ops-text-secondary); border: 1px solid var(--ops-border-card); padding: 6px 16px; border-radius: 6px; font-size: 13px; cursor: pointer; font-family: inherit; }
.mo-btn-confirm { background: rgba(88,166,255,0.15); color: var(--ops-accent-blue); border: 1px solid rgba(88,166,255,0.3); padding: 6px 16px; border-radius: 6px; font-size: 13px; cursor: pointer; font-weight: 600; font-family: inherit; }
.mo-btn-danger { background: rgba(220,50,50,0.15); color: var(--ops-accent-red); border: 1px solid rgba(220,50,50,0.3); padding: 6px 16px; border-radius: 6px; font-size: 13px; cursor: pointer; font-weight: 600; font-family: inherit; }
.import-tip { font-size: 11px; color: var(--ops-text-tertiary); margin-top: 4px; line-height: 1.4; }
@media print { .ops-sidebar, .ops-doc-header, .ops-toc { display: none !important; } .ops-main { padding: 0; } }
</style>
