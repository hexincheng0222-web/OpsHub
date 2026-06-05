import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'Home',
      component: () => import('../views/HomeView.vue')
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
      meta: { title: '编辑操作手册' }
    },
    {
      path: '/operations',
      name: 'Operations',
      component: () => import('../views/OperationsView.vue')
    },
    {
      path: '/devices',
      name: 'Devices',
      component: () => import('../views/DevicesView.vue')
    },
    {
      path: '/computer-procurement',
      name: 'ComputerProcurement',
      component: () => import('../views/ComputerProcurementView.vue')
    },
    {
      path: '/phone-procurement',
      name: 'PhoneProcurement',
      component: () => import('../views/PhoneProcurementView.vue')
    },
    {
      path: '/printers',
      name: 'Printers',
      component: () => import('../views/PrintersView.vue')
    },
    {
      path: '/admin',
      name: 'Admin',
      component: () => import('../views/admin/AdminView.vue'),
      children: [
        { path: '', name: 'AdminOverview', component: () => import('../views/admin/AdminOverview.vue') },
        { path: 'logs', name: 'AdminLogs', component: () => import('../views/admin/AdminLogs.vue') },
        { path: 'devices/floors', name: 'AdminDeviceFloors', component: () => import('../views/admin/AdminDictTable.vue'), meta: { dict: 'device-floors', title: '楼层管理' } },
        { path: 'devices/types', name: 'AdminDeviceTypes', component: () => import('../views/admin/AdminDictTable.vue'), meta: { dict: 'device-types', title: '设备类型' } },
        { path: 'devices/models', name: 'AdminDeviceModels', component: () => import('../views/admin/AdminDictTable.vue'), meta: { dict: 'device-models', title: '设备型号库' } },
        { path: 'printers/floors', name: 'AdminPrinterFloors', component: () => import('../views/admin/AdminDictTable.vue'), meta: { dict: 'printer-floors', title: '楼层管理' } },
        { path: 'printers/brands', name: 'AdminPrinterBrands', component: () => import('../views/admin/AdminDictTable.vue'), meta: { dict: 'printer-brands', title: '品牌管理' } },
        { path: 'printers/models', name: 'AdminPrinterModels', component: () => import('../views/admin/AdminDictTable.vue'), meta: { dict: 'printer-models', title: '型号管理' } },
        { path: 'printers/toners', name: 'AdminPrinterToners', component: () => import('../views/admin/AdminDictTable.vue'), meta: { dict: 'toner-models', title: '墨粉型号' } },
        { path: 'services/categories', name: 'AdminServiceCategories', component: () => import('../views/admin/AdminDictTable.vue'), meta: { dict: 'service-categories', title: '分类管理' } },
        { path: 'services/hosts', name: 'AdminServiceHosts', component: () => import('../views/admin/AdminDictTable.vue'), meta: { dict: 'service-hosts', title: '主机管理' } },
      ]
    }
  ]
})

export default router
