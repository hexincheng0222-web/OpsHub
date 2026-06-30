/**
 * 格式化时间字符串为本地化格式
 * @param time ISO 时间字符串或时间戳
 * @returns 格式化后的时间字符串
 */
export function formatTime(time: string | number | undefined | null): string {
  if (!time) return '—'
  const d = new Date(time)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString('zh-CN', { hour12: false })
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
