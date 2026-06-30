/**
 * 动态图标解析 — 用于从数据库存储的图标名称字符串获取 Element Plus 图标组件
 *
 * 背景：服务数据中的 icon 字段存的是字符串（如 'Monitor'），但 Vue template
 * 的 <component :is="string"> 需要组件已注册。此模块集中管理所有动态图标。
 */
import {
  Setting,
  Monitor,
  DataAnalysis,
  SetUp,
  Connection,
  FolderOpened,
  Link,
  Position,
  Operation,
  Cpu,
  Printer,
  Cellphone,
  Phone,
  Refresh,
  Search,
  Document,
  Plus,
  ArrowDown,
  Download,
  Upload,
  Delete,
  View,
  Loading,
  HomeFilled,
  ShoppingBag,
  User,
  VideoPlay,
  DataBoard,
} from '@element-plus/icons-vue'

const iconMap: Record<string, any> = {
  Setting,
  Monitor,
  DataAnalysis,
  SetUp,
  Connection,
  FolderOpened,
  Link,
  Position,
  Operation,
  Cpu,
  Printer,
  Cellphone,
  Phone,
  Refresh,
  Search,
  Document,
  Plus,
  ArrowDown,
  Download,
  Upload,
  Delete,
  View,
  Loading,
  HomeFilled,
  ShoppingBag,
  User,
  VideoPlay,
  DataBoard,
}

/** 根据图标名称获取 Vue 组件，找不到时回退到 Setting */
export function resolveIcon(name: string) {
  return iconMap[name] || Setting
}

/** 所有已在 map 中的图标键名（用于 `icon` 字段下拉选择等） */
export const iconKeys = Object.keys(iconMap)
