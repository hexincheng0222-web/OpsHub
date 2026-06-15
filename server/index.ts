import 'dotenv/config'
import express from 'express'
import cors from 'cors'
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

const app = express()
const PORT = parseInt(process.env.PORT || '3001')

// 中间件
app.use(cors())
app.use(express.json({ limit: '10mb' }))

// 健康检查
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// API 路由
app.use('/api/v1/services', servicesRouter)
app.use('/api/v1/racks', racksRouter)
app.use('/api/v1/devices', devicesRouter)
app.use('/api/v1/admin', adminRouter)
app.use('/api/v1/operations', operationsRouter)
app.use('/api/v1/printers', printersRouter)
app.use('/api/v1/computer-procurement', computerProcRouter)
app.use('/api/v1/phone-procurement', phoneProcRouter)
app.use('/api/v1/phones', phonesRouter)

// 全局错误处理
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[server] Error:', err.message)
  res.status(500).json({ code: 500, message: '服务器内部错误' })
})

// ===== 前端静态文件托管 =====
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distPath = path.resolve(__dirname, '..', 'dist')

// 静态文件（js/css/图片等，Vite 构建产物自带 hash，可长期缓存）
app.use(express.static(distPath, {
  maxAge: '30d',
  immutable: true,
  index: false, // 不自动返回 index.html，由下面的 fallback 处理
}))

// SPA fallback：非 /api 请求全部返回 index.html
app.get('/{*splat}', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'))
})

// 启动
app.listen(PORT, () => {
  console.log(`[server] OpsHub running at http://localhost:${PORT}`)
})
