import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { defineStore } from 'pinia'
import { login as apiLogin, getMe, type UserInfo } from '../api/auth'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserInfo | null>(null)
  const token = ref<string>(localStorage.getItem('token') || '')
  const router = useRouter()
  const route = useRoute()

  // logout 互斥锁：防止 App.vue / router guard / http.ts 401 三处并发触发
  let logoutInProgress = false

  const isLoggedIn = computed(() => !!token.value)
  const isAdmin = computed(() => user.value?.role === 'admin' || user.value?.role === 'superadmin')
  const isSuperAdmin = computed(() => user.value?.role === 'superadmin')

  async function login(username: string, password: string) {
    const data = await apiLogin(username, password)
    token.value = data.token
    user.value = data.user
    localStorage.setItem('token', data.token)
  }

  function logout() {
    if (logoutInProgress) return
    logoutInProgress = true
    token.value = ''
    user.value = null
    localStorage.removeItem('token')
    clearBusinessCache()
    // 记录当前位置，登录后可跳回（避免落在 /login 上）
    const from = route.fullPath
    if (from && from !== '/login') {
      router.push({ path: '/login', query: { redirect: from } })
    } else {
      router.push('/login')
    }
    // 跳转完成后释放锁（router.push 是异步，等 afterEach 触发再释放）(#25)
    const unhook = router.afterEach(() => {
      logoutInProgress = false
      unhook()
    })
  }

  /**
   * 清空业务数据缓存（防跨用户数据残留 #审查 M2）
   * 登出时若不清，共享终端上后登录的用户会读到前一用户缓存的
   * 知识库全文/服务列表/打印机/话机数据，绕过服务端权限过滤。
   * 仅清理业务缓存，保留 theme / admin_menu_opened 等 UI 偏好。
   */
  function clearBusinessCache() {
    try {
      const BUSINESS_KEYS = [
        'opshub_ops_cache',        // 知识库（可能含内网配置/口令）
        'opshub_services_cache',   // 服务列表
        'opshub_printers_cache',   // 打印机清单
        'opshub_phones_cache',     // 话机列表（含内网 IP）
      ]
      for (const key of BUSINESS_KEYS) localStorage.removeItem(key)
      // 知识库编辑草稿（动态键 ops_draft_<id> / ops_draft_new）
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i)
        if (k && k.startsWith('ops_draft_')) localStorage.removeItem(k)
      }
    } catch { /* localStorage 不可用时忽略 */ }
  }

  async function fetchMe() {
    try {
      user.value = await getMe()
    } catch (e: any) {
      // #26 仅 401（登录过期）触发退出；网络抖动等非鉴权错误保留当前 user，避免误踢
      if (e?.message === '登录已过期') {
        logout()
      } else {
        console.warn('[auth] 获取用户信息失败（非鉴权错误，保留登录态）:', e?.message)
      }
    }
  }

  return {
    user,
    token,
    isLoggedIn,
    isAdmin,
    isSuperAdmin,
    login,
    logout,
    fetchMe,
  }
})
