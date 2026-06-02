import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DB_PATH = path.resolve(__dirname, '../data/opshub.db')
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })

const db = new Database(DB_PATH)

// 开启 WAL 模式（更好的并发性能）
db.pragma('journal_mode = WAL')

// 建表
db.exec(`
  CREATE TABLE IF NOT EXISTS services (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    url         TEXT    NOT NULL,
    description TEXT    NOT NULL DEFAULT '',
    notes       TEXT    NOT NULL DEFAULT '',
    icon        TEXT    NOT NULL DEFAULT 'Setting',
    category    TEXT    NOT NULL,
    status      TEXT    NOT NULL DEFAULT 'online',
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),

    CONSTRAINT uq_services_name UNIQUE (name),
    CONSTRAINT uq_services_url  UNIQUE (url)
  );

  CREATE INDEX IF NOT EXISTS idx_services_category ON services (category);
  CREATE INDEX IF NOT EXISTS idx_services_status   ON services (status);
`)

// 如果表为空，插入 mock 数据
const count = db.prepare('SELECT COUNT(*) as cnt FROM services').get() as { cnt: number }
if (count.cnt === 0) {
  const insert = db.prepare(`
    INSERT INTO services (name, url, description, notes, icon, category, status)
    VALUES (@name, @url, @description, @notes, @icon, @category, @status)
  `)

  const seeds = [
    { name: 'Jenkins CI/CD', url: 'http://192.168.1.100:8080', description: '持续集成与持续部署平台', notes: '', icon: 'Setting', category: 'DevOps', status: 'online' },
    { name: 'GitLab 代码仓库', url: 'http://192.168.1.100:8888', description: '内部代码托管与版本管理', notes: '', icon: 'FolderOpened', category: 'DevOps', status: 'online' },
    { name: 'Nexus 制品库', url: 'http://192.168.1.101:8081', description: 'Maven/NPM/Docker 制品仓库', notes: '', icon: 'Box', category: 'DevOps', status: 'online' },
    { name: 'K8s Dashboard', url: 'http://192.168.1.102:30000', description: 'Kubernetes 集群管理面板', notes: '', icon: 'Odometer', category: '基础设施', status: 'online' },
    { name: 'Grafana 监控', url: 'http://192.168.1.103:3000', description: '系统与服务监控可视化', notes: '', icon: 'DataAnalysis', category: '监控', status: 'online' },
    { name: 'ELK 日志平台', url: 'http://192.168.1.104:5601', description: 'Elasticsearch + Logstash + Kibana', notes: '', icon: 'Document', category: '监控', status: 'offline' },
    { name: 'Confluence 知识库', url: 'http://192.168.1.105:8090', description: '团队文档与知识管理', notes: '', icon: 'Reading', category: '协作', status: 'online' },
    { name: 'YApi 接口管理', url: 'http://192.168.1.106:3000', description: 'API 文档与 Mock 平台', notes: '', icon: 'Connection', category: 'DevOps', status: 'maintenance' },
  ]

  const insertMany = db.transaction((rows: typeof seeds) => {
    for (const row of rows) insert.run(row)
  })
  insertMany(seeds)
  console.log(`[db] 已初始化 ${seeds.length} 条 mock 数据`)
}

export default db
