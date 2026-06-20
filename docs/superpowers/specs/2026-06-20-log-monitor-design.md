# 日志监控模块设计规格

> 将 log_analyzer（Python Flask 网络设备日志定时分析系统）重写为 Node.js/TypeScript 并集成到 OpsHub 项目

## 1. 概述

### 1.1 目标

在 OpsHub 中新增日志监控模块，实现网络设备日志的定时拉取、LLM 异常分析、SQLite 审计，并提供 Web UI 管理界面。

### 1.2 技术选型

| 组件 | 技术 | 说明 |
|------|------|------|
| 调度器 | node-cron | 类 cron 表达式，支持秒级调度 |
| 数据库 | better-sqlite3 | 复用现有 opshub.db |
| HTTP 客户端 | fetch（内置） | Node.js 18+ 原生 fetch |
| 前端 | Vue 3 + Element Plus | 与现有技术栈一致 |

### 1.3 第一版范围

| 模块 | 状态 |
|------|------|
| 日志拉取（含 mock 数据） | ✅ |
| LLM 异常分析（可配置 system prompt） | ✅ |
| SQLite 审计 | ✅ |
| node-cron 调度器 | ✅ |
| 配置 API（DB 存储） | ✅ |
| 审计查询 API | ✅ |
| 系统健康检查 API | ✅ |
| 前端：仪表盘（`/log-monitor`） | ✅ |
| 前端：审计记录（`/log-monitor/audit`） | ✅ |
| 前端：admin 日志监控配置（`/admin/log-monitor`） | ✅ |
| 前端：admin LLM 测试（`/admin/log-monitor/llm-test`） | ✅ |
| 企微推送 | ❌ 后续 |
| 配置版本历史 | ❌ 后续 |
| 实时活动日志 | ❌ 后续 |
| 审计数据导出 | ❌ 后续 |

## 2. 数据库设计

### 2.1 log_monitor_config 表

存储日志监控配置，JSON 格式。

```sql
CREATE TABLE IF NOT EXISTS log_monitor_config (
    key       TEXT PRIMARY KEY,
    value     TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

初始数据：

| key | value |
|-----|-------|
| `log_server` | `{"base_url":"http://127.0.0.1:8080","path":"/api/v1/logs?device_id={device_id}&start_time={start_time}&end_time={end_time}","page_size":200,"timeout":30}` |
| `devices` | `[{"device_id":"core-switch-01","name":"核心交换机 01"},{"device_id":"firewall-01","name":"防火墙 01"}]` |
| `llm` | `{"base_url":"http://10.3.0.200:17002/v1","model":"Qwen3.5-9B-AWQ","api_key":"...","temperature":0.1,"max_tokens":1024,"timeout":120,"retries":3,"system_prompt":"你是一位资深网络运维工程师..."}` |
| `scheduler` | `{"interval":300,"window":300}` |
| `scheduler_running` | `false` |

### 2.2 log_audit 表

存储每次分析的审计记录。

```sql
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
```

## 3. 后端设计

### 3.1 文件结构

```
server/
├── logMonitor.ts              # 核心服务
└── routes/
    └── log-monitor.ts         # API 路由
```

### 3.2 核心服务（logMonitor.ts）

```typescript
// 从数据库加载配置
function loadConfig(): LogConfig

// 保存配置到数据库
function saveConfigPartial(partial: Partial<LogConfig>)

// 拉取设备日志（日志服务器未通时返回 mock 数据）
async function fetchLogs(deviceId: string, startTime: Date, endTime: Date): Promise<LogEntry[]>

// 调用 LLM 分析日志
async function analyzeLogs(logs: Entry[], systemPrompt: string): Promise<LLMResult>

// 保存审计记录
function saveAudit(device: Device, logs: LogEntry[], result: LLMResult): number

// 清理过期审计
function cleanupAudit(retentionDays: number): number

// 健康检查
async function healthCheck(): Promise<HealthStatus>
```

### 3.3 路由设计（server/routes/log-monitor.ts）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/log-monitor/config` | 获取全部配置 |
| PUT | `/api/v1/log-monitor/config` | 更新配置（部分更新） |
| GET | `/api/v1/log-monitor/audit` | 分页查询审计记录（支持 device/abnormal 筛选） |
| DELETE | `/api/v1/log-monitor/audit` | 清理过期记录（参数：days） |
| POST | `/api/v1/log-monitor/run-once` | 手动触发一次分析 |
| POST | `/api/v1/log-monitor/scheduler/start` | 启动调度器 |
| POST | `/api/v1/log-monitor/scheduler/stop` | 停止调度器 |
| GET | `/api/v1/log-monitor/scheduler/status` | 获取调度器状态 |
| POST | `/api/v1/log-monitor/llm-test` | LLM 连通性测试 |
| GET | `/api/v1/log-monitor/health` | 系统健康检查 |

