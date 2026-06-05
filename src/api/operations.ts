import type { ManualFolder, ManualDoc } from '../mock/operations'

const BASE = '/api/v1/operations'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const json = await res.json()
  if (json.code >= 400) throw new Error(json.message || `HTTP ${json.code}`)
  return json.data
}

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
