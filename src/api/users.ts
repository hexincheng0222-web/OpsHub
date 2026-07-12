import { request } from '../utils/http'
import type { UserInfo } from './auth'

export interface CreateUserParams {
  username: string
  password: string
  display_name: string
  role: 'superadmin' | 'admin' | 'user'
}

export interface UpdateUserParams {
  display_name?: string
  role?: 'superadmin' | 'admin' | 'user'
  is_active?: boolean
}

export interface FetchUsersParams {
  page?: number
  pageSize?: number
  keyword?: string
  role?: string
}

export interface FetchUsersResult {
  rows: UserInfo[]
  total: number
}

export function fetchUsers(params: FetchUsersParams = {}): Promise<FetchUsersResult> {
  const qs = new URLSearchParams()
  if (params.page) qs.set('page', String(params.page))
  if (params.pageSize) qs.set('pageSize', String(params.pageSize))
  if (params.keyword) qs.set('keyword', params.keyword)
  if (params.role) qs.set('role', params.role)
  const q = qs.toString()
  return request<FetchUsersResult>(`/api/v1/users${q ? '?' + q : ''}`)
}

export function createUser(data: CreateUserParams) {
  return request<UserInfo>('/api/v1/users', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateUser(id: number, data: UpdateUserParams) {
  return request<UserInfo>(`/api/v1/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export function deleteUser(id: number) {
  request(`/api/v1/users/${id}`, { method: 'DELETE' })
}

export function resetPassword(id: number, newPassword: string) {
  return request<any>(`/api/v1/users/${id}/reset-password`, {
    method: 'PUT',
    body: JSON.stringify({ newPassword }),
  })
}
