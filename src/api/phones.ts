// src/api/phones.ts
import { request } from '../utils/http'

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
  remark?: string
}

// 获取所有话机（优先走缓存）
export async function fetchPhones(force = false) {
  const url = force ? `${BASE}/refresh` : BASE
  const res = await request<any>(url)
  // 后端返回 { code, data: [...], total, online, offline }
  // 统一转为 { devices, total, online, offline } 供前端使用
  const list: PhoneDevice[] = Array.isArray(res) ? res : (res.devices || [])
  return {
    devices: list,
    total: list.length,
    online: list.filter(d => d.online).length,
    offline: list.filter(d => !d.online).length,
  }
}

/** 获取话机详情 */
export async function fetchPhoneDetail(id: string) {
  return request<any>(`${BASE}/${id}/details`)
}

/** 编辑话机账号配置 */
export async function updatePhoneAccount(id: string, data: any) {
  return request<any>(`${BASE}/${id}/account`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

/** 重启话机 */
export async function rebootPhone(id: string) {
  return request<any>(`${BASE}/${id}/reboot`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

/** 修改话机备注 */
export async function updatePhoneRemark(id: string, remark: string) {
  return request<any>(`${BASE}/${id}/remark`, {
    method: 'PUT',
    body: JSON.stringify({ remark }),
  })
}

/** 获取话机远程电话本配置 */
export async function fetchRemotePhonebook(id: string) {
  return request<any>(`${BASE}/${id}/remote-phonebook`)
}

/** 更新话机远程电话本配置 */
export async function updateRemotePhonebook(id: string, data: { xmlUrl: string; name: string }) {
  return request<any>(`${BASE}/${id}/remote-phonebook`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}