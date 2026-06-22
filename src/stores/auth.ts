import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { login as apiLogin, getMe, type UserInfo } from '../api/auth'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserInfo | null>(null)
  const token = ref<string>(localStorage.getItem('token') || '')

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
    token.value = ''
    user.value = null
    localStorage.removeItem('token')
  }

  async function fetchMe() {
    try {
      user.value = await getMe()
    } catch {
      logout()
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
