/**
 * 格式化时间字符串为本地化格式
 * @param time DB datetime('now') 存 UTC，格式 'YYYY-MM-DD HH:MM:SS'（无时区后缀）
 * @returns 本地时区格式化后的时间字符串
 */
export function formatTime(time: string | number | undefined | null): string {
  if (!time) return '—'
  // DB 存 UTC 且无时区后缀。补 'Z' 让 Date 按 UTC 解析，再 toLocaleString 转本地时区显示
  const iso = typeof time === 'string' && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(time)
    ? time.replace(' ', 'T') + 'Z'
    : time
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString('zh-CN', { hour12: false, timeZone: 'Asia/Shanghai' })
}

/**
 * 格式化 ISO 时间戳为 "YYYY-MM-DD HH:mm:ss"
 */
export function formatISOTime(iso: string | undefined | null): string {
  if (!iso) return ''
  return iso.replace('T', ' ').slice(0, 19)
}

/**
 * 截断文本，超过指定长度时添加省略号
 */
export function truncateText(text: string | undefined | null, maxLen = 80): string {
  if (!text) return ''
  return text.length <= maxLen ? text : text.slice(0, maxLen) + '...'
}

/**
 * 格式化运行时间（秒）为 "x天 x小时 x分" 逐级降档
 * @param sec 秒数；0/负数/null → '—'
 */
export function formatUptime(sec: number | null | undefined): string {
  if (sec == null || !isFinite(sec) || sec <= 0) return '—'
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  if (d > 0) return `${d}天 ${h}小时${m ? ' ' + m + '分' : ''}`
  if (h > 0) return `${h}小时 ${m}分`
  if (m > 0) return `${m}分 ${s}秒`
  return `${s}秒`
}

/**
 * 生成趋势图 X 轴时间标签（本地时区）
 * @param ts 毫秒时间戳
 * @param rangeHours 时间段档位：6/24 → HH:00，168(7天) → MM-DD
 */
export function formatAxisTime(ts: number, rangeHours: number): string {
  const d = new Date(ts)
  if (rangeHours >= 168) {
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${mm}-${dd}`
  }
  return String(d.getHours()).padStart(2, '0') + ':00'
}
