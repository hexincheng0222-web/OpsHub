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
 */
export async function request<T = any>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })

  // 204 No Content 响应没有 body
  if (res.status === 204) return undefined as T

  // HTTP 错误（4xx/5xx）
  if (!res.ok) {
    let message = `HTTP ${res.status}`
    try {
      const errBody = await res.json()
      message = errBody.message || message
    } catch { /* 响应体非 JSON，使用默认消息 */ }
    throw new Error(message)
  }

  const json: ApiResponse<T> = await res.json()

  // 业务层错误
  if (json.code >= 400) {
    throw new Error(json.message || `错误码 ${json.code}`)
  }

  return json.data
}
