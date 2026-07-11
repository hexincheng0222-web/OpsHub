import cron from 'node-cron'
import db from './db'
import { invalidateCheckAllCache } from './routes/services'

let cronTask: any = null
let lastRun: Date | null = null

export function startServicesScheduler(intervalMin = 10): void {
  if (cronTask) return
  const expr = `*/${intervalMin} * * * *`
  cronTask = cron.schedule(expr, async () => {
    lastRun = new Date()
    console.log('[services-scheduler] 巡检开始')
    try {
      const services = db.prepare("SELECT * FROM services WHERE status != 'maintenance'").all() as any[]
      const insertLog = db.prepare('INSERT INTO service_health_logs (service_id, status, latency_ms, http_status, error) VALUES (?, ?, ?, ?, ?)')
      const updateStmt = db.prepare("UPDATE services SET status=?, updated_at=datetime('now') WHERE id=?")
      let onlineN = 0
      for (const svc of services) {
        const r = await checkOneSimple(svc)
        updateStmt.run(r.status, r.id)
        insertLog.run(r.id, r.status, r.latencyMs, r.httpStatus || null, r.error || '')
        if (r.status === 'online') onlineN++
      }
      invalidateCheckAllCache()
      console.log(`[services-scheduler] 巡检完成 online=${onlineN}/${services.length}`)
    } catch (e) { console.warn('[services-scheduler] 巡检失败:', e) }
  })
}

export function stopServicesScheduler() { if (cronTask) { cronTask.stop(); cronTask = null } }
export function getSchedulerStatus() { return { running: !!cronTask, lastRun } }

async function checkOneSimple(svc: any): Promise<any> {
  const start = Date.now()
  try {
    const c = new AbortController(); const t = setTimeout(() => c.abort(), 5000)
    const res = await fetch(svc.url, { method: 'HEAD', signal: c.signal }); clearTimeout(t)
    return { id: svc.id, status: res.status < 500 ? 'online' : 'offline', latencyMs: Date.now() - start, httpStatus: res.status }
  } catch {
    try {
      const c2 = new AbortController(); const t2 = setTimeout(() => c2.abort(), 5000)
      const res = await fetch(svc.url, { method: 'GET', signal: c2.signal, headers: { Range: 'bytes=0-0' } }); clearTimeout(t2)
      return { id: svc.id, status: res.status < 500 ? 'online' : 'offline', latencyMs: Date.now() - start, httpStatus: res.status }
    } catch { return { id: svc.id, status: 'offline', latencyMs: null, error: '连接超时' } }
  }
}
