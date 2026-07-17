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
}

export const SERVICE_CATEGORIES = ['DevOps', '监控', '基础设施', '协作'] as const

export const mockServices: Service[] = [
  {
    id: 1,
    name: 'Zabbix 监控',
    url: 'http://10.0.0.1/zabbix',
    description: '企业级 IT 监控平台',
    notes: '请联系管理员获取凭据',
    icon: 'Monitor',
    category: '监控',
    status: 'online'
  },
  {
    id: 2,
    name: 'Grafana 监控 (1)',
    url: 'http://10.0.0.1:3000',
    description: '系统与服务监控可视化',
    notes: '请联系管理员获取凭据',
    icon: 'DataAnalysis',
    category: '监控',
    status: 'online'
  },
  {
    id: 3,
    name: 'Grafana 监控 (2)',
    url: 'http://10.0.0.2:3001',
    description: '系统与服务监控可视化（备用）',
    notes: '请联系管理员获取凭据',
    icon: 'DataAnalysis',
    category: '监控',
    status: 'online'
  },
  {
    id: 4,
    name: '网络运维工具箱',
    url: 'http://10.0.0.2:5000',
    description: '网络运维常用工具集合',
    notes: '请联系管理员获取凭据',
    icon: 'SetUp',
    category: '基础设施',
    status: 'online'
  },
  {
    id: 5,
    name: 'OpenClaw WEB UI',
    url: 'http://10.0.0.3:3001',
    description: 'OpenClaw 管理界面',
    notes: '请联系管理员获取凭据',
    icon: 'Connection',
    category: 'DevOps',
    status: 'online'
  },
  {
    id: 6,
    name: 'Gitea 代码仓库',
    url: 'http://10.0.0.4:3000',
    description: 'Git 代码托管（Docker 容器）',
    notes: '请联系管理员获取凭据',
    icon: 'FolderOpened',
    category: 'DevOps',
    status: 'online'
  }
]
