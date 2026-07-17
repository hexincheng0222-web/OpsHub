import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'Login',
      component: () => import('../views/LoginView.vue'),
      meta: { title: '登录', public: true }
    },
    {
      path: '/',
      name: 'Home',
      component: () => import('../views/HomeView.vue'),
      meta: { title: '运维中心' }
    },
    {
      path: '/services',
      name: 'Services',
      component: () => import('../views/ServicesView.vue'),
      meta: { title: '内网服务管理' }
    },
    {
      path: '/operations/edit/:id?',
      name: 'OperationsEdit',
      component: () => import('../views/ManDocEditor.vue'),
      meta: { title: '编辑手册' }
    },
    {
      path: '/operations',
      name: 'Operations',
      component: () => import('../views/OperationsView.vue'),
      meta: { title: '运维操作手册' }
    },
    {
      path: '/devices',
      name: 'Devices',
      component: () => import('../views/DevicesView.vue'),
      meta: { title: '设备管理', roles: ['admin', 'superadmin'] }
    },
    {
      path: '/procurement',
      name: 'Procurement',
      component: () => import('../views/procurement/ProcurementView.vue'),
      meta: { title: '采购管理', roles: ['admin', 'superadmin'] }
    },
    {
      path: '/computer-procurement',
      name: 'ComputerProcurement',
      redirect: () => ({ path: '/procurement', query: { tab: 'computer' } }),
    },
    {
      path: '/phone-procurement',
      name: 'PhoneProcurement',
      redirect: () => ({ path: '/procurement', query: { tab: 'phone' } }),
    },
    {
      path: '/phones',
      name: 'Phones',
      component: () => import('../views/PhonesView.vue'),
      meta: { title: 'ATCOM话机管理', roles: ['admin', 'superadmin'] }
    },
    {
      path: '/printers',
      name: 'Printers',
      component: () => import('../views/PrintersView.vue'),
      meta: { title: '打印机管理', roles: ['admin', 'superadmin'] }
    },
    {
      path: '/admin',
      name: 'Admin',
      component: () => import('../views/admin/AdminView.vue'),
      meta: { title: '系统管理', roles: ['admin', 'superadmin'] },
      children: [
        { path: '', name: 'AdminOverview', component: () => import('../views/admin/AdminOverview.vue'), meta: { title: '系统概览' } },
        { path: 'floors', name: 'AdminFloors', component: () => import('../views/admin/AdminFloors.vue'), meta: { title: '楼层管理' } },
        { path: 'users', name: 'AdminUsers', component: () => import('../views/admin/AdminUsers.vue'), meta: { title: '用户管理', roles: ['superadmin'] } },
        { path: 'logs', name: 'AdminLogs', component: () => import('../views/admin/AdminLogs.vue'), meta: { title: '操作日志' } },
        { path: 'devices/types', name: 'AdminDeviceTypes', component: () => import('../views/admin/AdminDictTable.vue'), meta: { dict: 'device-types', title: '设备类型' } },
        { path: 'devices/models', name: 'AdminDeviceModels', component: () => import('../views/admin/AdminDictTable.vue'), meta: { dict: 'device-models', title: '设备型号库' } },
        { path: 'printers/brands', name: 'AdminPrinterBrands', component: () => import('../views/admin/AdminDictTable.vue'), meta: { dict: 'printer-brands', title: '品牌管理' } },
        { path: 'printers/models', name: 'AdminPrinterModels', component: () => import('../views/admin/AdminDictTable.vue'), meta: { dict: 'printer-models', title: '型号管理' } },
        { path: 'printers/toners', name: 'AdminPrinterToners', component: () => import('../views/admin/AdminDictTable.vue'), meta: { dict: 'toner-models', title: '墨粉型号' } },
        { path: 'services/categories', name: 'AdminServiceCategories', component: () => import('../views/admin/AdminDictTable.vue'), meta: { dict: 'service-categories', title: '分类管理' } },
        { path: 'services/hosts', name: 'AdminServiceHosts', component: () => import('../views/admin/AdminDictTable.vue'), meta: { dict: 'service-hosts', title: '主机管理' } },
        { path: 'services/list', name: 'AdminServices', component: () => import('../views/admin/AdminServices.vue'), meta: { title: '服务管理' } },
        { path: 'procurement/departments', name: 'AdminProcDepartments', component: () => import('../views/admin/AdminDictTable.vue'), meta: { dict: 'procurement-departments', title: '部门管理' } },
        { path: 'procurement/handlers', name: 'AdminProcHandlers', component: () => import('../views/admin/AdminDictTable.vue'), meta: { dict: 'procurement-handlers', title: '经手人管理' } },
        { path: 'procurement/phone-brands', name: 'AdminPhoneBrands', component: () => import('../views/admin/AdminDictTable.vue'), meta: { dict: 'phone-brands', title: '手机品牌' } },
        { path: 'procurement/phone-models', name: 'AdminPhoneModels', component: () => import('../views/admin/AdminDictTable.vue'), meta: { dict: 'phone-models', title: '手机型号' } },
        { path: 'procurement/computer-models', name: 'AdminComputerModels', component: () => import('../views/admin/AdminDictTable.vue'), meta: { dict: 'computer-models', title: '电脑型号' } },
        { path: 'atcom-config', name: 'AdminAtcomConfig', component: () => import('../views/admin/AdminAtcomConfig.vue'), meta: { title: 'ATCOM话机配置' } },
        { path: 'log-monitor', name: 'AdminLogMonitor', component: () => import('../views/admin/LogMonitorConfig.vue'), meta: { title: '日志监控配置' } },
        { path: 'log-monitor/llm-test', name: 'AdminLogMonitorLlmTest', component: () => import('../views/admin/LogMonitorLlmTest.vue'), meta: { title: 'LLM 连通测试' } },
      ]
    },
    {
      path: '/log-monitor',
      name: 'LogMonitor',
      component: () => import('../views/log-monitor/LogMonitorView.vue'),
      meta: { title: '日志监控', icon: 'DataAnalysis', roles: ['admin', 'superadmin'] },
    },
    {
      path: '/log-monitor/audit',
      name: 'LogMonitorAudit',
      component: () => import('../views/log-monitor/LogMonitorAudit.vue'),
      meta: { title: '审计记录', icon: 'Document', roles: ['admin', 'superadmin'] },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'NotFound',
      component: () => import('../views/NotFound.vue'),
      meta: { title: '页面不存在', public: true }
    }
  ]
})

