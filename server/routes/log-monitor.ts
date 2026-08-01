import { Router, Request, Response } from 'express'
import fs from 'node:fs'
import db from '../db'
import { logOperation, logCtx } from '../logOperation'
import {
  loadConfig, saveConfigPartial, fetchLokiLogs, analyzeLogs,
  saveAudit, cleanupAudit, healthCheck, startScheduler,
  pushAlertIfAbnormal,
  stopScheduler, getSchedulerStatus, getDashboardData,
  discoverDevices,
} from '../logMonitor'

const router = Router()

// 1. 获取配置（LLM API Key 掩码：不回传明文，仅返回是否已配置）
router.get('/config', (_req: Request, res: Response) => {
  const cfg = loadConfig()
  const hasApiKey = !!(cfg.llm?.api_key)
  if (cfg.llm) cfg.llm.api_key = ''
  res.json({ code: 200, data: { ...cfg, llm: { ...cfg.llm, has_api_key: hasApiKey } } })
})

// 2. 更新配置（api_key 传空 = 保留原值不修改）
router.put('/config', (req: Request, res: Response) => {
  try {
    const body = { ...req.body }
    const existing = loadConfig()
    if (body.llm && body.llm.api_key === '') {
      body.llm.api_key = existing.llm?.api_key || ''
    }
    const updated = saveConfigPartial(body)
    const hasApiKey = !!(updated.llm?.api_key)
    if (updated.llm) updated.llm.api_key = ''
    // 只记录修改了哪些配置键，不记录值（api_key 等敏感字段绝不明文落日志）
    const changedKeys = Object.keys(body).flatMap(k =>
      body[k] && typeof body[k] === 'object'
        ? Object.keys(body[k]).map(sub => `${k}.${sub}`)
        : [k]
    )
    logOperation({ module: '日志监控', action: '修改配置', target: changedKeys.join(', ') || 'config', detail: '', operator: req.user?.username || '', ...logCtx(req) })
    res.json({ code: 200, data: { ...updated, llm: { ...updated.llm, has_api_key: hasApiKey } } })
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message })
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

  const row = db.prepare(`SELECT COUNT(*) as cnt FROM log_audit ${where}`).get(...params) as { cnt: number }
  const total = row.cnt
  const rows = db.prepare(
    `SELECT id, device_id, device_name, log_count, llm_summary, has_abnormal, llm_ms, created_at
     FROM log_audit ${where} ORDER BY id DESC LIMIT ? OFFSET ?`
  ).all(...params, pageSize, (page - 1) * pageSize)

  res.json({ code: 200, data: { list: rows, total, page, pageSize } })
})

// 3b. 读取单条审计的外置日志文件
router.get('/audit/:id/logs', (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id))
  if (isNaN(id)) return res.status(400).json({ code: 400, message: '无效 ID' })
  const row = db.prepare('SELECT log_file_path, raw_logs FROM log_audit WHERE id = ?').get(id) as any
  if (!row) return res.status(404).json({ code: 404, message: '审计记录不存在' })

  // 兼容旧数据：log_file_path 非空且文件存在时读文件
  if (row.log_file_path && fs.existsSync(row.log_file_path)) {
    try {
      const logs = JSON.parse(fs.readFileSync(row.log_file_path, 'utf-8'))
      return res.json({ code: 200, data: { logs, source: 'file' } })
    } catch (e: any) {
      console.warn(`[audit] 读文件失败 ${row.log_file_path}:`, e.message)
    }
  }
  // 回退：旧数据 raw_logs 或文件已被清理
  try {
    const logs = JSON.parse(row.raw_logs || '[]')
    res.json({ code: 200, data: { logs, source: 'db', expired: logs.length === 0 } })
  } catch {
    res.json({ code: 200, data: { logs: [], source: 'db', expired: true } })
  }
})

// 4. 清理过期审计
router.delete('/audit', (req: Request, res: Response) => {
  const days = parseInt(req.query.days as string) || 90
  const deleted = cleanupAudit(days)
  logOperation({ module: '日志监控', action: '清理审计', target: `${deleted} 条（${days} 天前）`, detail: '', operator: req.user?.username || '', ...logCtx(req) })
  res.json({ code: 200, data: { deleted } })
})

// 5. 手动触发一次分析（自动发现设备）
router.post('/run-once', async (req: Request, res: Response) => {
  try {
    const config = loadConfig()
    const results = []
    const endTime = new Date()
    const startTime = new Date(endTime.getTime() - (config.scheduler.window * 1000))

    // 自动发现设备，回退到配置列表
    const discovered = await discoverDevices()
    const nameMap = new Map(config.devices.map(d => [d.device_id, d.name]))
    const deviceList = discovered.length > 0
      ? discovered.map(d => ({ device_id: d.ip, name: nameMap.get(d.ip) || d.hostname, hostname: d.hostname }))
      : config.devices

    for (const device of deviceList) {
      const queryTarget = (device as any).hostname || device.device_id
      const { logs } = await fetchLokiLogs(queryTarget, startTime, endTime, 200)
      const result = await analyzeLogs(logs, config.llm.system_prompt)
      const id = saveAudit(device, logs, result)
      results.push({ id, device_id: device.device_id, has_abnormal: result.has_abnormal })
    }
    res.json({ code: 200, data: results })
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message })
  }
})

