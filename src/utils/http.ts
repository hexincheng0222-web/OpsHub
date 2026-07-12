// src/utils/http.ts - 统一请求函数
export interface ApiResponse<T = any> {
  code: number
  data: T
  message?: string
}

/**
 * 统一的 HTTP 请求函数
 * - 支持 204 No Content 响应
 * - 自动检查 HTTP 状态码和业务 code
 * - 自动添加 Authorization header
 * - 401 自动跳转登录页
 */
export async function request<T = any>(url: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('token')

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string> || {}),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(url, {
    ...options,
    headers,
  })

  // 204 No Content 响应没有 body
  if (res.status === 204) return undefined as T

  // 401 未登录/登录过期 → 通知 auth store 退出（避免整页跳转丢失 SPA 状态）
  if (res.status === 401) {
    try {
      // 动态导入避免循环依赖
      const { useAuthStore } = await import('../stores/auth')
      useAuthStore().logout()
    } catch {
      localStorage.removeItem('token')
      const redirect = encodeURIComponent(location.pathname + location.search)
      window.location.href = `/login?redirect=${redirect}`
    }
    throw new Error('登录已过期')
  }

  // HTTP 错误（4xx/5xx）
  if (!res.ok) {
    let message = `HTTP ${res.status}`
    try {
      const errBody = await res.json()
      message = errBody.message || message
    } catch { /* 响应体非 JSON，使用默认消息 */ }
    // 兜底替换英文 SQLite 错误
    if (/SQLITE|HASH|constraint|FOREIGN KEY|UNIQUE constraint/i.test(message)) {
      message = '操作失败，请稍后再试'
    }
    throw new Error(message)
  }

  let json: ApiResponse<T>
  try {
    json = await res.json()
  } catch (e: any) {
    // 网关/反向代理回传 HTML 错误页但状态码 200 的兜底
    throw new Error('响应格式异常（非 JSON），可能是网关错误页')
  }

  // 业务层错误
  if (json.code >= 400) {
    let message = json.message || `错误码 ${json.code}`
    if (/SQLITE|HASH|constraint|FOREIGN KEY|UNIQUE constraint/i.test(message)) {
      message = '操作失败，请稍后再试'
    }
    throw new Error(message)
  }

  return json.data
}
