export interface Ticket {
  id: number
  title: string
  content: string
  creator: string
  createTime: string
  status: string
  currentStep: number
  steps: string[]
}

export const mockTickets: Ticket[] = [
  { id: 1, title: '生产环境 Nginx 配置更新', content: '更新 Nginx upstream 配置，新增两台后端服务器节点', creator: '张工', createTime: '2025-01-15 14:30', status: '已完成', currentStep: 5, steps: ['发起', '审批', '执行', '验收', '完成'] },
  { id: 2, title: '数据库主从切换演练', content: 'MySQL 主库计划性切换至备库，验证故障转移流程', creator: '李工', createTime: '2025-01-16 09:00', status: '进行中', currentStep: 2, steps: ['发起', '审批', '执行', '验收', '完成'] },
  { id: 3, title: '应用服务版本回滚', content: 'v3.2.1 版本发现内存泄漏问题，回滚至 v3.2.0', creator: '王工', createTime: '2025-01-16 16:45', status: '审批中', currentStep: 1, steps: ['发起', '审批', '执行', '验收', '完成'] },
  { id: 4, title: 'SSL 证书续期更新', content: 'api.example.com 域名证书将于月底过期，提前续期更换', creator: '赵工', createTime: '2025-01-14 11:20', status: '已完成', currentStep: 5, steps: ['发起', '审批', '执行', '验收', '完成'] }
]