### 3.4 调度器（scheduler.ts）

独立模块，管理 node-cron 生命周期：

```typescript
// 启动调度器（从 DB 读取 interval）
export function startScheduler()

// 停止调度器
export function stopScheduler()

// 获取运行状态
export function getSchedulerStatus(): { running: boolean, lastRun: Date | null, nextRun: Date | null }
```

### 3.5 Mock 数据

当日志服务器不可达时，`fetchLogs` 返回模拟数据：

```typescript
function generateMockLogs(deviceId: string): LogEntry[] {
  // 生成 10-50 条模拟日志，包含正常和异常类型
  const levels = ['INFO', 'INFO', 'INFO', 'WARNING', 'ERROR', 'CRITICAL']
  const messages = [
    'Interface GigabitEthernet0/1 up',
    'OSPF adjacency established',
    'Temperature threshold exceeded (75°C)',
    'Authentication failed for user admin from 10.0.0.5',
    'BGP peer 192.168.1.1 state changed to Established',
    'Power supply 2 failure detected',
    ...
  ]
}
```

## 4. 前端设计

### 4.1 路由

```typescript
// 侧边栏菜单项（顶级）
{
  path: '/log-monitor',
  name: 'LogMonitor',
  component: () => import('../views/log-monitor/LogMonitorView.vue'),
  meta: { title: '日志监控仪表盘', icon: 'DataAnalysis' }
}

// 审计记录子路由
{
  path: '/log-monitor/audit',
  name: 'LogMonitorAudit',
  component: () => import('../views/log-monitor/LogMonitorAudit.vue'),
  meta: { title: '审计记录', icon: 'Document' }
}

// admin 子路由（在现有 admin 路由中添加）
{
  path: 'log-monitor',
  name: 'AdminLogMonitor',
  component: () => import('../views/admin/LogMonitorConfig.vue'),
  meta: { title: '日志监控配置' }
},
{
  path: 'log-monitor/llm-test',
  name: 'AdminLogMonitorLlmTest',
  component: () => import('../views/admin/LogMonitorLlmTest.vue'),
  meta: { title: 'LLM 连通测试' }
}
```

### 4.2 页面组件

#### LogMonitorView（仪表盘）

```
┌──────────────────────────────────────────────────────┐
│ 状态卡片行                                              │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐      │
│ │ 运行状态 │ │ 监控设备 │ │ 今日异常 │ │ 下次执行 │      │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘      │
├──────────────────────────────────────────────────────┤
│ 操作按钮：[立即执行] [启动/停止调度]                      │
├──────────────────────────────────────────────────────┤
│ 最近审计记录（表格，最近 10 条）                          │
│ ID | 设备 | 日志数 | 摘要 | 异常 | 耗时 | 时间            │
└──────────────────────────────────────────────────────┘
```

#### LogMonitorAudit（审计记录）

