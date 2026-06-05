import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ManualDoc, ManualFolder } from '../mock/operations'
import * as api from '../api/operations'

export const useOperationsStore = defineStore('operations', () => {
  const folders = ref<ManualFolder[]>([])
  const manuals = ref<ManualDoc[]>([])
  const loading = ref(false)

  // ---- 加载 ----
  async function loadFolders() {
    try {
      folders.value = await api.fetchFolders()
    } catch (e) {
      console.error('[operations] 加载文件夹失败:', e)
    }
  }

  async function loadDocs(folderId?: string) {
    loading.value = true
    try {
      const { list } = await api.fetchDocs({ folderId, pageSize: 100 })
      manuals.value = list
    } catch (e) {
      console.error('[operations] 加载文档失败:', e)
    } finally {
      loading.value = false
    }
  }

  // ---- 文件夹 ----
  async function addFolder(name: string) {
    const folder = await api.createFolder(name)
    folders.value.push(folder)
    return folder
  }

  async function deleteFolder(id: string) {
    await api.deleteFolder(id)
    folders.value = folders.value.filter(f => f.id !== id)
    manuals.value = manuals.value.filter(m => m.folderId !== id)
  }

  async function renameFolder(id: string, name: string) {
    await api.updateFolder(id, name)
    const f = folders.value.find(f => f.id === id)
    if (f) f.name = name
  }

  // ---- 文档 ----
  const getByFolder = (folderId: string) => computed(() =>
    manuals.value.filter(m => m.folderId === folderId).sort((a, b) => b.updateTime.localeCompare(a.updateTime))
  )

  function getDoc(id: number) { return manuals.value.find(m => m.id === id) }

  async function addDoc(doc: { title: string; content: string; folderId: string }) {
    const created = await api.createDoc(doc)
    manuals.value.unshift(created)
    return created
  }

  async function updateDoc(id: number, data: Partial<ManualDoc>) {
    const updated = await api.updateDoc(id, {
      title: data.title,
      content: data.content,
      folderId: data.folderId,
    })
    const idx = manuals.value.findIndex(m => m.id === id)
    if (idx !== -1) manuals.value[idx] = updated
  }

  async function deleteDoc(id: number) {
    await api.deleteDoc(id)
    manuals.value = manuals.value.filter(m => m.id !== id)
  }

  // ---- stats (for HomeView) ----
  const total = computed(() => manuals.value.length)
  const activeCount = computed(() => folders.value.length)

  return {
    folders, manuals, loading, total, activeCount,
    loadFolders, loadDocs,
    addFolder, deleteFolder, renameFolder,
    getByFolder, getDoc, addDoc, updateDoc, deleteDoc,
  }
})
