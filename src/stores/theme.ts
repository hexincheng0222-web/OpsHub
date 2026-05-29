import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const useThemeStore = defineStore('theme', () => {
  const isDark = ref(true) // 默认深色主题

  // 初始化时从localStorage读取主题
  function initTheme() {
    const savedTheme = localStorage.getItem('theme')
    if (savedTheme) {
      isDark.value = savedTheme === 'dark'
    } else {
      // 检查系统偏好
      isDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    applyTheme()
  }

  // 应用主题到DOM
  function applyTheme() {
    const html = document.documentElement
    const body = document.body
    
    if (isDark.value) {
      html.classList.remove('light-theme')
      body.classList.remove('light-theme')
      // 启用Element Plus深色模式
      html.classList.add('dark')
      body.classList.add('dark')
    } else {
      html.classList.add('light-theme')
      body.classList.add('light-theme')
      // 禁用Element Plus深色模式
      html.classList.remove('dark')
      body.classList.remove('dark')
    }
    
    // 保存到localStorage
    localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
  }

  // 切换主题
  function toggleTheme() {
    isDark.value = !isDark.value
    applyTheme()
  }

  // 设置特定主题
  function setTheme(dark: boolean) {
    isDark.value = dark
    applyTheme()
  }

  // 监听系统主题变化
  function watchSystemTheme() {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQuery.addEventListener('change', (e) => {
      // 只有当用户没有手动设置主题时才跟随系统
      if (!localStorage.getItem('theme')) {
        isDark.value = e.matches
        applyTheme()
      }
    })
  }

  return {
    isDark,
    initTheme,
    toggleTheme,
    setTheme,
    watchSystemTheme
  }
})