import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import bcrypt from 'bcryptjs'
import cron from 'node-cron'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 优先使用环境变量，回退到默认路径
const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.resolve(__dirname, '../data/opshub.db')
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
    brand_id   INTEGER REFERENCES printer_brands(id) ON DELETE SET NULL,
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

  CREATE TABLE IF NOT EXISTS printer_floors (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL UNIQUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS printers (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    floor         VARCHAR(16)  NOT NULL DEFAULT '',
    location      VARCHAR(255) NOT NULL DEFAULT '',
    manufacturer  VARCHAR(64)  NOT NULL DEFAULT '',
    model         VARCHAR(128) NOT NULL DEFAULT '',
    toner_model   VARCHAR(128) NOT NULL DEFAULT '',
    notes         TEXT         NOT NULL DEFAULT '',
    status        VARCHAR(16)  NOT NULL DEFAULT '正常',
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS manual_folders (
    id         VARCHAR(64) PRIMARY KEY,
    name       VARCHAR(128) NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS manual_docs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      VARCHAR(255) NOT NULL,
    content    TEXT NOT NULL DEFAULT '',
    folder_id  VARCHAR(64) NOT NULL REFERENCES manual_folders(id) ON DELETE CASCADE,
    author     VARCHAR(64) NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_manual_docs_folder ON manual_docs (folder_id);

  CREATE TABLE IF NOT EXISTS manual_doc_versions (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    doc_id         INTEGER NOT NULL REFERENCES manual_docs(id) ON DELETE CASCADE,
    title          TEXT    NOT NULL,
    content        TEXT    NOT NULL,
    version_number INTEGER NOT NULL,
    author         TEXT    NOT NULL DEFAULT '',
    created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_mdv_doc ON manual_doc_versions (doc_id, version_number);

  -- 文档收藏表（按用户隔离，支持跨设备同步）
  CREATE TABLE IF NOT EXISTS manual_favorites (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    doc_id     INTEGER NOT NULL REFERENCES manual_docs(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, doc_id)
  );
  CREATE INDEX IF NOT EXISTS idx_mf_user ON manual_favorites (user_id);
  CREATE INDEX IF NOT EXISTS idx_mf_doc ON manual_favorites (doc_id);

  CREATE TABLE IF NOT EXISTS computer_procurement (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    model            VARCHAR(128) NOT NULL DEFAULT '',
    department       VARCHAR(64)  NOT NULL DEFAULT '',
    applicant        VARCHAR(32)  NOT NULL DEFAULT '',
    mac_address      VARCHAR(32)  NOT NULL DEFAULT '',
    device_model     VARCHAR(128) NOT NULL DEFAULT '',
    ce_number        VARCHAR(32)  NOT NULL DEFAULT '',
    actual_user      VARCHAR(32)  NOT NULL DEFAULT '',
    approval_number  VARCHAR(64)  NOT NULL DEFAULT '',
    receive_date     VARCHAR(16)  NOT NULL DEFAULT '',
    asset_number     VARCHAR(32)  NOT NULL DEFAULT '',
    delivery_date    VARCHAR(16)  NOT NULL DEFAULT '',
    delivery_person  VARCHAR(32)  NOT NULL DEFAULT '',
    pickup_approval  VARCHAR(64)  NOT NULL DEFAULT '',
    ce_processed     INTEGER      NOT NULL DEFAULT 0,
    price            REAL         NOT NULL DEFAULT 0,
    created_at       TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS procurement_departments (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL UNIQUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS procurement_handlers (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL UNIQUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS phone_brands (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL UNIQUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS phone_models (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    brand_id   INTEGER NOT NULL REFERENCES phone_brands(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    CONSTRAINT uq_phone_models UNIQUE (brand_id, name)
  );

  CREATE TABLE IF NOT EXISTS computer_models (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL UNIQUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS phone_procurement (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_number     VARCHAR(32)  NOT NULL UNIQUE,
    part_no          VARCHAR(64)  NOT NULL DEFAULT '',
    serial_no        VARCHAR(64)  NOT NULL DEFAULT '',
    imei             VARCHAR(32)  NOT NULL DEFAULT '',
    arrival_date     VARCHAR(16)  NOT NULL DEFAULT '',
    pickup_date      VARCHAR(16)  NOT NULL DEFAULT '',
    brand            VARCHAR(32)  NOT NULL DEFAULT '',
    model            VARCHAR(128) NOT NULL DEFAULT '',
    asset_link       VARCHAR(32)  NOT NULL DEFAULT '',
    department       VARCHAR(64)  NOT NULL DEFAULT '',
    handler          VARCHAR(32)  NOT NULL DEFAULT '',
    recipient        VARCHAR(32)  NOT NULL DEFAULT '',
    dingtalk_creator VARCHAR(32)  NOT NULL DEFAULT '',
    purchase_type    VARCHAR(8)   NOT NULL DEFAULT '新购',
    dingtalk_flow    VARCHAR(64)  NOT NULL DEFAULT '',
    original_owner   VARCHAR(32)  NOT NULL DEFAULT '',
    notes            TEXT         NOT NULL DEFAULT '',
    created_at       TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
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

  // 迁移：operation_logs 扩展用户操作详情字段
  const olCols = db.prepare("PRAGMA table_info(operation_logs)").all() as { name: string }[]
  const olAdd = (col: string, def: string) => {
    if (!olCols.some(c => c.name === col)) {
      db.exec('ALTER TABLE operation_logs ADD COLUMN ' + col + ' NOT NULL DEFAULT ' + def)
    }
  }
  olAdd('operator', "''")
  olAdd('ip_address', "''")
  olAdd('user_agent', "''")
  olAdd('status', "'success'")
  olAdd('error_message', "''")
  olAdd('request_method', "''")
  olAdd('request_path', "''")
  olAdd('duration_ms', '0')

// phonebook / device_types rebuild / logMonitor / tokens
db.exec(`
  CREATE TABLE IF NOT EXISTS phonebook_contacts (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    number     TEXT NOT NULL,
    department TEXT NOT NULL DEFAULT '',
    position   TEXT NOT NULL DEFAULT '',
    type       TEXT NOT NULL DEFAULT 'internal',
    notes      TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    CONSTRAINT uq_phonebook UNIQUE (name, number)
  );

  CREATE TABLE IF NOT EXISTS phone_ip_history (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    phone_id   TEXT NOT NULL,
    extension  TEXT NOT NULL DEFAULT '',
    ip         TEXT NOT NULL DEFAULT '',
    mac        TEXT NOT NULL DEFAULT '',
    last_seen  TEXT NOT NULL DEFAULT (datetime('now')),
    CONSTRAINT uq_phone_id UNIQUE (phone_id)
  );

  CREATE TABLE IF NOT EXISTS phone_locations (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    extension  TEXT NOT NULL,
    location   TEXT NOT NULL DEFAULT '',
    notes      TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    CONSTRAINT uq_phone_locations_ext UNIQUE (extension)
  );

  CREATE TABLE IF NOT EXISTS phone_remarks (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    extension  TEXT NOT NULL UNIQUE,
    remark     TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS system_config (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS users (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    username     TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL DEFAULT '',
    role         TEXT NOT NULL DEFAULT 'user',
    is_active    INTEGER NOT NULL DEFAULT 1,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TEXT,
    last_login_at TEXT,
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)

// 兼容旧数据库：如果列不存在则添加
try { db.prepare('ALTER TABLE users ADD COLUMN failed_attempts INTEGER NOT NULL DEFAULT 0').run() } catch {}
try { db.prepare('ALTER TABLE users ADD COLUMN locked_until TEXT').run() } catch {}
// 采购表软删除字段（#29 回收站）
try { db.prepare('ALTER TABLE computer_procurement ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0').run() } catch {}
try { db.prepare('ALTER TABLE computer_procurement ADD COLUMN deleted_at TEXT').run() } catch {}
try { db.prepare('ALTER TABLE phone_procurement ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0').run() } catch {}
try { db.prepare('ALTER TABLE phone_procurement ADD COLUMN deleted_at TEXT').run() } catch {}

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

// 迁移：toner_models 表添加 brand_id 列
const tmColumns = db.prepare("PRAGMA table_info(toner_models)").all() as { name: string }[]
if (tmColumns.length > 0 && !tmColumns.some(c => c.name === 'brand_id')) {
  db.exec("ALTER TABLE toner_models ADD COLUMN brand_id INTEGER REFERENCES printer_brands(id) ON DELETE SET NULL")
  console.log('[db] 已添加 toner_models.brand_id 列')
}
// 回填 toner_models 的 brand_id
const tonerBrandMap: [string, string][] = [
  ['HP 59A', 'HP'], ['HP 59X', 'HP'], ['HP 207A', 'HP'],
  ['Canon C-EXV 55', 'Canon'], ['Canon 055', 'Canon'],
]
const updateTonerBrand = db.prepare("UPDATE toner_models SET brand_id = (SELECT id FROM printer_brands WHERE name = ?) WHERE name = ? AND (brand_id IS NULL)")
const batchUpdateTonerBrand = db.transaction(() => {
  for (const [toner, brand] of tonerBrandMap) updateTonerBrand.run(brand, toner)
})
batchUpdateTonerBrand()

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

// 迁移：computer_procurement 清理不需要的列
const cpColumns = db.prepare("PRAGMA table_info(computer_procurement)").all() as { name: string }[]
if (cpColumns.length > 0) {
  const dropCols = ['payment','channel','budget_dept','cost_center','new_user','high_consumable']
  for (const col of dropCols) {
    if (cpColumns.some(c => c.name === col)) {
      try {
        db.exec(`ALTER TABLE computer_procurement DROP COLUMN ${col}`)
        console.log(`[db] 已删除 computer_procurement.${col} 列`)
      } catch (e: any) {
        console.log(`[db] 跳过删除 ${col}: ${e.message}`)
      }
    }
  }
}

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
    const brands = ['HP', 'Canon', 'Epson', 'Brother', 'Samsung', 'Toshiba', 'Xerox']
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
    const insertToner = db.prepare('INSERT INTO toner_models (name, brand_id, compatible, sort_order) VALUES (?, ?, ?, ?)')
    const toners: [string, number, string, number][] = [
      ['HP 59A', hpId, 'HP LaserJet Pro M404dn', 0],
      ['HP 59X', hpId, 'HP LaserJet Pro M404dn, HP LaserJet MFP M430f', 1],
      ['HP 207A', hpId, 'HP Color LaserJet Pro M454dw', 2],
      ['Canon C-EXV 55', canonId, 'Canon imageRUNNER C3326i', 3],
      ['Canon 055', canonId, 'Canon imageCLASS MF746Cx', 4],
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

// 运维手册数据初始化
const folderCount = db.prepare('SELECT COUNT(*) as cnt FROM manual_folders').get() as { cnt: number }
if (folderCount.cnt === 0) {
  const seedManuals = db.transaction(() => {
    const insertFolder = db.prepare('INSERT INTO manual_folders (id, name, sort_order) VALUES (?, ?, ?)')
    const insertDoc = db.prepare('INSERT INTO manual_docs (id, title, content, folder_id, author, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')

    // 文件夹
    const folders: [string, string, number][] = [
      ['network', '网络运维', 0],
      ['server', '服务器运维', 1],
      ['database', '数据库运维', 2],
      ['security', '安全运维', 3],
      ['routine', '日常巡检', 4],
    ]
    folders.forEach(f => insertFolder.run(...f))

    // 文档
    const docs: [number, string, string, string, string, string, string][] = [
      [1, 'Nginx 反向代理配置手册', `# Nginx 反向代理配置手册

## 概述

Nginx 作为反向代理服务器，将客户端请求转发到后端服务。本文档涵盖生产环境常用配置。

## 基本配置

\`\`\`nginx
server {
    listen 80;
    server_name api.example.com;

    location / {
        proxy_pass http://backend:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
\`\`\`

## 负载均衡

\`\`\`nginx
upstream backend {
    server 10.0.1.10:3000 weight=3;
    server 10.0.1.11:3000 weight=2;
    server 10.0.1.12:3000 backup;
}
\`\`\`

## 注意事项

- **健康检查**：建议配合 upstream 模块的 \`health_check\` 使用
- **超时设置**：长连接建议 \`proxy_read_timeout 300s\`
- **日志**：生产环境请开启 \`access_log\` 便于排查问题

> 生产环境修改后务必先 \`nginx -t\` 检查语法，再 \`nginx -s reload\` 平滑重启`, 'network', '', '2025-03-10 09:30', '2025-05-20 14:15'],

      [2, '防火墙策略变更流程', `# 防火墙策略变更流程

## 适用范围

本流程适用于 FortiGate 系列防火墙的策略新增、修改、删除操作。

## 变更前检查

1. **确认业务影响范围** — 涉及哪些 IP 段和端口
2. **备份当前配置**
3. **创建变更工单** — 记录变更原因和时间窗口

## 操作步骤

### 新增策略

1. 登录 Web 管理界面
2. 导航至 **策略&对象** → **IPv4策略**
3. 点击 **新建**
4. 填写参数并启用日志记录

## 回滚方案

如果变更后出现异常，立即执行配置恢复。

## 变更后验证

- [ ] 策略序列号正确
- [ ] 业务方确认服务可达
- [ ] 日志无异常拦截记录`, 'security', '', '2025-04-02 16:00', '2025-04-02 16:00'],

      [3, 'MySQL 主从切换操作手册', `# MySQL 主从切换操作手册

## 适用环境

- **主库**: 10.0.1.20:3306 (R750xa)
- **从库**: 10.0.1.21:3306 (R750xa)
- **版本**: MySQL 8.0.35

## 切换前准备

### 1. 确认主从同步状态

\`\`\`sql
SHOW SLAVE STATUS\\G
\`\`\`

关键指标：
- \`Slave_IO_Running: Yes\`
- \`Slave_SQL_Running: Yes\`
- \`Seconds_Behind_Master\` 接近 0

### 2. 锁定主库写入

\`\`\`sql
SET GLOBAL read_only = ON;
FLUSH TABLES WITH READ LOCK;
\`\`\`

## 执行切换

### Step 1: 确保从库追平

### Step 2: 提升从库为主库

\`\`\`sql
STOP SLAVE;
RESET SLAVE ALL;
SET GLOBAL read_only = OFF;
\`\`\`

### Step 3: 修改应用连接地址

## 验证清单

- [x] 新主库可写入
- [x] 应用服务正常启动
- [x] 监控告警恢复`, 'database', '', '2025-01-16 09:00', '2025-04-10 11:30'],

      [4, '服务器上架标准流程', `# 服务器上架标准流程

## 准备工作

### 硬件检查

- 核对设备清单（型号、序列号）
- 检查外观无运输损坏
- 确认配件齐全（导轨、电源线、网线）

### 机柜准备

- 确认目标机柜预留 U 位足够
- 检查 PDU 电源接口可用
- 确认网络交换机端口充足

## 上架步骤

1. **安装导轨** — 按机柜前后立柱间距调整导轨长度
2. **安装服务器** — 两人协作将服务器推入导轨，锁紧螺丝
3. **接线** — 电源线双路接入 + 网线接入
4. **标签** — 机柜前后贴设备标签

## 上电检查

\`\`\`bash
ipmitool -H 10.0.0.50 -U admin -P password power status
\`\`\`

> ⚠️ 上架后 24 小时内密切监控温度和风扇转速`, 'server', '', '2025-02-20 08:30', '2025-05-01 10:00'],

      [5, '每日巡检清单', `# 每日巡检清单

## 巡检时间

**每日上午 9:00 - 9:30**

## 巡检项目

### 1. 系统监控大盘

登录 Grafana 检查：

- [ ] CPU 使用率均 < 80%
- [ ] 内存使用率均 < 85%
- [ ] 磁盘使用率均 < 90%
- [ ] 无新增告警

### 2. 核心服务状态

| 服务 | 检查方式 | 预期 |
|------|---------|------|
| Zabbix | Web 可访问 | 在线 |
| Gitea | curl 检查 | 200 |
| Grafana | Web 可访问 | 在线 |

### 3. 备份检查

### 4. 日志异常扫描

## 异常处理

- 黄色告警：记录并跟踪
- 红色告警：立即通知运维经理
- 磁盘 > 95%：立即执行清理脚本`, 'routine', '', '2024-12-01 09:00', '2025-05-15 09:00'],

      [6, 'SSL 证书申请与部署', `# SSL 证书申请与部署

## 证书类型

| 类型 | 适用场景 | 有效期 |
|------|---------|--------|
| Let's Encrypt | 公网服务 | 90天 |
| 内部 CA | 内网服务 | 1年 |
| 商业证书 | 对外业务 | 1年 |

## Let's Encrypt 申请

\`\`\`bash
apt install certbot
certbot certonly --manual --preferred-challenges dns -d api.example.com
\`\`\`

## Nginx 部署

\`\`\`nginx
server {
    listen 443 ssl http2;
    server_name api.example.com;
    ssl_certificate     /etc/nginx/certs/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/privkey.pem;
}
\`\`\`

## 自动续期

\`\`\`bash
0 3 1 * * certbot renew --quiet --post-hook "nginx -s reload"
\`\`\``, 'security', '', '2025-01-14 11:20', '2025-03-01 09:00'],

      [7, 'Docker 服务部署规范', `# Docker 服务部署规范

## 镜像管理

- **命名规范**: 项目名/服务名:版本号
- **基础镜像**: 统一使用 node:20-alpine / python:3.12-slim
- **安全扫描**: 部署前运行 docker scan

## 容器配置模板

\`\`\`yaml
version: '3.8'
services:
  app:
    image: project/app:1.0.0
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    volumes:
      - ./data:/app/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 3s
      retries: 3
\`\`\`

## 部署检查清单

- [ ] docker-compose config 语法正确
- [ ] 端口不冲突
- [ ] 数据卷路径存在
- [ ] 环境变量完整
- [ ] 健康检查配置`, 'server', '', '2025-02-10 14:00', '2025-04-20 16:30'],

      [8, '网络故障排查 SOP', `# 网络故障排查 SOP

## 排查原则

> 从物理层到应用层，逐层排查

## 一、物理层

1. 设备指示灯是否正常
2. 网线是否松动
3. 交换机端口状态

## 二、链路层

### ARP 检查
\`\`\`bash
arp -a | grep 10.0.0.1
\`\`\`

## 三、网络层

### 连通性测试
\`\`\`bash
ping -c 4 10.0.0.1
traceroute 10.0.0.1
\`\`\`

## 四、传输层

### 端口连通性
\`\`\`bash
nc -zv 10.0.0.1 443
\`\`\`

## 五、应用层

\`\`\`bash
curl -I -m 5 http://10.0.0.1
\`\`\`

## 常用排查工具速查表

| 场景 | 工具 | 命令 |
|------|------|------|
| DNS 解析 | dig | dig api.example.com |
| 抓包分析 | tcpdump | tcpdump -i eth0 port 443 |
| 带宽测试 | iperf3 | iperf3 -c 10.0.0.1 |`, 'network', '', '2025-03-05 10:00', '2025-05-10 08:45'],
    ]
    docs.forEach(d => insertDoc.run(...d))

    console.log(`[db] 已初始化 ${folders.length} 个手册文件夹, ${docs.length} 篇手册文档`)
  })
  seedManuals()
}

// 打印机楼层数据初始化
const pfCount = db.prepare('SELECT COUNT(*) as cnt FROM printer_floors').get() as { cnt: number }
if (pfCount.cnt === 0) {
  const insertPF = db.prepare('INSERT INTO printer_floors (name, sort_order) VALUES (?, ?)')
  const pfData: [string, number][] = [
    ['负二楼', 0], ['负一楼', 1], ['负0.5', 2], ['一楼', 3], ['二楼', 4], ['三楼', 5],
    ['四楼', 6], ['五楼', 7], ['南宜', 8], ['秘园', 9], ['威斯顿', 10],
  ]
  const seedPF = db.transaction(() => { pfData.forEach(f => insertPF.run(...f)) })
  seedPF()
  console.log(`[db] 已初始化 ${pfData.length} 个打印机楼层`)
}

// 打印机数据初始化
const printerCount = db.prepare('SELECT COUNT(*) as cnt FROM printers').get() as { cnt: number }
if (printerCount.cnt === 0) {
  const insertPrinter = db.prepare(
    'INSERT INTO printers (floor, location, manufacturer, model, toner_model, notes, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
  )
  const printers: [string, string, string, string, string, string, string][] = [
    ['负二楼', '后勤部', 'HP', 'M1132 MFP', '388A', '放在负二楼信息科闲置', '正常'],
    ['负二楼', '库房', 'Epson', 'LQ-300K+Ⅱ', '', '', '正常'],
    ['负二楼', '库房', 'Epson', 'LQ-300K+Ⅱ', '', '', '正常'],
    ['负二楼', '库房', 'Epson', 'LQ-630KⅡ', '', '', '正常'],
    ['负二楼', '库房', 'HP', 'M26NW', '', '', '正常'],
    ['负二楼', '库房', 'HP', 'M154a', 'cf510/cf511/cf512/cf513', '', '正常'],
    ['负二楼', '档案室', 'HP', 'M154a', 'cf510/cf511/cf512/cf513', '', '正常'],
    ['负二楼', '公共区', 'Toshiba', 'e.STUDIO2020AC', '', '', '正常'],
    ['负二楼', '人力', 'HP', 'M3388sdw', '2220A', '', '正常'],
    ['负一楼', '客诉办', 'HP', '1020plus', '2612A', '', '正常'],
    ['负一楼', '牙科医生办公室', 'HP', 'P1106', '388A', '', '正常'],
    ['负一楼', '形体前台', 'HP', '3004DW', 'CF1460', '', '正常'],
    ['负一楼', '纹绣', 'Brother', 'HL-B2050DN', 'B020粉', '未知待定', '正常'],
    ['负一楼', 'CT间', 'Brother', 'HL-B2050DN', 'B020粉', '', '正常'],
    ['负一楼', '牙科前台', 'Brother', 'HL-B2050DN', 'B020粉', '', '正常'],
    ['负一楼', '医务办', 'HP', 'M281fdw', 'cf500/cf501/cf502/cf503', '', '正常'],
    ['负一楼', '咨询经理办公室(原朱总办公室)', 'HP', 'M126a', '388A', '未知待定', '正常'],
    ['负一楼', '微创前台', 'HP', 'M128 FN', '388A', '', '正常'],
    ['负一楼', '微创药房', 'HP', 'P1007', '388A', '', '正常'],
    ['负0.5', '通道办公区（原食堂）', 'HP', 'M281DNW', 'cf500/cf501/cf502/cf503', '', '正常'],
    ['一楼', '监控室', 'HP', '3004DW', 'CF1460', '', '正常'],
    ['一楼', '会籍', 'HP', '102W', 'W1680AC', '无线', '正常'],
    ['一楼', '一楼大厅（向东）', 'HP', 'HP NS 1020W', '', '无线', '正常'],
    ['一楼', '综合办公室', 'HP', 'M128 FN', '388A', '', '正常'],
    ['一楼', '收费室', 'HP', 'P1106', '388A', '', '正常'],
    ['一楼', '收费室', 'HP', 'P1106', '388A', '', '正常'],
    ['一楼', '收费室', 'HP', 'P1106', '388A', '', '正常'],
    ['一楼', '收费室', 'HP', 'P1106', '388A', '', '正常'],
    ['一楼', '药房', 'HP', 'P1106', '388A', '', '正常'],
    ['一楼', '心电图室', 'HP', 'P1007', '388A', '', '正常'],
    ['一楼', '咨询一', 'HP', 'P1106', '388A', '', '正常'],
    ['一楼', '咨询二', 'HP', 'P1106', '388A', '', '正常'],
    ['一楼', '咨询三', 'HP', 'P1106', '388A', '', '正常'],
    ['一楼', '咨询五', 'HP', 'P1106', '388A', '', '正常'],
    ['一楼', '咨询六', 'HP', 'P1106', '388A', '', '正常'],
    ['一楼', '咨询七', 'Epson', 'L3255', '瓶装墨水（004）', '', '正常'],
    ['一楼', '咨询八', 'Samsung', 'ml2161', '101', '', '正常'],
    ['一楼', '咨询九', 'HP', 'P1106', '388A', '', '正常'],
    ['一楼', '咨询十', 'HP', 'P1106', '388A', '', '正常'],
    ['一楼', '咨询十一', 'HP', 'P1106', '388A', '', '正常'],
    ['一楼', '咨询十二', 'Samsung', 'ml2161', '101', '', '正常'],
    ['一楼', '检验科', 'HP', 'P1106', '388A', '', '正常'],
    ['一楼', '检验科', 'Epson', 'L5198', '瓶装墨水（004）', '', '正常'],
    ['二楼', '医生诊室一', 'Samsung', 'M2021W', '101', '', '正常'],
    ['二楼', '医生诊室二', 'HP', '1020plus', '2612A', '', '正常'],
    ['二楼', '医生诊室三', 'Brother', 'HL-B2050DN', 'B022粉', '', '正常'],
    ['二楼', '综合办公室', 'HP', '1020plus', '2612A', '', '正常'],
    ['二楼', '综合办公室', 'Brother', 'HL-B2050DN', 'B022粉', '', '正常'],
    ['二楼', '综合办公室', 'Samsung', 'm2020', '101', '', '正常'],
    ['二楼', 'visia', 'HP', 'm154a', 'cf510/cf511/cf512/cf513', '未知待定', '正常'],
    ['二楼', '皮肤科护士站', 'HP', '403D', '288e', '', '正常'],
    ['二楼', '皮肤科护士站', 'HP', '403D', '288e', '', '正常'],
    ['二楼', '照相室(微创)', 'HP', 'm154a', 'cf510/cf511/cf512/cf513', '', '正常'],
    ['二楼', '抗衰前台', 'HP', 'M254DW', 'cf500/cf501/cf502/cf503', '', '正常'],
    ['三楼', '医生办公室', 'HP', 'PRO 403D', '228E/228a', '', '正常'],
    ['三楼', '医生办公室', 'HP', 'P1106', '388A', '', '正常'],
    ['三楼', '医生办公室', 'HP', 'P1106', '388A', '', '正常'],
    ['三楼', '医生值班室', 'HP', 'P1106', '388A', '未知待定', '正常'],
    ['三楼', '医生值班室旁边（刘芯宇）', 'Epson', 'L5198', '瓶装墨水（004）', '未知待定', '正常'],
    ['三楼', '护士站', 'HP', 'P1106', '388A', '', '正常'],
    ['三楼', '护士站', 'HP', 'MFP M180n', 'cf510/cf511/cf512/cf513', '', '正常'],
    ['三楼', '护士站', 'Brother', 'TD-2020', '腕带打印机', '未用', '正常'],
    ['三楼', '前台门诊', 'Epson', 'L5198', '瓶装墨水（004）', '', '正常'],
    ['三楼', '前台门诊', 'Brother', 'TD-2020', '腕带打印机', '未用', '正常'],
    ['四楼', '医生办公室', 'HP', 'P1106', '388A', '', '正常'],
    ['四楼', '医生办公室', 'HP', 'P1106', '388A', '', '正常'],
    ['四楼', '手术前台', 'HP', 'M254DW', 'cf500/cf501/cf502/cf503', '', '正常'],
    ['四楼', '手术过道', 'HP', 'M254DW', 'cf500/cf501/cf502/cf503', '', '正常'],
    ['四楼', '手术室护士长办公室', 'HP', 'P1106', '388A', '', '正常'],
    ['四楼', '麻醉科', 'Brother', 'DCP-7180DN', 'TN-2325', '', '正常'],
    ['四楼', '鼻部办公室', 'HP', 'P1106', '388A', '', '正常'],
    ['五楼', '微创前台', 'Brother', 'HL-B2050DN', 'B020粉', '', '正常'],
    ['五楼', '董事长办公室', 'Brother', 'HL-B2050DN', 'B020粉', '未知待定', '正常'],
    ['五楼', '微创办公室', 'HP', 'M403D', '228E', '', '正常'],
    ['南宜', '饮水机旁边', 'Toshiba', 'e.STUDIO2110AC', '', '', '正常'],
    ['秘园', '二楼', 'HP', 'M154nw', 'cf510/cf511/cf512/cf513', '无线', '正常'],
    ['威斯顿', '16楼', 'Epson', 'L360', '瓶装墨水', '', '正常'],
    ['威斯顿', '16楼', 'HP', 'M254DW', 'cf500/cf501/cf502/cf503', '', '正常'],
  ]
  const seedPrinters = db.transaction(() => { printers.forEach(p => insertPrinter.run(...p)) })
  seedPrinters()
  console.log(`[db] 已初始化 ${printers.length} 台打印机数据`)
}

// 采购字典数据初始化
const deptCount = db.prepare('SELECT COUNT(*) as cnt FROM procurement_departments').get() as { cnt: number }
if (deptCount.cnt === 0) {
  const seedProcDicts = db.transaction(() => {
    // 部门
    const insertDept = db.prepare('INSERT INTO procurement_departments (name, sort_order) VALUES (?, ?)')
    const depts = ['研发部', '设计部', '市场部', '财务部', '人事部', '行政部', '销售部']
    depts.forEach((d, i) => insertDept.run(d, i))

    // 经手人
    const insertHandler = db.prepare('INSERT INTO procurement_handlers (name, sort_order) VALUES (?, ?)')
    const handlers = ['运维-王五', '运维-赵六', '运维-钱七']
    handlers.forEach((h, i) => insertHandler.run(h, i))

    // 手机品牌
    const insertPhoneBrand = db.prepare('INSERT INTO phone_brands (name, sort_order) VALUES (?, ?)')
    const phoneBrands = ['Apple', 'Samsung', '华为', '小米', 'OPPO', 'vivo', '荣耀', '一加', 'realme']
    phoneBrands.forEach((b, i) => insertPhoneBrand.run(b, i))

    // 手机型号
    const insertPhoneModel = db.prepare('INSERT INTO phone_models (brand_id, name, sort_order) VALUES (?, ?, ?)')
    const phoneBrandId = (name: string) => (db.prepare('SELECT id FROM phone_brands WHERE name = ?').get(name) as any).id
    const phoneModels: [string, string[]][] = [
      ['Apple', ['iPhone 16 Pro Max', 'iPhone 16 Pro', 'iPhone 16', 'iPhone 16 Plus', 'iPhone 15 Pro Max', 'iPhone 15 Pro', 'iPhone 15', 'iPhone 14 Pro Max', 'iPhone 14', 'iPhone SE']],
      ['Samsung', ['Galaxy S24 Ultra', 'Galaxy S24+', 'Galaxy S24', 'Galaxy S23 Ultra', 'Galaxy S23', 'Galaxy A55', 'Galaxy A35', 'Galaxy Z Fold5', 'Galaxy Z Flip5']],
      ['华为', ['Mate 60 Pro+', 'Mate 60 Pro', 'Mate 60', 'Pura 70 Pro+', 'Pura 70 Pro', 'Pura 70', 'nova 12 Pro', 'nova 12']],
      ['小米', ['Xiaomi 14 Ultra', 'Xiaomi 14 Pro', 'Xiaomi 14', 'Redmi K70 Pro', 'Redmi K70', 'Redmi Note 13 Pro+']],
      ['OPPO', ['Find X7 Ultra', 'Find X7', 'Reno11 Pro', 'Reno11', 'A3 Pro']],
      ['vivo', ['X100 Pro', 'X100', 'S18 Pro', 'S18', 'Y100']],
      ['荣耀', ['Magic6 Pro', 'Magic6', 'Magic V2', '200 Pro', 'X50']],
      ['一加', ['12', '11', 'Ace 3', 'Ace 2']],
      ['realme', ['GT5 Pro', 'GT5', '12 Pro+', '12 Pro']],
    ]
    for (const [brand, models] of phoneModels) {
      const bid = phoneBrandId(brand)
      models.forEach((m, i) => insertPhoneModel.run(bid, m, i))
    }

    // 电脑型号
    const insertCPM = db.prepare('INSERT INTO computer_models (name, sort_order) VALUES (?, ?)')
    const cpmNames = ['MacBook Pro 16"', 'MacBook Pro 14"', 'MacBook Air 15"', 'MacBook Air 13"', 'Dell XPS 15', 'Dell XPS 13', 'Dell Latitude 5540', 'ThinkPad X1 Carbon', 'ThinkPad T14', 'ThinkPad E14', 'HP EliteBook 840', 'HP ProBook 450']
    cpmNames.forEach((n, i) => insertCPM.run(n, i))

    console.log('[db] 已初始化采购字典数据')
  })
  seedProcDicts()
}

// 采购数据初始化（种子数据，仅在表为空时插入；真实数据通过 scripts/import-procurement.mjs 导入）
const cpCount = db.prepare('SELECT COUNT(*) as cnt FROM computer_procurement').get() as { cnt: number }
if (cpCount.cnt === 0) {
  const insertCP = db.prepare(
    'INSERT INTO computer_procurement (model, department, applicant, mac_address, device_model, ce_number, actual_user, approval_number, receive_date, asset_number, delivery_date, delivery_person, pickup_approval, ce_processed, price) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
  )
  const cpData: any[][] = [
    ['MacBook Pro 16"', '研发部', '张三', 'A1:B2:C3:D4:E5:F6', 'MacBook Pro M3 Max', 'CE20250001', '张三', 'DT202501001', '2025-01-15', 'IT-PC-2025-001', '2025-01-16', '运维-王五', 'DT202501002', 1, 18999],
    ['Dell XPS 15', '设计部', '李四', 'B2:C3:D4:E5:F6:A1', 'Dell XPS 15 9530', 'CE20250002', '李四', 'DT202502001', '2025-02-10', 'IT-PC-2025-002', '2025-02-11', '运维-王五', 'DT202502002', 1, 12999],
    ['ThinkPad X1 Carbon', '市场部', '王五', 'C3:D4:E5:F6:A1:B2', 'ThinkPad X1 Carbon Gen 11', 'CE20250003', '王五', 'DT202503001', '2025-03-05', 'IT-PC-2025-003', '2025-03-06', '运维-赵六', 'DT202503002', 0, 10999],
    ['MacBook Air 15"', '财务部', '赵六', 'D4:E5:F6:A1:B2:C3', 'MacBook Air M3', 'CE20250004', '赵六', 'DT202504001', '2025-04-20', 'IT-PC-2025-004', '2025-04-21', '运维-王五', 'DT202504002', 1, 8999],
    ['HP EliteBook 840', '人事部', '钱七', 'E5:F6:A1:B2:C3:D4', 'HP EliteBook 840 G10', '', '钱七', 'DT202505001', '2025-05-08', 'IT-PC-2025-005', '2025-05-09', '运维-赵六', '', 0, 7599],
  ]
  const seedCP = db.transaction(() => { cpData.forEach(r => insertCP.run(...r)) })
  seedCP()
  console.log(`[db] 已初始化 ${cpData.length} 条电脑采购数据`)
}

const ppCount = db.prepare('SELECT COUNT(*) as cnt FROM phone_procurement').get() as { cnt: number }
if (ppCount.cnt === 0) {
  const insertPP = db.prepare(
    'INSERT INTO phone_procurement (asset_number, part_no, serial_no, imei, arrival_date, pickup_date, brand, model, asset_link, department, handler, recipient, dingtalk_creator, purchase_type, dingtalk_flow, original_owner, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
  )
  const ppData: any[][] = [
    ['IT-PH-2025-001', 'A2849-001', 'F2LW48XHQJ6D', '356812090123456', '2025-01-10', '2025-01-12', 'Apple', 'iPhone 16 Pro Max 256G', 'IT-PC-2025-001', '研发部', '运维-王五', '张三', '张三', '新购', 'DT202501001', '—', '研发新机'],
    ['IT-PH-2025-002', 'S24U-002', 'R5YT72NPLK8H', '356812090123457', '2025-02-05', '2025-02-07', 'Samsung', 'Galaxy S24 Ultra 512G', 'IT-PC-2025-002', '设计部', '运维-王五', '李四', '李四', '新购', 'DT202502001', '—', '设计备用机'],
    ['IT-PH-2025-003', 'MI14-003', 'T9ZU34WVMN2P', '860123456789012', '2025-03-15', '2025-03-16', '小米', 'Xiaomi 14 Ultra', 'IT-PC-2025-003', '市场部', '运维-赵六', '王五', '王五', '换', 'DT202503001', '王五', '旧机屏幕损坏换新'],
    ['IT-PH-2025-004', 'OP12-004', 'K3LMW5QXRJ7T', '860123456789013', '2025-04-01', '2025-04-03', 'OPPO', 'Find X7 Ultra', 'IT-PC-2025-004', '财务部', '运维-王五', '赵六', '赵六', '新购', 'DT202504001', '—', ''],
    ['IT-PH-2025-005', 'HW60-005', 'P8QNX2VYKM4R', '860123456789014', '2025-05-20', '2025-05-21', '华为', 'Mate 60 Pro+', 'IT-PC-2025-005', '人事部', '运维-赵六', '钱七', '钱七', '新购', 'DT202505001', '—', '商务机'],
  ]
  const seedPP = db.transaction(() => { ppData.forEach(r => insertPP.run(...r)) })
  seedPP()
  console.log(`[db] 已初始化 ${ppData.length} 条手机采购数据`)
}

// ATCOM 话机管理默认配置
const configCount = db.prepare("SELECT COUNT(*) as cnt FROM system_config").get() as { cnt: number }
if (configCount.cnt === 0) {
  const insertCfg = db.prepare("INSERT OR IGNORE INTO system_config (key, value, description) VALUES (?, ?, ?)")
  insertCfg.run('atcom_pbx_ip', '192.168.35.250', 'IPPBX200 PBX IP 地址')
  insertCfg.run('atcom_pbx_user', 'admin', 'IPPBX200 登录用户名')
  insertCfg.run('atcom_pbx_pass', 'admin', 'IPPBX200 登录密码')
  console.log('[db] 已初始化 ATCOM 话机管理默认配置')
}

// 迁移：service_hosts 表将 device_id 替换为 category（服务分类）
const shColumns = db.prepare("PRAGMA table_info(service_hosts)").all() as { name: string }[]
if (shColumns.length > 0) {
  if (!shColumns.some(c => c.name === 'category')) {
    db.exec('ALTER TABLE service_hosts ADD COLUMN category TEXT NOT NULL DEFAULT \'\'')
    console.log('[db] 已添加 service_hosts.category 列')
  }
  // 旧 device_id 列保留不删（SQLite 不支持 DROP COLUMN 旧版本兼容），但不再使用
}

// 迁移：operation_logs 添加 operator 字段
const olColumns = db.prepare("PRAGMA table_info(operation_logs)").all() as { name: string }[]
if (olColumns.length > 0 && !olColumns.some(c => c.name === 'operator')) {
  db.exec("ALTER TABLE operation_logs ADD COLUMN operator TEXT NOT NULL DEFAULT ''")
  console.log('[db] 已添加 operation_logs.operator 列')
}

// 迁移：phone_remarks 表添加 sort_order 列
const prColumns = db.prepare("PRAGMA table_info(phone_remarks)").all() as { name: string }[]
if (prColumns.length > 0 && !prColumns.some(c => c.name === 'sort_order')) {
  db.exec("ALTER TABLE phone_remarks ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0")
  console.log('[db] 已添加 phone_remarks.sort_order 列')
}

// ========== 日志监控配置表 ==========
db.exec(`
  CREATE TABLE IF NOT EXISTS log_monitor_config (
    key       TEXT PRIMARY KEY,
    value     TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS log_audit (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id   TEXT    NOT NULL,
    device_name TEXT    NOT NULL,
    log_count   INTEGER NOT NULL,
    raw_logs    TEXT    NOT NULL,
    llm_summary TEXT    NOT NULL,
    has_abnormal INTEGER NOT NULL DEFAULT 0,
    llm_ms      INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_log_audit_device   ON log_audit(device_id);
  CREATE INDEX IF NOT EXISTS idx_log_audit_abnormal ON log_audit(has_abnormal);
  CREATE INDEX IF NOT EXISTS idx_log_audit_created  ON log_audit(created_at);
`)

// log_audit 新增外置文件路径列（P0-3 文件外置 + 7 天滚动，raw_logs 改为文件存储）
try {
  const auditCols = db.prepare("PRAGMA table_info(log_audit)").all() as { name: string }[]
  if (auditCols.length > 0 && !auditCols.some(c => c.name === 'log_file_path')) {
    db.exec("ALTER TABLE log_audit ADD COLUMN log_file_path TEXT NOT NULL DEFAULT ''")
    console.log('[db] 已添加 log_audit.log_file_path 列')
  }
} catch (e: any) {
  console.warn('[db] log_file_path 迁移失败（可能已存在）:', e.message)
}

// 异常告警推送去重表（新功能 异常告警推送）
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS log_alert_sent (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id  TEXT NOT NULL,
      audit_id   INTEGER NOT NULL REFERENCES log_audit(id) ON DELETE CASCADE,
      pushed_at  TEXT NOT NULL DEFAULT (datetime('now')),
      CONSTRAINT uq_alert_sent UNIQUE (device_id, audit_id)
    );
    CREATE INDEX IF NOT EXISTS idx_las_device ON log_alert_sent(device_id);
  `)
} catch (e: any) {
  console.warn('[db] log_alert_sent 建表失败:', e.message)
}

// 初始化日志监控默认配置
const lmConfigCount = db.prepare('SELECT COUNT(*) as cnt FROM log_monitor_config').get() as { cnt: number }
if (lmConfigCount.cnt === 0) {
  const insertConfig = db.prepare('INSERT OR IGNORE INTO log_monitor_config (key, value) VALUES (?, ?)')
  const defaults: [string, string][] = [
    ['log_server', JSON.stringify({
      base_url: 'http://127.0.0.1:8080',
      path: '/api/v1/logs?device_id={device_id}&start_time={start_time}&end_time={end_time}',
      page_size: 200,
      timeout: 30,
    })],
    ['devices', JSON.stringify([
      { device_id: '192.168.100.201', name: 'S5720-1F-POE-1' },
      { device_id: '192.168.100.254', name: 'S5720-HX-jifang-WLAN' },
      { device_id: '192.168.100.202', name: '华为交换机 202' },
      { device_id: '192.168.100.203', name: '华为交换机 203' },
      { device_id: '192.168.100.204', name: '华为交换机 204' },
      { device_id: '192.168.100.205', name: '华为交换机 205' },
      { device_id: '192.168.100.206', name: '华为交换机 206' },
      { device_id: '192.168.100.207', name: '华为交换机 207' },
      { device_id: '192.168.100.208', name: '华为交换机 208' },
    ])],
    ['llm', JSON.stringify({
      base_url: 'http://10.3.0.200:17002/v1',
      model: 'Qwen3.5-9B-AWQ',
      api_key: 'ml-ShHoXcDGYdOZlH14hv0_GBTlsbsHwliMlYHsIIwiTNc',
      temperature: 0.1,
      max_tokens: 1024,
      timeout: 120,
      retries: 3,
      system_prompt: '你是一位资深网络运维工程师，擅长分析网络设备日志。\n请你阅读以下日志，完成两件事，并以 JSON 返回：\n1. summary: 用 2~3 句话概括本批次日志反映的设备状况；\n2. has_abnormal: 是否存在异常（true/false）。\n异常包括但不限于：链路 down、错误包飙升、认证失败、设备重启、温度/CPU/内存越限、关键告警等。\n返回格式示例：\n{"summary": "...", "has_abnormal": false}\n只返回 JSON，不要任何解释。',
    })],
    ['scheduler', JSON.stringify({ interval: 300, window: 300 })],
    ['scheduler_running', 'false'],
  ]
  const seedDefaults = db.transaction(() => {
    for (const [key, value] of defaults) insertConfig.run(key, value)
  })
  seedDefaults()
  console.log('[db] 已初始化日志监控默认配置')
}

// 服务健康历史（健康历史/告警/定时巡检/SLA 共用）
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS service_health_logs (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
      status     TEXT NOT NULL,                -- online / offline / maintenance
      latency_ms INTEGER,                     -- NULL 表示超时/失败
      http_status INTEGER,                    -- HTTP 响应码（可空）
      error      TEXT NOT NULL DEFAULT '',
      checked_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_shl_service_time ON service_health_logs (service_id, checked_at DESC);
  `)
} catch {}

// 告警事件
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS service_alerts (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
      event      TEXT NOT NULL,                -- offline / online_recover
      prev_status TEXT,
      new_status  TEXT,
      latency_ms INTEGER,
      message    TEXT NOT NULL DEFAULT '',
      acknowledged INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_sa_created ON service_alerts (created_at DESC);
  `)
} catch {}

// 收藏
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_service_favorites (
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, service_id)
    );
  `)
} catch {}

// 凭证保险柜
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS service_credentials (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
      label      TEXT NOT NULL,
      username   TEXT NOT NULL DEFAULT '',
      secret_enc TEXT NOT NULL,               -- AES-256-GCM 密文
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_sc_service ON service_credentials (service_id);
  `)
} catch {}

// 初始化：如果 users 表为空，创建默认超级管理员
const userCount = (db.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number }).cnt
if (userCount === 0) {
  const hash = bcrypt.hashSync('admin123', 10)
  db.prepare(
    "INSERT INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)"
  ).run('admin', hash, '超级管理员', 'superadmin')
  console.log('[db] 已创建默认超级管理员账号：admin / admin123')
}

// 启动时注册：每日凌晨 4 点清理 7 天前的 data/log-audit/ 目录（P0-3）
try {
  cron.schedule('0 4 * * *', () => {
    const cutoff = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
    const baseDir = path.join('data', 'log-audit')
    if (!fs.existsSync(baseDir)) return
    for (const d of fs.readdirSync(baseDir)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(d) && d < cutoff) {
        fs.rmSync(path.join(baseDir, d), { recursive: true, force: true })
        console.log(`[log-audit] 已清理 7 天前目录: ${d}`)
      }
    }
  })
} catch (e: any) {
  console.warn('[db] log-audit 清理 cron 注册失败:', e.message)
}

export default db
