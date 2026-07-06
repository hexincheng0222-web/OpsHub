// utils/admin-dict-config.ts
export interface ColumnConfig {
  prop: string
  label: string
  type: 'text' | 'number' | 'select' | 'color' | 'textarea'
  required?: boolean
  width?: number
  options?: { label: string; value: any }[]
}

export interface DictConfig {
  title: string
  columns: ColumnConfig[]
  dependencies?: { dict: string; targetColumn: string; valueKey?: string; labelKey?: string }[]
}

export const dictConfigs: Record<string, DictConfig> = {
  'device-floors': {
    title: '楼层管理',
    columns: [
      { prop: 'name', label: '楼层名称', type: 'text', required: true },
      { prop: 'sort_order', label: '排序', type: 'number' },
    ],
  },
  'device-types': {
    title: '设备类型',
    columns: [
      { prop: 'key', label: '类型键名', type: 'text', required: true },
      { prop: 'name', label: '显示名称', type: 'text', required: true },
      { prop: 'abbr', label: '缩写', type: 'text', required: true },
      { prop: 'icon', label: '图标', type: 'text' },
      { prop: 'color', label: '颜色', type: 'color' },
      { prop: 'sort_order', label: '排序', type: 'number' },
    ],
  },
  'device-models': {
    title: '设备型号库',
    dependencies: [{ dict: 'device-types', targetColumn: 'type_key', valueKey: 'key', labelKey: 'name' }],
    columns: [
      { prop: 'name', label: '型号名称', type: 'text', required: true },
      { prop: 'type_key', label: '设备类型', type: 'select', required: true, options: [] },
      { prop: 'manufacturer', label: '厂商', type: 'text' },
      { prop: 'u_size', label: 'U 数', type: 'number' },
      { prop: 'ports', label: '端口数', type: 'number' },
      { prop: 'power_watts', label: '功耗(W)', type: 'number' },
      { prop: 'description', label: '描述', type: 'textarea' },
      { prop: 'sort_order', label: '排序', type: 'number' },
    ],
  },
  'printer-floors': {
    title: '楼层管理',
    columns: [
      { prop: 'name', label: '楼层名称', type: 'text', required: true },
      { prop: 'sort_order', label: '排序', type: 'number' },
    ],
  },
  'printer-brands': {
    title: '品牌管理',
    columns: [
      { prop: 'name', label: '品牌名称', type: 'text', required: true },
      { prop: 'sort_order', label: '排序', type: 'number' },
    ],
  },
  'printer-models': {
    title: '型号管理',
    dependencies: [{ dict: 'printer-brands', targetColumn: 'brand_id' }],
    columns: [
      { prop: 'brand_id', label: '所属品牌', type: 'select', required: true, options: [] },
      { prop: 'name', label: '型号名称', type: 'text', required: true },
      { prop: 'sort_order', label: '排序', type: 'number' },
    ],
  },
  'toner-models': {
    title: '墨粉型号',
    dependencies: [{ dict: 'printer-brands', targetColumn: 'brand_id' }],
    columns: [
      { prop: 'name', label: '墨粉型号', type: 'text', required: true },
      { prop: 'brand_id', label: '所属品牌', type: 'select', required: true, options: [] },
      { prop: 'compatible', label: '适用机型', type: 'textarea' },
      { prop: 'sort_order', label: '排序', type: 'number' },
    ],
  },
  'service-categories': {
    title: '服务分类',
    columns: [
      { prop: 'name', label: '分类名称', type: 'text', required: true },
      { prop: 'icon', label: '图标', type: 'text' },
      { prop: 'color', label: '颜色', type: 'color' },
      { prop: 'sort_order', label: '排序', type: 'number' },
    ],
  },
  'service-hosts': {
    title: '服务主机',
    dependencies: [{ dict: 'service-categories', targetColumn: 'category', valueKey: 'name', labelKey: 'name' }],
    columns: [
      { prop: 'name', label: '主机名称', type: 'text', required: true },
      { prop: 'ip', label: 'IP 地址', type: 'text' },
      { prop: 'os', label: '操作系统', type: 'text' },
      { prop: 'category', label: '分类', type: 'select', options: [] },
      { prop: 'description', label: '描述', type: 'textarea' },
      { prop: 'sort_order', label: '排序', type: 'number' },
    ],
  },
  'procurement-departments': {
    title: '采购部门',
    columns: [
      { prop: 'name', label: '部门名称', type: 'text', required: true },
      { prop: 'sort_order', label: '排序', type: 'number' },
    ],
  },
  'procurement-handlers': {
    title: '采购经手人',
    columns: [
      { prop: 'name', label: '姓名', type: 'text', required: true },
      { prop: 'sort_order', label: '排序', type: 'number' },
    ],
  },
  'phone-brands': {
    title: '手机品牌',
    columns: [
      { prop: 'name', label: '品牌名称', type: 'text', required: true },
      { prop: 'sort_order', label: '排序', type: 'number' },
    ],
  },
  'phone-models': {
    title: '手机型号',
    dependencies: [{ dict: 'phone-brands', targetColumn: 'brand_id' }],
    columns: [
      { prop: 'brand_id', label: '所属品牌', type: 'select', required: true, options: [] },
      { prop: 'name', label: '型号名称', type: 'text', required: true },
      { prop: 'sort_order', label: '排序', type: 'number' },
    ],
  },
  'computer-models': {
    title: '电脑型号',
    columns: [
      { prop: 'name', label: '型号名称', type: 'text', required: true },
      { prop: 'sort_order', label: '排序', type: 'number' },
    ],
  },
  'phone-remarks': {
    title: '话机备注',
    columns: [
      { prop: 'extension', label: '分机号', type: 'text', required: true },
      { prop: 'remark', label: '备注', type: 'textarea' },
    ],
  },
}