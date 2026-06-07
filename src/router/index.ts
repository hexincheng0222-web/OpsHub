import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
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
      meta: { title: '设备管理' }
    },
    {
      path: '/computer-procurement',
      name: 'ComputerProcurement',
      component: () => import('../views/ComputerProcurementView.vue'),
      meta: { title: '电脑采购' }
    },
    {
      path: '/phone-procurement',
      name: 'PhoneProcurement',
      component: () => import('../views/PhoneProcurementView.vue'),
      meta: { title: '手机采购' }
    },
    {
      path: '/printers',
      name: 'Printers',
      component: () => import('../views/PrintersView.vue'),
      meta: { title: '打印机管理' }
    },
    {
      path: '/admin',
      name: 'Admin',
      component: () => import('../views/admin/AdminView.vue'),
      meta: { title: '系统管理' },
      children: [
        { path: '', name: 'AdminOverview', component: () => import('../views/admin/AdminOverview.vue'), meta: { title: '系统概览' } },
        { path: 'logs', name: 'AdminLogs', component: () => import('../views/admin/AdminLogs.vue'), meta: { title: '操作日志' } },
        { path: 'devices/floors', name: 'AdminDeviceFloors', component: () => import('../views/admin/AdminDictTable.vue'), meta: { dict: 'device-floors', title: '楼层管理' } },
        { path: 'devices/types', name: 'AdminDeviceTypes', component: () => import('../views/admin/AdminDictTable.vue'), meta: { dict: 'device-types', title: '设备类型' } },
        { path: 'devices/models', name: 'AdminDeviceModels', component: () => import('../views/admin/AdminDictTable.vue'), meta: { dict: 'device-models', title: '设备型号库' } },
        { path: 'printers/floors', name: 'AdminPrinterFloors', component: () => import('../views/admin/AdminDictTable.vue'), meta: { dict: 'printer-floors', title: '楼层管理' } },
        { path: 'printers/brands', name: 'AdminPrinterBrands', component: () => import('../views/admin/AdminDictTable.vue'), meta: { dict: 'printer-brands', title: '品牌管理' } },
        { path: 'printers/models', name: 'AdminPrinterModels', component: () => import('../views/admin/AdminDictTable.vue'), meta: { dict: 'printer-models', title: '型号管理' } },
        { path: 'printers/toners', name: 'AdminPrinterToners', component: () => import('../views/admin/AdminDictTable.vue'), meta: { dict: 'toner-models', title: '墨粉型号' } },
        { path: 'services/categories', name: 'AdminServiceCategories', component: () => import('../views/admin/AdminDictTable.vue'), meta: { dict: 'service-categories', title: '分类管理' } },
        { path: 'services/hosts', name: 'AdminServiceHosts', component: () => import('../views/admin/AdminDictTable.vue'), meta: { dict: 'service-hosts', title: '主机管理' } },
        { path: 'procurement/departments', name: 'AdminProcDepartments', component: () => import('../views/admin/AdminDictTable.vue'), meta: { dict: 'procurement-departments', title: '部门管理' } },
        { path: 'procurement/handlers', name: 'AdminProcHandlers', component: () => import('../views/admin/AdminDictTable.vue'), meta: { dict: 'procurement-handlers', title: '经手人管理' } },
        { path: 'procurement/phone-brands', name: 'AdminPhoneBrands', component: () => import('../views/admin/AdminDictTable.vue'), meta: { dict: 'phone-brands', title: '手机品牌' } },
        { path: 'procurement/phone-models', name: 'AdminPhoneModels', component: () => import('../views/admin/AdminDictTable.vue'), meta: { dict: 'phone-models', title: '手机型号' } },
        { path: 'procurement/computer-purchase-models', name: 'AdminComputerPurchaseModels', component: () => import('../views/admin/AdminDictTable.vue'), meta: { dict: 'computer-purchase-models', title: '电脑采购型号' } },
        { path: 'procurement/computer-device-models', name: 'AdminComputerDeviceModels', component: () => import('../views/admin/AdminDictTable.vue'), meta: { dict: 'computer-device-models', title: '电脑设备型号' } },
      ]
    }
  ]
})

// 动态更新页面标题
router.afterEach((to) => {
  const title = to.meta.title as string
  document.title = title ? `${title} - 运维中心` : '运维中心'
})

export default router
