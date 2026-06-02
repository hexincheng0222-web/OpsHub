import express from 'express'
import cors from 'cors'
import servicesRouter from './routes/services'

const app = express()
const PORT = parseInt(process.env.PORT || '3001')

// 中间件
app.use(cors())
app.use(express.json())

// 路由
app.use('/api/v1/services', servicesRouter)

// 全局错误处理
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[server] Error:', err.message)
  res.status(500).json({ code: 500, message: '服务器内部错误' })
})

// 启动
app.listen(PORT, () => {
  console.log(`[server] OpsHub API running at http://localhost:${PORT}`)
})
