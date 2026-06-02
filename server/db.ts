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
    { name: 'Zabbix 监控', url: 'http://10.3.0.142/zabbix', description: '企业级 IT 监控平台', notes: '用户名: Admin\n密码: zabbix', icon: 'Monitor', category: '监控', status: 'online' },
    { name: 'Grafana 监控 (142)', url: 'http://10.3.0.142:3000', description: '系统与服务监控可视化', notes: '用户名: admin\n密码: admin123', icon: 'DataAnalysis', category: '监控', status: 'online' },
    { name: 'Grafana 监控 (143)', url: 'http://10.3.0.143:3001', description: '系统与服务监控可视化（备用）', notes: '用户名: admin\n密码: admin123', icon: 'DataAnalysis', category: '监控', status: 'online' },
    { name: '网络运维工具箱', url: 'http://10.3.0.143:5000', description: '网络运维常用工具集合', notes: '用户名: admin\n密码: admin123', icon: 'SetUp', category: '基础设施', status: 'online' },
    { name: 'OpenClaw WEB UI', url: 'http://10.3.0.144:3001', description: 'OpenClaw 管理界面', notes: '用户名: admin\n密码: admin123', icon: 'Connection', category: 'DevOps', status: 'online' },
    { name: 'Gitea 代码仓库', url: 'http://10.3.0.145:3000', description: 'Git 代码托管（Docker 容器）', notes: '用户名: admin\n密码: Bravou#*604896', icon: 'FolderOpened', category: 'DevOps', status: 'online' },
  ]

  const insertMany = db.transaction((rows: typeof seeds) => {
    for (const row of rows) insert.run(row)
  })
  insertMany(seeds)
  console.log(`[db] 已初始化 ${seeds.length} 条 mock 数据`)
}

export default db
