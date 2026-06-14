import express from 'express'
import cors from 'cors'
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

// 路由
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

// 启动
app.listen(PORT, () => {
  console.log(`[server] OpsHub API running at http://localhost:${PORT}`)
})
