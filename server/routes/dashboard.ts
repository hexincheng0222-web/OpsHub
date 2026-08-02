import { Router, Request, Response } from 'express'
import db from '../db'
import { getCachedPhones, ensurePhoneCache } from './phones'

const router = Router()

// GET /api/v1/dashboard/stats — 首页汇总统计
router.get('/stats', (_req: Request, res: Response) => {
  const services = (db.prepare('SELECT COUNT(*) as cnt FROM services').get() as { cnt: number }).cnt
  const manuals = (db.prepare('SELECT COUNT(*) as cnt FROM manual_docs').get() as { cnt: number }).cnt
  const devices = (db.prepare('SELECT COUNT(*) as cnt FROM devices').get() as { cnt: number }).cnt
  const printers = (db.prepare('SELECT COUNT(*) as cnt FROM printers').get() as { cnt: number }).cnt
  const computers = (db.prepare('SELECT COUNT(*) as cnt FROM computer_procurement').get() as { cnt: number }).cnt
  const procurementPhones = (db.prepare('SELECT COUNT(*) as cnt FROM phone_procurement').get() as { cnt: number }).cnt

  // 日志监控设备数（从 config 中解析）
  let lmDevices = 0
  try {
    const row = db.prepare("SELECT value FROM log_monitor_config WHERE key = 'devices'").get() as { value: string } | undefined
    if (row) {
      const devices = JSON.parse(row.value)
      lmDevices = Array.isArray(devices) ? devices.length : 0
    }
  } catch { /* ignore */ }

  // ATCOM 话机统计：只读缓存 + 后台异步预热，不阻塞首页（#2026-08-02 性能优化）
  // 缓存缺失时立即返回 0/0 占位，由 fire-and-forget 预热填充，后续请求拿到真实值
  const cached = getCachedPhones()
  let phones = cached ? cached.length : 0
  let phonesOnline = cached ? cached.filter((d: any) => d.online).length : 0
  if (!cached) {
    // 不 await：后台异步发现，供后续请求使用；失败不影响首页
    ensurePhoneCache().catch(() => {})
  }

  res.json({
    code: 200,
    data: { services, manuals, devices, printers, computers, procurementPhones, lmDevices, phones, phonesOnline },
  })
})

export default router
