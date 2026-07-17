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
