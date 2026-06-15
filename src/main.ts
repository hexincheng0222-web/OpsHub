import { createApp } from 'vue'
import ElementPlus, { ElMessage } from 'element-plus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import './styles/variables.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import './styles/global.css'

// ===== 主题提前初始化（在 Vue 挂载前同步执行，避免闪烁） =====
;(function initThemeEarly() {
  const saved = localStorage.getItem('theme')
  const isDark = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
  const html = document.documentElement
  const body = document.body
  if (isDark) {
    html.classList.remove('light-theme')
    body.classList.remove('light-theme')
    html.classList.add('dark')
    body.classList.add('dark')
  } else {
    html.classList.add('light-theme')
    body.classList.add('light-theme')
    html.classList.remove('dark')
    body.classList.remove('dark')
  }
})()

const app = createApp(App)

// 全局错误处理
app.config.errorHandler = (err, _instance, info) => {
  console.error('[Vue Error]', err, info)
  ElMessage.error('页面发生错误，请刷新重试')
}
window.addEventListener('unhandledrejection', (event) => {
  console.error('[Unhandled Rejection]', event.reason)
  event.preventDefault()
})

// 注册所有 Element Plus 图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.use(ElementPlus, { locale: zhCn })
app.use(createPinia())
app.use(router)
app.mount('#app')
