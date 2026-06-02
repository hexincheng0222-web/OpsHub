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
    host_id     INTEGER REFERENCES service_hosts(id) ON DELETE SET NULL,
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

  /* ========== 字典表 ========== */

  CREATE TABLE IF NOT EXISTS device_floors (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL UNIQUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS device_types (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    key        TEXT NOT NULL UNIQUE,
    name       TEXT NOT NULL,
    abbr       TEXT NOT NULL DEFAULT '',
    icon       TEXT NOT NULL DEFAULT '',
    color      TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS device_models (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT NOT NULL UNIQUE,
    type_key     TEXT NOT NULL DEFAULT '',
    manufacturer TEXT NOT NULL DEFAULT '',
    u_size       INTEGER NOT NULL DEFAULT 1,
    ports        INTEGER NOT NULL DEFAULT 0,
    power_watts  INTEGER NOT NULL DEFAULT 0,
    description  TEXT NOT NULL DEFAULT '',
    sort_order   INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS printer_brands (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL UNIQUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS printer_models (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    brand_id   INTEGER NOT NULL REFERENCES printer_brands(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    CONSTRAINT uq_printer_models UNIQUE (brand_id, name)
  );
  CREATE INDEX IF NOT EXISTS idx_printer_models_brand ON printer_models (brand_id);

  CREATE TABLE IF NOT EXISTS toner_models (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL UNIQUE,
    compatible TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS service_categories (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL UNIQUE,
    icon       TEXT NOT NULL DEFAULT '',
    color      TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS service_hosts (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL UNIQUE,
    ip         TEXT NOT NULL DEFAULT '',
    os         TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS operation_logs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    module     TEXT NOT NULL,
    action     TEXT NOT NULL,
    target     TEXT NOT NULL DEFAULT '',
    detail     TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_operation_logs_module ON operation_logs (module);
  CREATE INDEX IF NOT EXISTS idx_operation_logs_created ON operation_logs (created_at);
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

// 迁移：device_types 表添加 key 列
const dtColumns = db.prepare("PRAGMA table_info(device_types)").all() as { name: string }[]
if (dtColumns.length > 0 && !dtColumns.some(c => c.name === 'key')) {
  db.exec('DROP TABLE IF EXISTS device_types')
  db.exec(`
    CREATE TABLE device_types (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      key        TEXT NOT NULL UNIQUE,
      name       TEXT NOT NULL,
      abbr       TEXT NOT NULL DEFAULT '',
      icon       TEXT NOT NULL DEFAULT '',
      color      TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)
  console.log('[db] 已重建 device_types 表（添加 key 列）')
}

// 迁移：device_types 表添加 abbr 列
const dtCols2 = db.prepare("PRAGMA table_info(device_types)").all() as { name: string }[]
if (dtCols2.length > 0 && !dtCols2.some(c => c.name === 'abbr')) {
  db.exec("ALTER TABLE device_types ADD COLUMN abbr TEXT NOT NULL DEFAULT ''")
  console.log('[db] 已添加 device_types.abbr 列')
}
// 回填 abbr（幂等）
const abbrMap: [string, string][] = [
  ['server', 'SV'], ['switch', 'SW'], ['storage', 'ST'],
  ['router', 'RT'], ['firewall', 'FW'], ['ups', 'UP'], ['pdu', 'PD'],
]
const updateAbbr = db.prepare("UPDATE device_types SET abbr = ? WHERE key = ? AND (abbr IS NULL OR abbr = '')")
const batchUpdateAbbr = db.transaction(() => {
  for (const [key, abbr] of abbrMap) updateAbbr.run(abbr, key)
})
batchUpdateAbbr()

// 迁移：services 表添加 host_id 列
const svcColumns = db.prepare("PRAGMA table_info(services)").all() as { name: string }[]
if (svcColumns.length > 0 && !svcColumns.some(c => c.name === 'host_id')) {
  db.exec("ALTER TABLE services ADD COLUMN host_id INTEGER REFERENCES service_hosts(id) ON DELETE SET NULL")
  console.log('[db] 已添加 services.host_id 列')
}
// 回填 services 的 host_id（将服务分配到主机）
const hostAssignMap: [string, string][] = [
  ['Zabbix 监控', 'ESXi-01'],
  ['Grafana 监控 (142)', 'ESXi-01'],
  ['Grafana 监控 (143)', 'ESXi-02'],
  ['网络运维工具箱', 'App-02'],
  ['OpenClaw WEB UI', 'App-01'],
  ['Gitea 代码仓库', 'App-01'],
]
const updateHostId = db.prepare("UPDATE services SET host_id = (SELECT id FROM service_hosts WHERE name = ?) WHERE name = ? AND (host_id IS NULL)")
const batchUpdateHost = db.transaction(() => {
  for (const [svcName, hostName] of hostAssignMap) updateHostId.run(hostName, svcName)
})
batchUpdateHost()

// 迁移：device_models 表添加 type_key 列
const dmColumns = db.prepare("PRAGMA table_info(device_models)").all() as { name: string }[]
if (dmColumns.length > 0 && !dmColumns.some(c => c.name === 'type_key')) {
  db.exec("ALTER TABLE device_models ADD COLUMN type_key TEXT NOT NULL DEFAULT ''")
  console.log('[db] 已添加 device_models.type_key 列')
}
// 回填 type_key（幂等，已填充的行不受影响）
const typeKeyMap: [string, string][] = [
  ['Dell R750', 'server'], ['Dell R750xa', 'server'], ['Dell R650', 'server'],
  ['S6730-H48X6C', 'switch'], ['S5735-L48P4X', 'switch'], ['S5735-L24P4X', 'switch'],
  ['NE8000', 'router'], ['NE40E', 'router'],
  ['FG-100F', 'firewall'], ['FG-200F', 'firewall'],
  ['OceanStor 5310', 'storage'],
  ['SANTAK 20KVA', 'ups'], ['SANTAK 30KVA', 'ups'],
  ['APC 3kW', 'pdu'], ['APC 5kW', 'pdu'],
]
const updateTypeKey = db.prepare("UPDATE device_models SET type_key = ? WHERE name = ? AND (type_key IS NULL OR type_key = '')")
const batchUpdateTK = db.transaction(() => {
  for (const [name, key] of typeKeyMap) updateTypeKey.run(key, name)
})
batchUpdateTK()

// 字典数据初始化
const floorCount = db.prepare('SELECT COUNT(*) as cnt FROM device_floors').get() as { cnt: number }
if (floorCount.cnt === 0) {
  const seedDicts = db.transaction(() => {
    // 楼层
    const insertFloor = db.prepare('INSERT INTO device_floors (name, sort_order) VALUES (?, ?)')
    const floors = ['-1F', '1F', '2F', '3F', '4F']
    floors.forEach((f, i) => insertFloor.run(f, i))

    // 设备类型
    const insertType = db.prepare('INSERT INTO device_types (key, name, abbr, icon, color, sort_order) VALUES (?, ?, ?, ?, ?, ?)')
    const types: [string, string, string, string, string, number][] = [
      ['server', '服务器', 'SV', 'Monitor', '#3fb950', 0],
      ['switch', '交换机', 'SW', 'Connection', '#58a6ff', 1],
      ['storage', '存储', 'ST', 'Coin', '#a371f7', 2],
      ['router', '路由器', 'RT', 'Share', '#d29922', 3],
      ['firewall', '防火墙', 'FW', 'Shield', '#f85149', 4],
      ['ups', 'UPS', 'UP', 'Lightning', '#e06c75', 5],
      ['pdu', 'PDU', 'PD', 'Plug', '#6e7681', 6],
    ]
    types.forEach(t => insertType.run(...t))

    // 设备型号
    const insertModel = db.prepare('INSERT INTO device_models (name, type_key, manufacturer, u_size, ports, power_watts, description, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    const models: [string, string, string, number, number, number, string, number][] = [
      ['Dell R750', 'server', 'Dell', 2, 4, 750, '2U 双路机架服务器', 0],
      ['Dell R750xa', 'server', 'Dell', 2, 4, 900, '2U 四路机架服务器', 1],
      ['Dell R650', 'server', 'Dell', 1, 4, 600, '1U 双路机架服务器', 2],
      ['S6730-H48X6C', 'switch', '华为', 1, 48, 150, '万兆核心交换机', 3],
      ['S5735-L48P4X', 'switch', '华为', 1, 48, 100, '千兆汇聚交换机', 4],
      ['S5735-L24P4X', 'switch', '华为', 1, 24, 80, '千兆接入交换机', 5],
      ['NE8000', 'router', '华为', 2, 8, 200, '核心路由器', 6],
      ['NE40E', 'router', '华为', 2, 16, 300, '汇聚路由器', 7],
      ['FG-100F', 'firewall', 'Fortinet', 1, 16, 100, '下一代防火墙', 8],
      ['FG-200F', 'firewall', 'Fortinet', 1, 16, 150, '下一代防火墙（高性能）', 9],
      ['OceanStor 5310', 'storage', '华为', 3, 8, 500, '统一存储系统', 10],
      ['SANTAK 20KVA', 'ups', '山特', 3, 0, 0, '在线式 UPS 20KVA', 11],
      ['SANTAK 30KVA', 'ups', '山特', 3, 0, 0, '在线式 UPS 30KVA', 12],
      ['APC 3kW', 'pdu', 'APC', 1, 0, 0, 'PDU 配电单元 3kW', 13],
      ['APC 5kW', 'pdu', 'APC', 1, 0, 0, 'PDU 配电单元 5kW', 14],
    ]
    models.forEach(m => insertModel.run(...m))

    // 打印机品牌
    const insertBrand = db.prepare('INSERT INTO printer_brands (name, sort_order) VALUES (?, ?)')
    const brands = ['HP', 'Canon', 'Epson', 'Brother', 'Xerox']
    brands.forEach((b, i) => insertBrand.run(b, i))

    // 打印机型号（获取品牌 ID）
    const insertPModel = db.prepare('INSERT INTO printer_models (brand_id, name, sort_order) VALUES (?, ?, ?)')
    const hpId = (db.prepare('SELECT id FROM printer_brands WHERE name = ?').get('HP') as { id: number }).id
    const canonId = (db.prepare('SELECT id FROM printer_brands WHERE name = ?').get('Canon') as { id: number }).id
    const epsonId = (db.prepare('SELECT id FROM printer_brands WHERE name = ?').get('Epson') as { id: number }).id
    const pm: [number, string, number][] = [
      [hpId, 'LaserJet Pro M404dn', 0],
      [hpId, 'LaserJet MFP M430f', 1],
      [hpId, 'Color LaserJet Pro M454dw', 2],
      [canonId, 'imageRUNNER C3326i', 0],
      [canonId, 'imageCLASS MF746Cx', 1],
      [epsonId, 'WorkForce Pro WF-C5790', 0],
    ]
    pm.forEach(m => insertPModel.run(...m))

    // 墨粉型号
    const insertToner = db.prepare('INSERT INTO toner_models (name, compatible, sort_order) VALUES (?, ?, ?)')
    const toners: [string, string, number][] = [
      ['HP 59A', 'HP LaserJet Pro M404dn', 0],
      ['HP 59X', 'HP LaserJet Pro M404dn, HP LaserJet MFP M430f', 1],
      ['HP 207A', 'HP Color LaserJet Pro M454dw', 2],
      ['Canon C-EXV 55', 'Canon imageRUNNER C3326i', 3],
      ['Canon 055', 'Canon imageCLASS MF746Cx', 4],
    ]
    toners.forEach(t => insertToner.run(...t))

    // 服务分类
    const insertCat = db.prepare('INSERT INTO service_categories (name, icon, color, sort_order) VALUES (?, ?, ?, ?)')
    const cats: [string, string, string, number][] = [
      ['DevOps', 'SetUp', '#58a6ff', 0],
      ['监控', 'DataAnalysis', '#3fb950', 1],
      ['基础设施', 'Server', '#a371f7', 2],
      ['协作', 'ChatDotRound', '#d29922', 3],
    ]
    cats.forEach(c => insertCat.run(...c))

    console.log('[db] 已初始化字典数据')
  })
  seedDicts()
}

// 服务主机数据初始化（独立于主字典种子）
const hostCount = db.prepare('SELECT COUNT(*) as cnt FROM service_hosts').get() as { cnt: number }
if (hostCount.cnt === 0) {
  const insertHost = db.prepare('INSERT INTO service_hosts (name, ip, os, description, sort_order) VALUES (?, ?, ?, ?, ?)')
  const hosts: [string, string, string, string, number][] = [
    ['ESXi-01', '10.0.1.10', 'VMware ESXi 7.0', '主虚拟化宿主机，运行 Zabbix、Grafana 等监控服务', 0],
    ['ESXi-02', '10.0.1.11', 'VMware ESXi 7.0', '备用虚拟化宿主机，运行开发测试环境', 1],
    ['App-01', '10.0.1.30', 'CentOS 7.9', '应用服务器，部署 Gitea、OpenClaw 等 DevOps 工具', 2],
    ['App-02', '10.0.1.31', 'CentOS 7.9', '应用服务器，部署运维工具箱和内部 Web 服务', 3],
  ]
  const seedHosts = db.transaction(() => { hosts.forEach(h => insertHost.run(...h)) })
  seedHosts()
  console.log(`[db] 已初始化 ${hosts.length} 条服务主机数据`)
}

export default db