/**
 * 校验 redirect 参数白名单 (#13)
 * 只允许同域相对路径（以 / 开头但不以 // 开头），拒绝 //evil.com、https://evil.com 等
 */
function safeRedirect(redirect: unknown): string | null {
  if (typeof redirect !== 'string') return null
  if (!redirect.startsWith('/')) return null
  if (redirect.startsWith('//')) return null
  return redirect
}

// 路由守卫 — 登录和权限检查（唯一登录态校验入口）
router.beforeEach(async (to) => {
  const auth = useAuthStore()

  // 确保已验证过 token（fetchMe 失败会触发 logout，由 logout 互斥锁保证不重复跳转）
  if (auth.token && !auth.user) {
    await auth.fetchMe()
  }

  // 已登录访问登录页 → 跳转首页或 redirect 目标
  if (auth.isLoggedIn && to.path === '/login') {
    const redirect = safeRedirect(to.query.redirect)
    return redirect || '/'
  }

  // 未登录访问受保护页 → 跳登录页带 redirect
  if (!auth.isLoggedIn && to.path !== '/login') {
    return { path: '/login', query: { redirect: to.fullPath } }
  }

  // 角色守卫：meta.roles 指定的角色才能访问 (#13)
  // R1 修复：auth.user 为 null 时（fetchMe 失败/网络抖动）不能放行，否则普通 user 可趁登录态未校验时进入 admin 路由
  const requiredRoles = to.meta.roles as string[] | undefined
  if (requiredRoles) {
    if (!auth.user) {
      // 有 token 但 user 未加载成功 → 视为无权限，回首页避免越权
      return '/'
    }
    if (!requiredRoles.includes(auth.user.role)) {
      return '/'
    }
  }
})

// 动态更新页面标题
router.afterEach((to) => {
  const title = to.meta.title as string
  document.title = title ? `${title} - 运维中心` : '运维中心'
})

export default router
