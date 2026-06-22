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

export function fetchUsers() {
  return request<UserInfo[]>('/api/v1/users')
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
