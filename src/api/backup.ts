import { request } from '../utils/http'

const BASE = '/api/v1/backup'

export interface BackupFile {
  filename: string
  size: number
  size_kb: number
  created_at: string
}

// 备份文件列表
export function fetchBackupList() {
  return request<BackupFile[]>(`${BASE}/list`)
}

// 手动触发备份
export function triggerBackup() {
  return request<{ message: string }>(BASE, { method: 'POST' })
}

// 下载备份文件（走 window.open 触发浏览器下载）
export function downloadBackup(filename: string) {
  window.open(`${BASE}/${encodeURIComponent(filename)}/download`, '_blank')
}
