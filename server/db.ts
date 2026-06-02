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

  CREATE TABLE IF NOT EXISTS racks (
    id         VARCHAR(50) PRIMARY KEY,
    name       VARCHAR(50) NOT NULL,
    floor      VARCHAR(10) NOT NULL,
    total_u    INT         NOT NULL DEFAULT 42,
    created_at TEXT        NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT        NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_racks_floor ON racks (floor);

  CREATE TABLE IF NOT EXISTS devices (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       VARCHAR(50)  NOT NULL,
    type       VARCHAR(20)  NOT NULL,
    model      VARCHAR(100) NOT NULL,
    u          INT          NOT NULL DEFAULT 1,
    ports      INT          NOT NULL DEFAULT 0,
    status     VARCHAR(10)  NOT NULL DEFAULT '正常',
    ip         VARCHAR(45),
    created_at TEXT         NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT         NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_devices_type   ON devices (type);
  CREATE INDEX IF NOT EXISTS idx_devices_status ON devices (status);

  CREATE TABLE IF NOT EXISTS rack_slots (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    rack_id   VARCHAR(50) NOT NULL REFERENCES racks(id) ON DELETE CASCADE,
    device_id INTEGER     REFERENCES devices(id) ON DELETE SET NULL,
    u_offset  INT         NOT NULL,
    u_size    INT         NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_rack_slots_rack   ON rack_slots (rack_id);
  CREATE INDEX IF NOT EXISTS idx_rack_slots_device ON rack_slots (device_id);
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
  console.log(`[db] 已初始化 ${seeds.length} 条服务 mock 数据`)
}

// 设备 mock 数据初始化
const rackCount = db.prepare('SELECT COUNT(*) as cnt FROM racks').get() as { cnt: number }
if (rackCount.cnt === 0) {
  // 机柜
  const insertRack = db.prepare('INSERT INTO racks (id, name, floor, total_u) VALUES (?, ?, ?, ?)')
  // 设备
  const insertDevice = db.prepare(`
    INSERT INTO devices (id, name, type, model, u, ports, status, ip)
    VALUES (@id, @name, @type, @model, @u, @ports, @status, @ip)
  `)
  // U位
  const insertSlot = db.prepare('INSERT INTO rack_slots (rack_id, device_id, u_offset, u_size) VALUES (?, ?, ?, ?)')

  const seedDevices = db.transaction(() => {
    // 机柜数据
    const racks = [
      { id: 'rack-a1', name: '机柜 A', floor: '-1F', totalU: 42 },
      { id: 'rack-b1', name: '机柜 B', floor: '-1F', totalU: 42 },
      { id: 'rack-a2', name: '机柜 A', floor: '1F', totalU: 12 },
      { id: 'rack-b2', name: '机柜 B', floor: '1F', totalU: 42 },
    ]
    for (const r of racks) insertRack.run(r.id, r.name, r.floor, r.totalU)

    // 设备数据
    const devices = [
      { id: 1, name: 'PDU-A1', type: 'pdu', model: 'APC 3kW', u: 1, ports: 0, status: '正常', ip: null },
      { id: 2, name: 'PDU-A2', type: 'pdu', model: 'APC 3kW', u: 1, ports: 0, status: '正常', ip: null },
      { id: 3, name: 'Core-SW-01', type: 'switch', model: 'S6730-H48X6C', u: 1, ports: 48, status: '正常', ip: '10.0.0.1' },
      { id: 4, name: 'Core-SW-02', type: 'switch', model: 'S6730-H48X6C', u: 1, ports: 48, status: '正常', ip: '10.0.0.2' },
      { id: 5, name: 'ESXi-01', type: 'server', model: 'Dell R750', u: 2, ports: 4, status: '正常', ip: '10.0.1.10' },
      { id: 6, name: 'ESXi-02', type: 'server', model: 'Dell R750', u: 2, ports: 4, status: '正常', ip: '10.0.1.11' },
      { id: 7, name: 'DB-Master', type: 'server', model: 'Dell R750xa', u: 2, ports: 4, status: '正常', ip: '10.0.1.20' },
      { id: 8, name: 'DB-Slave', type: 'server', model: 'Dell R750xa', u: 2, ports: 4, status: '正常', ip: '10.0.1.21' },
      { id: 9, name: 'SAN-01', type: 'storage', model: 'OceanStor 5310', u: 3, ports: 8, status: '正常', ip: '10.0.2.10' },
      { id: 10, name: 'App-01', type: 'server', model: 'Dell R650', u: 1, ports: 4, status: '正常', ip: '10.0.1.30' },
      { id: 11, name: 'App-02', type: 'server', model: 'Dell R650', u: 1, ports: 4, status: '正常', ip: '10.0.1.31' },
      { id: 12, name: 'App-03', type: 'server', model: 'Dell R650', u: 1, ports: 4, status: '正常', ip: '10.0.1.32' },
      { id: 13, name: 'App-04', type: 'server', model: 'Dell R650', u: 1, ports: 4, status: '正常', ip: '10.0.1.33' },
      { id: 14, name: 'FW-01', type: 'firewall', model: 'FG-100F', u: 1, ports: 16, status: '正常', ip: '10.0.0.10' },
      { id: 15, name: 'FW-02', type: 'firewall', model: 'FG-100F', u: 1, ports: 16, status: '正常', ip: '10.0.0.11' },
      { id: 16, name: 'Router-01', type: 'router', model: 'NE8000', u: 2, ports: 8, status: '正常', ip: '10.0.0.100' },
      { id: 17, name: 'UPS-A', type: 'ups', model: 'SANTAK 20KVA', u: 3, ports: 0, status: '正常', ip: null },
      { id: 18, name: 'PDU-B1', type: 'pdu', model: 'APC 5kW', u: 1, ports: 0, status: '正常', ip: null },
      { id: 19, name: 'PDU-B2', type: 'pdu', model: 'APC 5kW', u: 1, ports: 0, status: '正常', ip: null },
      { id: 20, name: 'Core-Router', type: 'router', model: 'NE40E', u: 2, ports: 16, status: '正常', ip: '10.0.0.254' },
      { id: 21, name: 'Agg-SW-01', type: 'switch', model: 'S5735-L48P4X', u: 1, ports: 48, status: '正常', ip: '10.0.0.11' },
      { id: 22, name: 'Agg-SW-02', type: 'switch', model: 'S5735-L48P4X', u: 1, ports: 48, status: '正常', ip: '10.0.0.12' },
      { id: 23, name: 'Agg-SW-03', type: 'switch', model: 'S5735-L48P4X', u: 1, ports: 48, status: '正常', ip: '10.0.0.13' },
      { id: 24, name: 'FW-DMZ', type: 'firewall', model: 'FG-200F', u: 1, ports: 16, status: '正常', ip: '10.0.0.20' },
      { id: 25, name: 'FW-INT', type: 'firewall', model: 'FG-200F', u: 1, ports: 16, status: '正常', ip: '10.0.0.21' },
      { id: 26, name: 'TOR-SW-01', type: 'switch', model: 'S5735-L24P4X', u: 1, ports: 24, status: '正常', ip: '10.0.0.31' },
      { id: 27, name: 'TOR-SW-02', type: 'switch', model: 'S5735-L24P4X', u: 1, ports: 24, status: '正常', ip: '10.0.0.32' },
      { id: 28, name: 'TOR-SW-03', type: 'switch', model: 'S5735-L24P4X', u: 1, ports: 24, status: '正常', ip: '10.0.0.33' },
      { id: 29, name: 'TOR-SW-04', type: 'switch', model: 'S5735-L24P4X', u: 1, ports: 24, status: '正常', ip: '10.0.0.34' },
      { id: 30, name: 'UPS-B', type: 'ups', model: 'SANTAK 30KVA', u: 3, ports: 0, status: '正常', ip: null },
      { id: 31, name: 'Web-01', type: 'server', model: 'Dell R650', u: 1, ports: 4, status: '正常', ip: null },
      { id: 32, name: 'Web-02', type: 'server', model: 'Dell R650', u: 1, ports: 4, status: '正常', ip: null },
      { id: 33, name: 'Dev-01', type: 'server', model: 'Dell R650', u: 1, ports: 4, status: '正常', ip: null },
      { id: 34, name: 'Dev-02', type: 'server', model: 'Dell R650', u: 1, ports: 4, status: '正常', ip: null },
    ]
    for (const d of devices) insertDevice.run(d)

    // rack-a1 布局：按 mock 数据顺序填充
    const rackA1Layout = [
      { devId: 1, u: 1 }, { devId: 2, u: 1 }, null,
      { devId: 3, u: 1 }, { devId: 4, u: 1 }, null,
      { devId: 5, u: 2 }, { devId: 6, u: 2 }, null, null,
      { devId: 7, u: 2 }, { devId: 8, u: 2 }, null,
      { devId: 9, u: 3 }, null, null, null, null, null, null,
      { devId: 10, u: 1 }, { devId: 11, u: 1 }, { devId: 12, u: 1 }, { devId: 13, u: 1 },
      null, null,
      { devId: 14, u: 1 }, { devId: 15, u: 1 }, null,
      { devId: 16, u: 2 }, null, null, null, null, null, null, null,
      { devId: 17, u: 3 },
    ]
    let offset = 0
    for (const item of rackA1Layout) {
      if (item) {
        insertSlot.run('rack-a1', item.devId, offset, item.u)
      }
      offset += item ? item.u : 1
    }

    // rack-b1 布局
    const rackB1Layout = [
      { devId: 18, u: 1 }, { devId: 19, u: 1 }, null, null,
      { devId: 20, u: 2 }, null,
      { devId: 21, u: 1 }, { devId: 22, u: 1 }, { devId: 23, u: 1 },
      null, null,
      { devId: 24, u: 1 }, { devId: 25, u: 1 }, null,
      { devId: 26, u: 1 }, { devId: 27, u: 1 }, { devId: 28, u: 1 }, { devId: 29, u: 1 },
      null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
      { devId: 30, u: 3 },
    ]
    offset = 0
    for (const item of rackB1Layout) {
      if (item) {
        insertSlot.run('rack-b1', item.devId, offset, item.u)
      }
      offset += item ? item.u : 1
    }

    // rack-a2 布局
    insertSlot.run('rack-a2', 31, 0, 1)
    insertSlot.run('rack-a2', 32, 2, 1)

    // rack-b2 布局
    insertSlot.run('rack-b2', 33, 0, 1)
    insertSlot.run('rack-b2', 34, 1, 1)

    console.log(`[db] 已初始化 ${racks.length} 个机柜, ${devices.length} 个设备`)
  })

  seedDevices()
}

export default db
