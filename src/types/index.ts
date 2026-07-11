// ========== 设备类型 ==========
export interface Device {
  id: number
  name: string
  type: 'server' | 'switch' | 'storage' | 'router' | 'firewall' | 'ups' | 'pdu'
  model: string
  u: number
  ports: number
  status: '正常' | '停用'
  ip?: string
}

export interface Rack {
  id: string
  name: string
  floor: string
  totalU: number
  devices: (Device | null)[]
}

/** 默认楼层列表 — 后端字典未加载时的回退值 */
export const FLOORS = ['-1F', '1F', '2F', '3F', '4F']

// ========== 服务类型 ==========
export interface Service {
  id: number
  name: string
  url: string
  description: string
  notes?: string
  icon: string
  category: string
  status: 'online' | 'offline' | 'maintenance' | 'checking'
  hostId?: number | null
  createdAt?: string
}

// ========== 运维手册类型 ==========
export interface ManualFolder {
  id: string
  name: string
  icon: string
}

export interface ManualDoc {
  id: number
  title: string
  content: string
  folderId: string
  author: string
  createTime: string
  updateTime: string
}

// ========== 打印机类型 ==========
export interface Printer {
  id: number
  floor: string
  location: string
  manufacturer: string
  model: string
  tonerModel: string
  notes: string
  status: '正常' | '缺墨' | '故障'
}
