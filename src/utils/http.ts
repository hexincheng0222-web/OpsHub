// src/utils/http.ts - 统一请求函数
export interface ApiResponse<T = any> {
  code: number
  data: T
  message?: string
}

/** 默认超时 15 秒 */
const DEFAULT_TIMEOUT_MS = 15_000

/**
 * 统一的 HTTP 请求函数 (#12)
 * - 支持 204 No Content 响应
 * - 自动检查 HTTP 状态码和业务 code
 * - 自动添加 Authorization header
 * - 401 自动跳转登录页
 * - AbortController 超时控制（默认 15s）
 * - 支持 caller 传入自定义 signal 取消请求
 */
export async function request<T = any>(
  url: string,
  options?: RequestInit & { timeoutMs?: number },
): Promise<T> {
  const token = localStorage.getItem('token')
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string> || {}),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  // 超时控制：合并 caller 传入的 signal 和内部 timeout signal
  const callerSignal = options?.signal
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)

  // 如果 caller 传了 signal，其 abort 也触发我们的 ctrl
  if (callerSignal) {
    if (callerSignal.aborted) ctrl.abort()
    else callerSignal.addEventListener('abort', () => ctrl.abort(), { once: true })
  }

  let res: Response
  try {
    res = await fetch(url, {
      ...options,
      headers,
      signal: ctrl.signal,
    })
  } catch (e: any) {
    clearTimeout(timer)
    // 用户主动取消（caller signal）→ 抛 AbortError 让上层判断
    if (e?.name === 'AbortError') throw e
    // 超时 abort → 抛 TimeoutError
    if (ctrl.signal.aborted && (!callerSignal || !callerSignal.aborted)) {
      throw new Error(`请求超时（${timeoutMs}ms）`)
    }
    throw e
  }
  clearTimeout(timer)

  // 204 No Content 响应没有 body
  if (res.status === 204) return undefined as T

  // 401 未登录/登录过期 → 通知 auth store 退出（避免整页跳转丢失 SPA 状态）
  if (res.status === 401) {
    // 先尝试读取服务端真实消息，区分"业务错误"与"会话过期"（#登录过期误报修复）
    let serverMessage = ''
    try {
      const errBody = await res.json()
      serverMessage = (errBody && typeof errBody === 'object' && 'message' in errBody && typeof errBody.message === 'string') ? errBody.message : ''
    } catch { /* 响应体非 JSON */ }

    // 鉴权类消息：未登录 / 登录已过期 → 触发退出
    // 业务类 401（用户名或密码错误、旧密码错误等）→ 透传真实消息且不登出
    const isAuthExpired = serverMessage === '未登录' || serverMessage === '登录已过期' || serverMessage === ''

    if (!isAuthExpired) {
      throw new Error(serverMessage || '请求未授权')
    }

    try {
      // 动态导入避免循环依赖
      const { useAuthStore } = await import('../stores/auth')
      useAuthStore().logout()
    } catch {
      localStorage.removeItem('token')
      // 兜底：同步清理业务缓存，防共享终端跨用户数据残留（#审查 M2）
      const businessKeys = ['opshub_ops_cache', 'opshub_services_cache', 'opshub_printers_cache', 'opshub_phones_cache']
      for (const k of businessKeys) localStorage.removeItem(k)
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
