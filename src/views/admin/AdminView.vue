<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  DataBoard, Document, Monitor, Printer,
  FolderOpened, HomeFilled, ShoppingBag, Phone, DataAnalysis,
} from '@element-plus/icons-vue'

const router = useRouter()
const route = useRoute()

interface MenuItem {
  key: string
  label: string
  icon: any
  children?: { key: string; label: string; route: string }[]
}

const menuItems: MenuItem[] = [
  {
    key: 'overview',
    label: '概览',
    icon: DataBoard,
  },
  {
    key: 'logs',
    label: '操作日志',
    icon: Document,
  },
  {
    key: 'devices',
    label: '设备管理',
    icon: Monitor,
    children: [
      { key: 'devices/floors', label: '楼层管理', route: '/admin/devices/floors' },
      { key: 'devices/types', label: '设备类型', route: '/admin/devices/types' },
      { key: 'devices/models', label: '设备型号库', route: '/admin/devices/models' },
    ],
  },
  {
    key: 'printers',
    label: '打印机管理',
    icon: Printer,
    children: [
      { key: 'printers/floors', label: '楼层管理', route: '/admin/printers/floors' },
      { key: 'printers/brands', label: '品牌管理', route: '/admin/printers/brands' },
      { key: 'printers/models', label: '型号管理', route: '/admin/printers/models' },
      { key: 'printers/toners', label: '墨粉型号', route: '/admin/printers/toners' },
    ],
  },
  {
    key: 'services',
    label: '服务管理',
    icon: FolderOpened,
    children: [
      { key: 'services/categories', label: '分类管理', route: '/admin/services/categories' },
      { key: 'services/hosts', label: '主机管理', route: '/admin/services/hosts' },
    ],
  },
  {
    key: 'procurement',
    label: '采购管理',
    icon: ShoppingBag,
    children: [
      { key: 'procurement/departments', label: '部门管理', route: '/admin/procurement/departments' },
      { key: 'procurement/handlers', label: '经手人管理', route: '/admin/procurement/handlers' },
      { key: 'procurement/phone-brands', label: '手机品牌', route: '/admin/procurement/phone-brands' },
      { key: 'procurement/phone-models', label: '手机型号', route: '/admin/procurement/phone-models' },
      { key: 'procurement/computer-models', label: '电脑型号', route: '/admin/procurement/computer-models' },
    ],
  },
  {
    key: 'atcom',
    label: 'ATCOM 话机',
    icon: Phone,
    children: [
      { key: 'atcom-config', label: '连接配置', route: '/admin/atcom-config' },
    ],
  },
  {
    key: 'log-monitor',
    label: '日志监控',
    icon: DataAnalysis,
    children: [
      { key: 'log-monitor', label: '监控配置', route: '/admin/log-monitor' },
      { key: 'log-monitor/llm-test', label: 'LLM 测试', route: '/admin/log-monitor/llm-test' },
    ],
  },
]

const activeMenu = computed(() => {
  const path = route.path
  if (path === '/admin') return 'overview'
  if (path === '/admin/logs') return 'logs'
  const match = path.match(/^\/admin\/(.+)$/)
  return match ? match[1] : 'overview'
})

function handleMenuSelect(key: string) {
  if (key === 'overview') {
    router.push('/admin')
  } else if (key === 'logs') {
    router.push('/admin/logs')
  } else {
    for (const item of menuItems) {
      if (item.children) {
        const child = item.children.find(c => c.key === key)
        if (child) {
          router.push(child.route)
          return
        }
      }
    }
  }
}

function goHome() {
  router.push('/')
}
</script>

<template>
  <div class="admin-layout">
    <aside class="admin-sidebar">
      <div class="sidebar-header">
        <span class="sidebar-title">系统管理</span>
        <el-button :icon="HomeFilled" text size="small" class="back-btn" @click="goHome" title="返回首页" />
      </div>

      <el-menu
        :default-active="activeMenu"
        class="sidebar-menu"
        @select="handleMenuSelect"
      >
        <template v-for="item in menuItems" :key="item.key">
          <el-sub-menu v-if="item.children" :index="item.key">
            <template #title>
              <el-icon><component :is="item.icon" /></el-icon>
              <span>{{ item.label }}</span>
            </template>
            <el-menu-item
              v-for="child in item.children"
              :key="child.key"
              :index="child.key"
            >
              {{ child.label }}
            </el-menu-item>
          </el-sub-menu>

          <el-menu-item v-else :index="item.key">
            <el-icon><component :is="item.icon" /></el-icon>
            <span>{{ item.label }}</span>
          </el-menu-item>
        </template>
      </el-menu>
    </aside>

    <main class="admin-main">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.admin-layout {
  display: flex;
  min-height: 100vh;
  background: var(--ops-bg-page);
}

.admin-sidebar {
  width: 200px;
  min-width: 200px;
  background: transparent;
  display: flex;
  flex-direction: column;
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
  padding: 16px 0;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px 16px;
  border-bottom: 1px solid var(--ops-border-card);
  margin-bottom: 8px;
}

.sidebar-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--ops-text-tertiary);
  letter-spacing: 0.5px;
}

.back-btn {
  color: var(--ops-text-tertiary) !important;
}
.back-btn:hover {
  color: var(--ops-text-primary) !important;
}

.sidebar-menu {
  flex: 1;
  border-right: none;
  background: transparent;
}

.sidebar-menu :deep(.el-menu-item),
.sidebar-menu :deep(.el-sub-menu__title) {
  color: var(--ops-text-secondary);
  height: 36px;
  line-height: 36px;
  font-size: 13px;
}

.sidebar-menu :deep(.el-menu-item:hover),
.sidebar-menu :deep(.el-sub-menu__title:hover) {
  background: transparent;
  color: var(--ops-text-primary);
}

.sidebar-menu :deep(.el-menu-item.is-active) {
  color: var(--ops-accent-blue);
  background: transparent;
}

.sidebar-menu :deep(.el-sub-menu .el-menu-item) {
  padding-left: 48px !important;
  height: 32px;
  line-height: 32px;
  font-size: 12px;
}

.admin-main {
  flex: 1;
  padding: 20px 32px;
  overflow-y: auto;
  min-width: 0;
}
</style>
