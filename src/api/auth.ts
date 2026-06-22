import { request } from '../utils/http'

export interface UserInfo {
  id: number
  username: string
  display_name: string
  role: 'superadmin' | 'admin' | 'user'
  last_login_at?: string
  is_active?: number
  created_at?: string
  updated_at?: string
}

export interface LoginResponse {
  token: string
  user: UserInfo
}

export function login(username: string, password: string) {
  return request<LoginResponse>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export function getMe() {
  return request<UserInfo>('/api/v1/auth/me')
}

export function changePassword(oldPassword: string, newPassword: string) {
  return request<any>('/api/v1/auth/password', {
    method: 'PUT',
    body: JSON.stringify({ oldPassword, newPassword }),
  })
}
