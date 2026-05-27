export interface Service {
  id: number
  name: string
  url: string
  description: string
  icon: string
  category: string
  status: 'online' | 'offline' | 'maintenance' | 'checking'
}

export const SERVICE_CATEGORIES = ['DevOps', '监控', '基础设施', '协作'] as const

export const mockServices: Service[] = [
  {
    id: 1,
    name: 'Jenkins CI/CD',
    url: 'http://192.168.1.100:8080',
    description: '持续集成与持续部署平台',
    icon: 'Setting',
    category: 'DevOps',
    status: 'online'
  },
  {
    id: 2,
    name: 'GitLab 代码仓库',
    url: 'http://192.168.1.100:8888',
    description: '内部代码托管与版本管理',
    icon: 'FolderOpened',
    category: 'DevOps',
    status: 'online'
  },
  {
    id: 3,
    name: 'Nexus 制品库',
    url: 'http://192.168.1.101:8081',
    description: 'Maven/NPM/Docker 制品仓库',
    icon: 'Box',
    category: 'DevOps',
    status: 'online'
  },
  {
    id: 4,
    name: 'K8s Dashboard',
    url: 'http://192.168.1.102:30000',
    description: 'Kubernetes 集群管理面板',
    icon: 'Odometer',
    category: '基础设施',
    status: 'online'
  },
  {
    id: 5,
    name: 'Grafana 监控',
    url: 'http://192.168.1.103:3000',
    description: '系统与服务监控可视化',
    icon: 'DataAnalysis',
    category: '监控',
    status: 'online'
  },
  {
    id: 6,
    name: 'ELK 日志平台',
    url: 'http://192.168.1.104:5601',
    description: 'Elasticsearch + Logstash + Kibana',
    icon: 'Document',
    category: '监控',
    status: 'offline'
  },
  {
    id: 7,
    name: 'Confluence 知识库',
    url: 'http://192.168.1.105:8090',
    description: '团队文档与知识管理',
    icon: 'Reading',
    category: '协作',
    status: 'online'
  },
  {
    id: 8,
    name: 'YApi 接口管理',
    url: 'http://192.168.1.106:3000',
    description: 'API 文档与 Mock 平台',
    icon: 'Connection',
    category: 'DevOps',
    status: 'maintenance'
  }
]
