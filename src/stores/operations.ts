/**
 * 操作手册 Store — 文件夹 + 文档，支持 localStorage 缓存
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ManualFolder, ManualDoc } from '../types'
import * as opsApi from '../api/operations'
import { ElMessage } from 'element-plus'

const OPS_CACHE_KEY = 'opshub_ops_cache'
const OPS_TTL = 10 * 60 * 1000 // 10 分钟

function readOpsCache(): { folders: ManualFolder[]; manuals: ManualDoc[]; ts: number } | null {
  try {
    const raw = localStorage.getItem(OPS_CACHE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch { return null }
}
function writeOpsCache(folders: ManualFolder[], manuals: ManualDoc[]) {
  try { localStorage.setItem(OPS_CACHE_KEY, JSON.stringify({ folders, manuals, ts: Date.now() })) } catch {}
}

export const useOperationsStore = defineStore('operations', () => {
  const folders = ref<ManualFolder[]>([])
  const manuals = ref<ManualDoc[]>([])
  const loading = ref(false)

  const folderCount = computed(() => folders.value.length)
  const docCount = computed(() => manuals.value.length)

  // HomeView 兼容别名
  const total = docCount
  const activeCount = folderCount

  function getDoc(id: number) {
    return manuals.value.find(m => m.id === id) || null
  }

  async function loadAll() {
    // 先读缓存立即显示
    const cached = readOpsCache()
    if (cached) {
      folders.value = cached.folders
      manuals.value = cached.manuals
      if (Date.now() - cached.ts < OPS_TTL) return // 未过期
    }

    loading.value = true
    try {
      const [fRes, dRes] = await Promise.all([
        opsApi.fetchFolders(),
        opsApi.fetchDocs({ pageSize: 9999 }),
      ])
      folders.value = fRes
      manuals.value = dRes.list
      writeOpsCache(fRes, dRes.list)
    } catch (e: any) {
      if (!cached) ElMessage.error(e.message || '加载操作手册失败')
      else console.warn('手册数据静默刷新失败:', e.message)
    } finally {
      loading.value = false
    }
  }

  async function loadFolders() {
    try {
      folders.value = await opsApi.fetchFolders()
    } catch (e: any) {
      ElMessage.error(e.message || '加载文件夹失败')
      throw e
    }
  }

  async function loadDocs() {
    try {
      const res = await opsApi.fetchDocs({ pageSize: 9999 })
      manuals.value = res.list
    } catch (e: any) {
      ElMessage.error(e.message || '加载文档失败')
      throw e
    }
  }

  // ---------- 文件夹 CRUD ----------
  async function addFolder(name: string) {
    try {
      const created = await opsApi.createFolder(name)
      folders.value.push(created)
      writeOpsCache(folders.value, manuals.value)
    } catch (e: any) {
      ElMessage.error(e.message || '创建文件夹失败')
      throw e
    }
  }

  async function renameFolder(id: string, name: string) {
    try {
      const updated = await opsApi.updateFolder(id, name)
      const idx = folders.value.findIndex(f => f.id === id)
      if (idx !== -1) folders.value[idx] = updated
      writeOpsCache(folders.value, manuals.value)
    } catch (e: any) {
      ElMessage.error(e.message || '重命名文件夹失败')
      throw e
    }
  }

  async function deleteFolder(id: string) {
    try {
      await opsApi.deleteFolder(id)
      folders.value = folders.value.filter(f => f.id !== id)
      manuals.value = manuals.value.filter(m => m.folderId !== id)
      writeOpsCache(folders.value, manuals.value)
    } catch (e: any) {
      ElMessage.error(e.message || '删除文件夹失败')
      throw e
    }
  }

  // ---------- 文档 CRUD ----------
  async function addDoc(data: { title: string; content: string; folderId: string }) {
    try {
      const created = await opsApi.createDoc(data)
      manuals.value.push(created)
      writeOpsCache(folders.value, manuals.value)
      return created
    } catch (e: any) {
      ElMessage.error(e.message || '创建文档失败')
      throw e
    }
  }

  async function updateDoc(id: number, data: { title?: string; content?: string; folderId?: string }) {
    try {
      const updated = await opsApi.updateDoc(id, data)
      const idx = manuals.value.findIndex(m => m.id === id)
      if (idx !== -1) manuals.value[idx] = updated
      writeOpsCache(folders.value, manuals.value)
      return updated
    } catch (e: any) {
      ElMessage.error(e.message || '更新文档失败')
      throw e
    }
  }

  async function deleteDoc(id: number) {
    try {
      await opsApi.deleteDoc(id)
      manuals.value = manuals.value.filter(m => m.id !== id)
      writeOpsCache(folders.value, manuals.value)
    } catch (e: any) {
      ElMessage.error(e.message || '删除文档失败')
      throw e
    }
  }

  // ---------- 收藏 ----------
  const favoriteDocIds = ref<Set<number>>(new Set())

  function isFavorited(docId: number) {
    return favoriteDocIds.value.has(docId)
  }

  async function loadFavorites() {
    try {
      const favs = await opsApi.fetchFavorites()
      favoriteDocIds.value = new Set(favs.map(f => f.id))
    } catch {
      favoriteDocIds.value = new Set()
    }
  }

  async function toggleFavorite(docId: number) {
    if (favoriteDocIds.value.has(docId)) {
      await opsApi.removeFavorite(docId)
      favoriteDocIds.value.delete(docId)
    } else {
      await opsApi.addFavorite(docId)
      favoriteDocIds.value.add(docId)
    }
    // 触发响应性更新
    favoriteDocIds.value = new Set(favoriteDocIds.value)
  }

  return {
    folders, manuals, loading,
    folderCount, docCount, total, activeCount,
    favoriteDocIds, isFavorited,
    getDoc, loadAll, loadFolders, loadDocs,
    addFolder, renameFolder, deleteFolder,
    addDoc, updateDoc, deleteDoc,
    loadFavorites, toggleFavorite,
  }
})
