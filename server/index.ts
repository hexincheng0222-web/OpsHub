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
import { authRequired, requireRole } from './middleware/auth'

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
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[server] Error:', err.message)
  const traceId = crypto.randomBytes(4).toString('hex')
  res.status(500).json({ code: 500, message: '服务器内部错误', traceId })
})

// 启动
app.listen(PORT, () => {
  console.log(`[server] OpsHub API running at http://localhost:${PORT}`)
})
