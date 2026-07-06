import { Router, Request, Response } from 'express'
import db from '../db'
import http from 'http'
import { getCachedPhones, ensurePhoneCache } from './phones'

const router = Router()

// GET /api/v1/dashboard/stats — 首页汇总统计
router.get('/stats', async (_req: Request, res: Response) => {
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

  // ATCOM 话机统计（缓存为空时自动触发首次发现）
  // 限制超时，避免 PBX 不可达时阻塞整个首页
  let phones = 0
  let phonesOnline = 0
  try {
    let cached = getCachedPhones()
    if (!cached) {
      const timeoutMs = 5000
      await Promise.race([
        ensurePhoneCache(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('pbx-timeout')), timeoutMs)),
      ]).catch(() => {}) // 超时或失败都不影响首页其它统计
      cached = getCachedPhones()
    }
    if (cached) {
      phones = cached.length
      phonesOnline = cached.filter((d: any) => d.online).length
    }
  } catch { /* ignore */ }

  res.json({
    code: 200,
    data: { services, manuals, devices, printers, computers, procurementPhones, lmDevices, phones, phonesOnline },
  })
})

export default router
