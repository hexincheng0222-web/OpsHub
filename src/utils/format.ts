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
