<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router'
import {
  Setting, DataBoard, Document, Monitor, Connection, Printer, Coffee,
  FolderOpened, ArrowLeft, HomeFilled
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
]

const activeMenu = computed(() => {
  const path = route.path
  if (path === '/admin') return 'overview'
  if (path === '/admin/logs') return 'logs'
  // 匹配子路由
  const match = path.match(/^\/admin\/(.+)$/)
  return match ? match[1] : 'overview'
})

function handleMenuSelect(key: string) {
  if (key === 'overview') {
    router.push('/admin')
  } else if (key === 'logs') {
    router.push('/admin/logs')
  } else {
    // 找到对应子项的 route
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

<script lang="ts">
import { computed } from 'vue'
export default {}
</script>

<template>
  <div class="admin-layout">
    <!-- 侧边栏 -->
    <aside class="admin-sidebar">
      <div class="sidebar-header">
        <div class="sidebar-brand">
          <el-icon :size="24"><Setting /></el-icon>
          <span class="sidebar-title">系统管理</span>
        </div>
        <el-button :icon="HomeFilled" text circle size="small" class="back-btn" @click="goHome" title="返回首页" />
      </div>

      <el-menu
        :default-active="activeMenu"
        class="sidebar-menu"
        @select="handleMenuSelect"
      >
        <template v-for="item in menuItems" :key="item.key">
          <!-- 有子菜单 -->
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

          <!-- 无子菜单 -->
          <el-menu-item v-else :index="item.key">
            <el-icon><component :is="item.icon" /></el-icon>
            <span>{{ item.label }}</span>
          </el-menu-item>
        </template>
      </el-menu>
    </aside>

    <!-- 主内容区 -->
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

/* 侧边栏 */
.admin-sidebar {
  width: 220px;
  min-width: 220px;
  background: var(--ops-bg-card);
  border-right: 1px solid var(--ops-border-card);
  display: flex;
  flex-direction: column;
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 16px 12px;
  border-bottom: 1px solid var(--ops-border-card);
}

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--ops-accent-blue);
}

.sidebar-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--ops-text-primary);
}

.back-btn {
  color: var(--ops-text-secondary) !important;
}
.back-btn:hover {
  color: var(--ops-accent-blue) !important;
}

/* 侧边栏菜单 */
.sidebar-menu {
  flex: 1;
  border-right: none;
  background: transparent;
  padding: 8px 0;
}

.sidebar-menu :deep(.el-menu-item),
.sidebar-menu :deep(.el-sub-menu__title) {
  color: var(--ops-text-secondary);
  height: 44px;
  line-height: 44px;
  font-size: 13px;
}

.sidebar-menu :deep(.el-menu-item:hover),
.sidebar-menu :deep(.el-sub-menu__title:hover) {
  background: var(--ops-bg-card-hover);
  color: var(--ops-text-primary);
}

.sidebar-menu :deep(.el-menu-item.is-active) {
  color: var(--ops-accent-blue);
  background: rgba(88, 166, 255, 0.08);
  border-right: 3px solid var(--ops-accent-blue);
}

.sidebar-menu :deep(.el-sub-menu .el-menu-item) {
  padding-left: 56px !important;
  height: 40px;
  line-height: 40px;
}

/* 主内容 */
.admin-main {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
  min-width: 0;
}
</style>
