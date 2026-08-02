import { Router, Request, Response } from 'express'
import { execFile } from 'node:child_process'
import { readdirSync, statSync, createReadStream } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { logOperation, logCtx } from '../logOperation'

const router = Router()

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..', '..')
const BACKUP_DIR = process.env.BACKUP_DIR || join(ROOT, 'data', 'backups')

// 备份文件名白名单：opshub-YYYYMMDD-HHmmss.db.gz，防止目录穿越
const BACKUP_FILE_RE = /^opshub-\d{8}-\d{6}\.db\.gz$/

// GET /api/v1/backup/list — 备份文件列表（按时间倒序）
router.get('/list', (_req: Request, res: Response) => {
  try {
    if (!require('node:fs').existsSync(BACKUP_DIR)) {
      return res.json({ code: 200, data: [] })
    }
    const files = readdirSync(BACKUP_DIR)
      .filter(f => BACKUP_FILE_RE.test(f))
      .map(f => {
        const full = join(BACKUP_DIR, f)
        const st = statSync(full)
        return {
          filename: f,
          size: st.size,
          size_kb: Number((st.size / 1024).toFixed(1)),
          created_at: st.mtime.toISOString().replace('T', ' ').slice(0, 19),
        }
      })
      .sort((a, b) => b.filename.localeCompare(a.filename)) // 文件名含时间戳，倒序即最新在前
    res.json({ code: 200, data: files })
  } catch (e: any) {
    res.status(500).json({ code: 500, message: '读取备份列表失败', traceId: String(e?.message || '') })
  }
})

// POST /api/v1/backup — 手动触发备份（复用 scripts/backup-db.mjs）
router.post('/', (req: Request, res: Response) => {
  const script = join(ROOT, 'scripts', 'backup-db.mjs')
  execFile(process.execPath, [script], { timeout: 120_000 }, (err, _stdout, stderr) => {
    if (err) {
      logOperation({ module: '备份', action: '手动备份', target: '数据库', detail: '失败', operator: req.user?.username || '', ...logCtx(req) })
      return res.status(500).json({ code: 500, message: '备份失败: ' + (stderr || err.message) })
    }
    logOperation({ module: '备份', action: '手动备份', target: '数据库', detail: '成功', operator: req.user?.username || '', ...logCtx(req) })
    res.json({ code: 200, message: '备份完成' })
  })
})

// GET /api/v1/backup/:filename/download — 下载备份文件
router.get('/:filename/download', (req: Request, res: Response) => {
  const filename = String(req.params.filename || '')
  if (!BACKUP_FILE_RE.test(filename)) {
    return res.status(400).json({ code: 400, message: '无效的备份文件名' })
  }
  const full = join(BACKUP_DIR, filename)
  if (!require('node:fs').existsSync(full)) {
    return res.status(404).json({ code: 404, message: '备份文件不存在' })
  }
  res.setHeader('Content-Type', 'application/gzip')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  createReadStream(full).pipe(res)
})

export default router
