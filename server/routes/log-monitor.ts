import { Router, Request, Response } from 'express'
import db from '../db'
import {
  loadConfig, saveConfigPartial, fetchLogs, analyzeLogs,
  saveAudit, cleanupAudit, healthCheck, startScheduler,
  stopScheduler, getSchedulerStatus,
} from '../logMonitor'

const router = Router()

// 1. 获取配置
router.get('/config', (_req: Request, res: Response) => {
  res.json({ code: 0, data: loadConfig() })
})

// 2. 更新配置
router.put('/config', (req: Request, res: Response) => {
  try {
    const updated = saveConfigPartial(req.body)
    res.json({ code: 0, data: updated })
  } catch (e: any) {
    res.json({ code: 500, message: e.message })
  }
})

// 3. 分页查询审计记录
router.get('/audit', (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1)
  const pageSize = Math.min(200, Math.max(1, parseInt(req.query.pageSize as string) || 20))
  const deviceId = (req.query.device as string) || ''
  const abnormal = (req.query.abnormal as string) || ''
  const startDate = (req.query.start_date as string) || ''
  const endDate = (req.query.end_date as string) || ''

  let where = 'WHERE 1=1'
  const params: any[] = []

  if (deviceId) { where += ' AND device_id = ?'; params.push(deviceId) }
  if (abnormal === '1') { where += ' AND has_abnormal = 1' }
  else if (abnormal === '0') { where += ' AND has_abnormal = 0' }
  if (startDate) { where += ' AND created_at >= ?'; params.push(startDate) }
  if (endDate) { where += ' AND created_at <= ?'; params.push(endDate) }

  const total = db.prepare(`SELECT COUNT(*) as cnt FROM log_audit ${where}`).get(...params) as { cnt: number }
  const rows = db.prepare(
    `SELECT id, device_id, device_name, log_count, llm_summary, has_abnormal, llm_ms, created_at
     FROM log_audit ${where} ORDER BY id DESC LIMIT ? OFFSET ?`
  ).all(...params, pageSize, (page - 1) * pageSize)

  res.json({ code: 0, data: { list: rows, total, page, pageSize } })
})

// 4. 清理过期审计
router.delete('/audit', (req: Request, res: Response) => {
  const days = parseInt(req.query.days as string) || 90
  const deleted = cleanupAudit(days)
  res.json({ code: 0, data: { deleted } })
})

// 5. 手动触发一次分析
router.post('/run-once', async (req: Request, res: Response) => {
  try {
    const config = loadConfig()
    const results = []
    const endTime = new Date()
    const startTime = new Date(endTime.getTime() - (config.scheduler.window * 1000))

    for (const device of config.devices) {
      const logs = await fetchLogs(device.device_id, startTime, endTime)
      const result = await analyzeLogs(logs, config.llm.system_prompt)
      const id = saveAudit(device, logs, result)
      results.push({ id, device_id: device.device_id, has_abnormal: result.has_abnormal })
    }
    res.json({ code: 0, data: results })
  } catch (e: any) {
    res.json({ code: 500, message: e.message })
  }
})

// 6. 调度器控制
router.post('/scheduler/start', (_req: Request, res: Response) => {
  startScheduler()
  res.json({ code: 0, message: '调度器已启动' })
})

router.post('/scheduler/stop', (_req: Request, res: Response) => {
  stopScheduler()
  res.json({ code: 0, message: '调度器已停止' })
})

router.get('/scheduler/status', (_req: Request, res: Response) => {
  res.json({ code: 0, data: getSchedulerStatus() })
})

// 7. LLM 连通测试
router.post('/llm-test', async (req: Request, res: Response) => {
  try {
    const config = loadConfig()
    const url = (config.llm?.base_url || '').replace(/\/$/, '') + '/chat/completions'
    const t0 = Date.now()
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.llm?.api_key || 'EMPTY'}`,
      },
      body: JSON.stringify({
        model: config.llm?.model || '',
        messages: [{ role: 'user', content: '回复：连接成功' }],
        max_tokens: 50,
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout((config.llm?.timeout || 120) * 1000),
    })
    const ms = Date.now() - t0
    if (!r.ok) return res.json({ code: 0, data: { success: false, latency_ms: ms, error: `HTTP ${r.status}` } })
    const data = await r.json()
    const content = data.choices?.[0]?.message?.content || ''
    res.json({ code: 0, data: { success: true, latency_ms: ms, response: content } })
  } catch (e: any) {
    res.json({ code: 0, data: { success: false, latency_ms: 0, error: e.message } })
  }
})

// 8. 健康检查
router.get('/health', async (_req: Request, res: Response) => {
  const status = await healthCheck()
  res.json({ code: 0, data: status })
})

export default router
