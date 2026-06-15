// src/api/phones.ts

const BASE = '/api/v1/phones'

export interface PhoneDevice {
  id: string
  cfgId: string
  extension: string
  ip: string
  lastIp?: string
  address: string
  status: string
  delay: string
  registered: string
  online: boolean
  secret: string
  display_name: string
}

export interface PhonesResponse {
  code: number
  data: PhoneDevice[]
  total: number
  online: number
  offline: number
  cached: boolean
  message?: string
}

// 获取所有话机（优先走缓存）
export async function fetchPhones(): Promise<PhonesResponse> {
  const res = await fetch(BASE, {
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: 获取话机列表失败`)
  const json: PhonesResponse = await res.json()
  if (json.code >= 400) throw new Error(json.message || `错误码 ${json.code}`)
  return json
}

// 强制刷新（清除后端缓存，重新从 IPPBX 拉取）
export async function refreshPhones(): Promise<PhonesResponse> {
  const res = await fetch(`${BASE}/refresh`, {
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: 刷新话机列表失败`)
  const json: PhonesResponse = await res.json()
  if (json.code >= 400) throw new Error(json.message || `错误码 ${json.code}`)
  return json
}
