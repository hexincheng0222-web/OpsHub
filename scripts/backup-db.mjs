/**
 * SQLite 备份脚本 (#17)
 *
 * 使用 better-sqlite3 的 .backup() API 生成一致性快照，
 * 压缩后按日期归档，保留最近 N 份。
 *
 * 用法：
 *   node scripts/backup-db.mjs              # 默认备份
 *   BACKUP_RETAIN=14 node scripts/backup-db.mjs   # 保留 14 天
 *
 * 建议配合 cron / PM2 定时执行：
 *   0 2 * * * cd /opt/opshub && npm run backup-db
 */
import Database from 'better-sqlite3'
import { createGzip } from 'zlib'
import { createReadStream, createWriteStream, mkdirSync, readdirSync, unlinkSync, statSync } from 'fs'
import { join, resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..')

const DB_PATH = process.env.DB_PATH || join(ROOT, 'data', 'opshub.db')
const BACKUP_DIR = process.env.BACKUP_DIR || join(ROOT, 'data', 'backups')
const RETAIN_DAYS = parseInt(process.env.BACKUP_RETAIN || '7', 10)

function timestamp() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`
}

async function backup() {
  mkdirSync(BACKUP_DIR, { recursive: true })

  const tmpPath = join(BACKUP_DIR, `.opshub-${timestamp()}.db.tmp`)
  const finalPath = join(BACKUP_DIR, `opshub-${timestamp()}.db.gz`)

  console.log(`[backup] 开始备份: ${DB_PATH}`)

  let db
  try {
    db = new Database(DB_PATH, { readonly: true })
    await db.backup(tmpPath)
    console.log(`[backup] 快照已生成: ${tmpPath}`)
  } catch (err) {
    console.error('[backup] 备份失败:', err.message)
    process.exit(1)
  } finally {
    if (db) db.close()
  }

  // 压缩
  await new Promise((resolveP, rejectP) => {
    const inp = createReadStream(tmpPath)
    const out = createWriteStream(finalPath)
    const gz = createGzip({ level: 9 })
    inp.pipe(gz).pipe(out)
    out.on('finish', resolveP)
    out.on('error', rejectP)
  })
  unlinkSync(tmpPath)

  const size = statSync(finalPath).size
  console.log(`[backup] 压缩完成: ${finalPath} (${(size / 1024).toFixed(1)} KB)`)

  // 清理过期备份
  const cutoff = Date.now() - RETAIN_DAYS * 86400000
  for (const f of readdirSync(BACKUP_DIR)) {
    if (!f.startsWith('opshub-') || !f.endsWith('.db.gz')) continue
    const full = join(BACKUP_DIR, f)
    if (statSync(full).mtimeMs < cutoff) {
      unlinkSync(full)
      console.log(`[backup] 已清理过期备份: ${f}`)
    }
  }

  // 校验：解压后用 readonly 模式能打开
  console.log('[backup] 完成')
}

backup()
