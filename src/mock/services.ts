export interface Service {
  id: number
  name: string
  url: string
  description: string
  notes?: string
  icon: string
  category: string
  status: 'online' | 'offline' | 'maintenance' | 'checking'
}

export const SERVICE_CATEGORIES = ['DevOps', '监控', '基础设施', '协作'] as const

export const mockServices: Service[] = [
  {
    id: 1,
    name: 'Zabbix 监控',
    url: 'http://10.3.0.142/zabbix',
    description: '企业级 IT 监控平台',
    notes: '用户名: Admin\n密码: zabbix',
    icon: 'Monitor',
    category: '监控',
    status: 'online'
  },
  {
    id: 2,
    name: 'Grafana 监控 (142)',
    url: 'http://10.3.0.142:3000',
    description: '系统与服务监控可视化',
    notes: '用户名: admin\n密码: admin123',
    icon: 'DataAnalysis',
    category: '监控',
    status: 'online'
  },
  {
    id: 3,
    name: 'Grafana 监控 (143)',
    url: 'http://10.3.0.143:3001',
    description: '系统与服务监控可视化（备用）',
    notes: '用户名: admin\n密码: admin123',
    icon: 'DataAnalysis',
    category: '监控',
    status: 'online'
  },
  {
    id: 4,
    name: '网络运维工具箱',
    url: 'http://10.3.0.143:5000',
    description: '网络运维常用工具集合',
    notes: '用户名: admin\n密码: admin123',
    icon: 'SetUp',
    category: '基础设施',
    status: 'online'
  },
  {
    id: 5,
    name: 'OpenClaw WEB UI',
    url: 'http://10.3.0.144:3001',
    description: 'OpenClaw 管理界面',
    notes: '用户名: admin\n密码: admin123',
    icon: 'Connection',
    category: 'DevOps',
    status: 'online'
  },
  {
    id: 6,
    name: 'Gitea 代码仓库',
    url: 'http://10.3.0.145:3000',
    description: 'Git 代码托管（Docker 容器）',
    notes: '用户名: admin\n密码: Bravou#*604896',
    icon: 'FolderOpened',
    category: 'DevOps',
    status: 'online'
  }
]
