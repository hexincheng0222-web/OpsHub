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