// 5b. 单设备分析（点击卡片“分析”按钮触发）
router.post('/analyze-device', async (req: Request, res: Response) => {
  try {
    const { device_id, hostname, time_range } = req.body
    if (!device_id) {
      return res.status(400).json({ code: 400, message: '缺少 device_id' })
    }

    const config = loadConfig()
    const endTime = new Date()

    // 根据前端传入的时间范围确定查询窗口，默认 1 小时
    const rangeMap: Record<string, number> = {
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
    }
    const windowMs = rangeMap[time_range] || 60 * 60 * 1000
    const startTime = new Date(endTime.getTime() - windowMs)

    // 用 fetchLokiLogs 从 Loki 查真实日志（不限量，取时间窗口内全部日志）
    const queryTarget = hostname || device_id
    const { logs, error: lokiError } = await fetchLokiLogs(queryTarget, startTime, endTime, 10000)
    if (!logs.length) {
      // 区分「查询失败」与「真无日志」：失败时把 Loki 错误透传给前端，避免误报"设备正常"
      const summary = lokiError ? `日志查询失败：${lokiError}` : '无日志可分析'
      return res.json({ code: 200, data: { summary, has_abnormal: false, llm_ms: 0, created_at: new Date().toISOString(), error: lokiError || null } })
    }

    const result = await analyzeLogs(logs, config.llm.system_prompt)
    const device = { device_id, name: hostname || device_id }
    const auditId = saveAudit(device, logs, result)

    // 新增：手动分析也触发告警
    await pushAlertIfAbnormal(device, auditId, result)

    res.json({
      code: 200,
      data: {
        summary: result.summary,
        has_abnormal: result.has_abnormal,
        llm_ms: result._llm_ms || 0,
        created_at: new Date().toISOString(),
        error: null,
      },
    })
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message })
  }
})

// 6. 调度器控制
router.post('/scheduler/start', (req: Request, res: Response) => {
  startScheduler()
  logOperation({ module: '日志监控', action: '启动调度器', target: '自动分析调度器', detail: '', operator: req.user?.username || '', ...logCtx(req) })
  res.json({ code: 200, message: '调度器已启动' })
})

router.post('/scheduler/stop', (req: Request, res: Response) => {
  stopScheduler()
  logOperation({ module: '日志监控', action: '停止调度器', target: '自动分析调度器', detail: '', operator: req.user?.username || '', ...logCtx(req) })
  res.json({ code: 200, message: '调度器已停止' })
})

router.get('/scheduler/status', (_req: Request, res: Response) => {
  res.json({ code: 200, data: getSchedulerStatus() })
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
    if (!r.ok) return res.json({ code: 200, data: { success: false, latency_ms: ms, error: `HTTP ${r.status}` } })
    const data = await r.json()
    const message = data.choices?.[0]?.message || {}
    const content: string = message.content || message.reasoning || ''
    res.json({ code: 200, data: { success: true, latency_ms: ms, response: content } })
  } catch (e: any) {
    res.json({ code: 200, data: { success: false, latency_ms: 0, error: e.message } })
  }
})

// 7b. Loki 连通测试
router.post('/test-loki', async (req: Request, res: Response) => {
  try {
    const { url } = req.body
    const testUrl = (url || '').replace(/\/$/, '')
    if (!testUrl) {
      return res.json({ code: 200, data: { success: false, latency_ms: 0, error: '请先填写 Loki 地址' } })
    }
    const t0 = Date.now()
    const r = await fetch(testUrl + '/loki/api/v1/labels', { signal: AbortSignal.timeout(10000) })
    const ms = Date.now() - t0
    if (!r.ok) {
      return res.json({ code: 200, data: { success: false, latency_ms: ms, error: `HTTP ${r.status}` } })
    }
    const data = await r.json() as any
    const labelCount = data.data?.length || 0
    res.json({ code: 200, data: { success: true, latency_ms: ms, label_count: labelCount } })
  } catch (e: any) {
    res.json({ code: 200, data: { success: false, latency_ms: 0, error: e.message } })
  }
})

// 8. Dashboard 数据
router.get('/dashboard', async (req: Request, res: Response) => {
  const timeRange = (req.query.time_range as string) || '1h'
  const data = await getDashboardData(timeRange)
  res.json({ code: 200, data })
})

// 9. 健康检查
router.get('/health', async (_req: Request, res: Response) => {
  const status = await healthCheck()
  res.json({ code: 200, data: status })
})

// 10. 从 Loki 自动发现设备
router.get('/discover', async (_req: Request, res: Response) => {
  try {
    const devices = await discoverDevices()
    const config = loadConfig()
    const configuredIds = new Set(config.devices.map(d => d.device_id))
    const result = devices.map(d => ({
      device_id: d.ip,
      name: configuredIds.has(d.ip)
        ? config.devices.find(c => c.device_id === d.ip)?.name || d.hostname
        : d.hostname,
      is_new: !configuredIds.has(d.ip),
    }))
    res.json({ code: 200, data: result })
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message })
  }
})

// 11. 异常趋势（按设备 + 日期聚合）
router.get('/trend', (req: Request, res: Response) => {
  const days = Math.min(30, Math.max(1, parseInt(req.query.days as string) || 7))
  const rows = db.prepare(`
    SELECT
      device_id,
      device_name,
      DATE(created_at) AS date,
      SUM(has_abnormal) AS abnormal_count,
      COUNT(*) AS total_count
    FROM log_audit
    WHERE created_at >= datetime('now', ?)
    GROUP BY device_id, DATE(created_at)
    ORDER BY device_id, DATE(created_at) ASC
  `).all(`-${days} days`) as any[]

  const deviceMap = new Map<string, { device_id: string; device_name: string; daily: any[] }>()
  for (const r of rows) {
    if (!deviceMap.has(r.device_id)) {
      deviceMap.set(r.device_id, { device_id: r.device_id, device_name: r.device_name, daily: [] })
    }
    deviceMap.get(r.device_id)!.daily.push({ date: r.date, abnormal_count: r.abnormal_count, total_count: r.total_count })
  }
  res.json({ code: 200, data: { devices: Array.from(deviceMap.values()), days } })
})

export default router
