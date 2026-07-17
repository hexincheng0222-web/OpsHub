import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import crypto from 'crypto'
import path from 'path'
import { fileURLToPath } from 'url'
import servicesRouter from './routes/services'
import racksRouter from './routes/racks'
import devicesRouter from './routes/devices'
import adminRouter from './routes/admin'
import operationsRouter from './routes/operations'
import printersRouter from './routes/printers'
import computerProcRouter from './routes/computer-procurement'
import phoneProcRouter from './routes/phone-procurement'
import phonesRouter from './routes/phones'
import logMonitorRouter from './routes/log-monitor'
import authRouter from './routes/auth'
import usersRouter from './routes/users'
import dashboardRouter from './routes/dashboard'
import cron from 'node-cron'
import db from './db'
import { startServicesScheduler, stopServicesScheduler } from './servicesScheduler'
import { authRequired, requireRole } from './middleware/auth'
import { credKeyReady } from './utils/crypto'
import type { Server } from 'http'

const app = express()
const PORT = parseInt(process.env.PORT || '3001')

// 中间件
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:5173', 'http://localhost:3001'],
  credentials: true,
}))
app.use(helmet({ crossOriginResourcePolicy: false }))
app.use(express.json({ limit: '10mb' }))

// 健康检查
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// API 路由
// 顺序：先注册不需要鉴权的路由（auth 登录、health），其余统一加 authRequired
app.use('/api/v1/auth', authRouter)
app.use('/api/v1/services', authRequired, servicesRouter)
app.use('/api/v1/racks', authRequired, racksRouter)
app.use('/api/v1/devices', authRequired, devicesRouter)
app.use('/api/v1/admin', authRequired, requireRole('admin', 'superadmin'), adminRouter)
app.use('/api/v1/operations', authRequired, operationsRouter)
app.use('/api/v1/printers', authRequired, printersRouter)
app.use('/api/v1/computer-procurement', authRequired, computerProcRouter)
app.use('/api/v1/phone-procurement', authRequired, phoneProcRouter)
app.use('/api/v1/phones', authRequired, phonesRouter)
app.use('/api/v1/users', authRequired, usersRouter)
app.use('/api/v1/log-monitor', authRequired, logMonitorRouter)
app.use('/api/v1/dashboard', authRequired, dashboardRouter)

// ========== 静态前端托管（生产模式） ==========
// 托管同项目下的 dist/（Vue 构建产物），不存在时跳过（dev 模式下由 Vite 独立托管）
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const distPath = path.resolve(__dirname, '../dist')
const fs = await import('fs')
if (fs.existsSync(path.join(distPath, 'index.html'))) {
  app.use(express.static(distPath, { maxAge: '1h', index: false }))
  // SPA fallback：所有非 /api 非静态文件的 GET 请求回 index.html
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })
  console.log(`[server] Serving static frontend from ${distPath}`)
}

// 全局错误处理
const SENSITIVE_PATTERNS = [/SQLITE/i, /FOREIGN KEY/i, /UNIQUE constraint/i, /HASH/i, /constraint/i]
function sanitizeErrorMessage(msg: string): string {
  for (const p of SENSITIVE_PATTERNS) {
    if (p.test(msg)) return '[DB_ERROR]'
  }
  return msg
}
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const traceId = crypto.randomBytes(4).toString('hex')
  // 日志脱敏：生产模式只落 err.code/err.name/traceId，开发模式落完整 message (#37)
  if (process.env.NODE_ENV === 'production') {
    console.error(`[server] Error (traceId=${traceId}, code=${err.code || 'N/A'}, name=${err.name || 'Unknown'})`)
  } else {
    console.error(`[server] Error (traceId=${traceId}):`, sanitizeErrorMessage(err.message || ''))
  }
  res.status(500).json({ code: 500, message: '服务器内部错误', traceId })
})

// 启动
// #35 AES 凭据加密密钥启动校验：生产环境未配置则拒绝启动，避免凭据加密静默失效
if (process.env.NODE_ENV === 'production' && !credKeyReady()) {
  console.error('[server] FATAL: 生产环境未配置 OPS_CRED_KEY（需 32 字节 hex），凭据加密将静默失效。请配置后重启。')
  process.exit(1)
}
if (!credKeyReady()) {
  console.warn('[server] WARN: OPS_CRED_KEY 未配置，凭据加密不可用（仅影响 service_credentials 加解密）')
}

// ========== 优雅关闭 (#17) ==========
// 收到 SIGTERM/SIGINT 时：停止接受新连接 → 等待活跃连接结束 → 停止 cron → 关闭 DB
let server: Server | null = null

function gracefulShutdown(signal: string) {
  console.log(`[server] 收到 ${signal}，开始优雅关闭...`)
  if (!server) {
    process.exit(0)
    return
  }
  // 1. 停止接受新连接
  server.close((err: any) => {
    if (err) console.error('[server] 关闭 HTTP server 失败:', err.message)
    else console.log('[server] HTTP server 已关闭')

    // 2. 停止定时任务
    try { stopServicesScheduler() } catch { /* ignore */ }
    try { cron.getTasks().forEach((t: any) => t.stop()) } catch { /* ignore */ }

    // 3. 关闭数据库
    try { db.close(); console.log('[server] SQLite 已关闭') } catch { /* ignore */ }

    process.exit(0)
  })

  // 5 秒后强制退出（避免卡死）
  setTimeout(() => {
    console.warn('[server] 优雅关闭超时，强制退出')
    process.exit(1)
  }, 5000).unref()
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))

server = app.listen(PORT, () => {
  console.log(`[server] OpsHub API running at http://localhost:${PORT}`)
})

// 定时巡检调度器（生产模式或显式开启时启动，避免开发环境干扰）
if (process.env.NODE_ENV === 'production' || process.env.ENABLE_SVC_CRON === '1') {
  startServicesScheduler(parseInt(process.env.SVC_CRON_MIN || '10'))
}

// 每日 03:00 清理 30 天前健康日志
cron.schedule('0 3 * * *', () => {
  try {
    const n = db.prepare("DELETE FROM service_health_logs WHERE checked_at < datetime('now', '-30 days')").run()
    if (n.changes > 0) console.log(`[services] 清理健康日志 ${n.changes} 条`)
  } catch (e) { console.warn('[services] 健康日志清理失败:', e) }
})

// 每日 04:00 清理 7 天前的 data/log-audit/ 目录
cron.schedule('0 4 * * *', async () => {
  try {
    const cutoff = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
    const baseDir = path.join('data', 'log-audit')
    const fsRef = await import('fs')
    if (!fsRef.existsSync(baseDir)) return
    for (const d of fsRef.readdirSync(baseDir)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(d) && d < cutoff) {
        fsRef.rmSync(path.join(baseDir, d), { recursive: true, force: true })
        console.log(`[log-audit] 已清理 7 天前目录: ${d}`)
      }
    }
  } catch (e) { console.warn('[services] log-audit 清理失败:', e) }
})