```
┌──────────────────────────────────────────────────────┐
│ 筛选栏：[时间范围] [异常状态▼] [筛选] [重置]            │
├──────────────────────────────────────────────────────┤
│ 审计表格（分页）                                        │
│ ID | 设备 | 日志数 | 摘要 | 异常 | 耗时 | 时间 | 操作    │
├──────────────────────────────────────────────────────┤
│ 分页：< 1 2 3 ... 10 >                                 │
└──────────────────────────────────────────────────────┘

详情弹窗：
┌──────────────────────────────────────────────────────┐
│ 审计详情 - 核心交换机 01 (#42)                         │
├──────────────────────────────────────────────────────┤
│ LLM 摘要                                              │
│ ┌──────────────────────────────────────────────────┐ │
│ │ 本批次检测到异常：温度越限告警，建议检查散热系统      │ │
│ └──────────────────────────────────────────────────┘ │
│ 原始日志                                              │
│ ┌──────────────────────────────────────────────────┐ │
│ │ [{"ts":"2026-06-20T10:00:00","msg":"Temp 75°C"}]  │ │
│ └──────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

#### AdminLogMonitorConfig（配置管理）

```
┌──────────────────────────────────────────────────────┐
│ 日志服务器配置                                          │
│ 基础 URL:     [http://127.0.0.1:8080        ]         │
│ 请求路径:     [/api/v1/logs?device_id=...    ]         │
│ 分页大小:     [200                        ]             │
│ 超时(秒):     [30                         ]             │
├──────────────────────────────────────────────────────┤
│ 监控设备列表                                    [添加] │
│ ┌──────────────────────────────────────────────┐     │
│ │ core-switch-01  核心交换机 01          [删除] │     │
│ │ firewall-01     防火墙 01              [删除] │     │
│ └──────────────────────────────────────────────┘     │
├──────────────────────────────────────────────────────┤
│ LLM 配置                                              │
│ API 端点:     [http://10.3.0.200:17002/v1  ]          │
│ 模型名称:     [Qwen3.5-9B-AWQ               ]          │
│ API Key:      [****************                    ]    │
│ Temperature:  [0.1                        ]           │
│ 最大 Tokens:  [1024                      ]            │
│ 超时(秒):     [120                       ]             │
│ 重试次数:     [3                          ]            │
├──────────────────────────────────────────────────────┤
│ 分析约束（System Prompt）                              │
│ ┌──────────────────────────────────────────────────┐ │
│ │ 你是一位资深网络运维工程师，擅长分析网络设备日志。  │ │
│ │ 请你阅读以下日志，完成两件事，并以 JSON 返回：     │ │
│ │ 1. summary: 用 2~3 句话概括设备状况               │ │
│ │ 2. has_abnormal: 是否存在异常（true/false）        │ │
│ │ ...                                               │ │
│ └──────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────┤
│ 调度配置                                              │
│ 轮询间隔(秒): [300                        ]             │
│ 时间窗口(秒): [300                        ]             │
├──────────────────────────────────────────────────────┤
│ [保存配置]  [取消]                                     │
└──────────────────────────────────────────────────────┘
```

#### AdminLogMonitorLlmTest（LLM 测试）

```
┌──────────────────────────────────────────────────────┐
│ 当前 LLM 配置                                         │
│ ┌──────────────────────────────────────────────────┐ │
│ │ API 端点:  http://10.3.0.200:17002/v1            │ │
│ │ 模型:      Qwen3.5-9B-AWQ                         │ │
│ │ Temperature: 0.1                                  │ │
│ │ 超时:      120s                                   │ │
│ └──────────────────────────────────────────────────┘ │
│ [开始测试连通性]                                      │
├──────────────────────────────────────────────────────┤
│ 测试结果                                              │
│ ┌──────────────────────────────────────────────────┐ │
│ │ ✅ 连接成功（耗时 342ms）                          │ │
│ │ 返回: "连接成功"                                  │ │
│ └──────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

## 5. 数据流

```
┌──────────┐     PUT      ┌──────────┐
│  Admin   │ ──────────→  │   DB     │
│  配置页面 │              │ log_monitor_config │
└──────────┘              └─────┬────┘
                                │ 启动时加载
                                ▼
┌──────────┐  interval   ┌──────────────┐
│  cron    │ ──────────→  │ LogAnalyzer  │
│  调度器  │              │ 核心服务      │
└──────────┘              └──────┬───────┘
     ▲                           │
     │ 状态查询                   ├── fetchLogs() → 日志服务器 / mock
     │                           ├── analyzeLogs() → LLM API
     │                           └── saveAudit() → log_audit 表
     │
┌──────────┐  GET /audit  ┌──────────┐
│ 审计页面  │ ←──────────  │  REST    │
│ 仪表盘    │              │  API     │
└──────────┘              └──────────┘
```

## 6. 错误处理

| 场景 | 处理方式 |
|------|---------|
| 日志服务器不可达 | 返回 mock 数据，记录 WARNING 日志 |
| LLM 调用超时 | 重试最多 3 次，指数退避（2s, 4s, 8s） |
| LLM 返回非 JSON | 降级为纯文本摘要，has_abnormal 根据关键词判断 |
| 配置保存失败 | 返回 500 + 错误信息，前端 Toast 提示 |
| DB 查询异常 | 全局错误中间件捕获，返回 500 |

## 7. 依赖

新增 npm 包：

```
node-cron    ~3.0.3   定时调度
```

其余使用现有依赖：better-sqlite3、express、cors、dotenv。

## 8. 文件变更清单

### 新增文件

| 文件 | 说明 |
|------|------|
| `server/logMonitor.ts` | 核心分析服务 |
| `server/routes/log-monitor.ts` | API 路由 |
| `src/views/log-monitor/LogMonitorView.vue` | 仪表盘页面 |
| `src/views/log-monitor/LogMonitorAudit.vue` | 审计记录页面 |
| `src/views/admin/LogMonitorConfig.vue` | 配置管理页面 |
| `src/views/admin/LogMonitorLlmTest.vue` | LLM 测试页面 |
| `src/api/log-monitor.ts` | 前端 API 封装 |

### 修改文件

| 文件 | 变更 |
|------|------|
| `server/db.ts` | 追加 log_monitor_config、log_audit 建表语句 |
| `server/index.ts` | 引入 logMonitorRouter |
| `src/router/index.ts` | 添加日志监控路由 |
| `src/components/AppMenu.vue`（或等效） | 添加"日志监控"菜单项 |
| `src/views/admin/AdminView.vue` | 添加日志监控子路由入口 |
| `package.json` | 添加 node-cron 依赖 |

---

*创建时间：2026-06-20*
*版本：1.0*
