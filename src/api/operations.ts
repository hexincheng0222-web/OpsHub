import type { ManualFolder, ManualDoc } from '../types'
import { request } from '../utils/http'

const BASE = '/api/v1/operations'

// ---- 文件夹 ----

export async function fetchFolders(): Promise<ManualFolder[]> {
  const data = await request<any[]>(`${BASE}/folders`)
  return data.map(r => ({ id: r.id, name: r.name, icon: r.icon || '' }))
}

export async function createFolder(name: string): Promise<ManualFolder> {
  return request<ManualFolder>(`${BASE}/folders`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
}

export async function updateFolder(id: string, name: string): Promise<ManualFolder> {
  return request<ManualFolder>(`${BASE}/folders/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ name }),
  })
}

export async function deleteFolder(id: string): Promise<void> {
  await request(`${BASE}/folders/${id}`, { method: 'DELETE' })
}

// ---- 文档 ----

export async function fetchDocs(params: {
  folderId?: string
  keyword?: string
  page?: number
  pageSize?: number
} = {}): Promise<{ list: ManualDoc[]; total: number }> {
  const qs = new URLSearchParams()
  if (params.folderId) qs.set('folderId', params.folderId)
  if (params.keyword) qs.set('keyword', params.keyword)
  if (params.page) qs.set('page', String(params.page))
  if (params.pageSize) qs.set('pageSize', String(params.pageSize))
  const data = await request<any>(`${BASE}/docs?${qs}`)
  return {
    list: data.list.map((r: any) => ({
      id: r.id, title: r.title, content: r.content,
      folderId: r.folderId, author: r.author || '',
      createTime: r.createTime, updateTime: r.updateTime,
    })),
    total: data.total,
  }
}

export async function fetchDoc(id: number): Promise<ManualDoc> {
  const r = await request<any>(`${BASE}/docs/${id}`)
  return {
    id: r.id, title: r.title, content: r.content,
    folderId: r.folderId, author: r.author || '',
    createTime: r.createTime, updateTime: r.updateTime,
  }
}

export async function createDoc(data: {
  title: string; content: string; folderId: string
}): Promise<ManualDoc> {
  const r = await request<any>(`${BASE}/docs`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
  return {
    id: r.id, title: r.title, content: r.content,
    folderId: r.folderId, author: r.author || '',
    createTime: r.createTime, updateTime: r.updateTime,
  }
}

export async function updateDoc(id: number, data: {
  title?: string; content?: string; folderId?: string
}): Promise<ManualDoc> {
  const r = await request<any>(`${BASE}/docs/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
  return {
    id: r.id, title: r.title, content: r.content,
    folderId: r.folderId, author: r.author || '',
    createTime: r.createTime, updateTime: r.updateTime,
  }
}

export async function deleteDoc(id: number): Promise<void> {
  await request(`${BASE}/docs/${id}`, { method: 'DELETE' })
}

// ---- 版本历史 ----

export interface DocVersion {
  id: number
  docId: number
  title: string
  versionNumber: number
  author: string
  createdAt: string
}

export async function fetchVersions(docId: number): Promise<DocVersion[]> {
  const data = await request<any[]>(`${BASE}/docs/${docId}/versions`)
  return data.map(v => ({
    id: v.id, docId: v.docId, title: v.title,
    versionNumber: v.versionNumber, author: v.author,
    createdAt: v.createdAt,
  }))
}

export async function rollbackVersion(docId: number, versionId: number): Promise<ManualDoc> {
  const r = await request<any>(`${BASE}/docs/${docId}/versions/${versionId}/rollback`, { method: 'POST' })
  return {
    id: r.id, title: r.title, content: r.content,
    folderId: r.folderId, author: r.author || '',
    createTime: r.createTime, updateTime: r.updateTime,
  }
}

// ---- 收藏 ----

export async function fetchFavorites(): Promise<ManualDoc[]> {
  const data = await request<any[]>(`${BASE}/favorites`)
  return data.map((r: any) => ({
    id: r.id, title: r.title, content: r.content,
    folderId: r.folderId, author: r.author || '',
    createTime: r.createTime, updateTime: r.updateTime,
  }))
}

export async function addFavorite(docId: number): Promise<void> {
  await request(`${BASE}/docs/${docId}/favorite`, { method: 'POST' })
}

export async function removeFavorite(docId: number): Promise<void> {
  await request(`${BASE}/docs/${docId}/favorite`, { method: 'DELETE' })
}
