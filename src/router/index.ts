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
      component: () => import('../views/ServicesView.vue')
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
      path: '/printers',
      name: 'Printers',
      component: () => import('../views/PrintersView.vue')
    }
  ]
})

export default router
