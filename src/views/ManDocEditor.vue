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

    <!-- Quill Editor -->
    <div class="ed-body">
      <QuillEditor
        v-model:content="form.content"
        contentType="html"
        theme="snow"
        :toolbar="toolbarOptions"
        style="height: 100%"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { QuillEditor } from '@vueup/vue-quill'
import '@vueup/vue-quill/dist/vue-quill.snow.css'
import { useOperationsStore } from '../stores/operations'

const route = useRoute()
const router = useRouter()
const store = useOperationsStore()

const isEdit = computed(() => !!route.params.id)
const saveError = ref('')

const form = reactive({
  title: '',
  content: '',
  folderId: '',
})

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

async function save() {
  saveError.value = ''
  if (!form.title.trim()) { saveError.value = '请输入标题'; return }
  if (!form.folderId) { saveError.value = '请选择文件夹'; return }
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
    router.push('/operations')
  } catch (e: any) {
    saveError.value = e.message || '保存失败'
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
</style>
