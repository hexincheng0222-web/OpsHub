/**
 * CSV 工具函数 — 防御公式注入 (OWASP CSV Injection)
 *
 * Excel/WPS 会将单元格开头为 `= + - @ TAB CR` 的内容当作公式执行。
 * 本模块统一提供 escapeCsvField，所有 CSV 导出必须经过此函数。
 */

/**
 * 转义 CSV 字段值（含公式注入防护）
 *
 * - 若值以 `= + - @ \t \r` 开头，前置单引号 `'` 让 Excel 当作文本
 * - 若值包含逗号/引号/换行，整体用双引号包裹并转义内部引号
 */
export function escapeCsvField(v: unknown): string {
  let s = (v ?? '').toString()
  // 公式注入防护：危险前缀前置单引号
  if (/^[=+\-@\t\r]/.test(s)) {
    s = "'" + s
  }
  // 含特殊字符 → 双引号包裹
  if (/[,"\n\r]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

/**
 * 下载 CSV 文件（UTF-8 BOM，支持中文 Excel 打开）
 */
export function downloadCsv(header: string, rows: string[], filename: string) {
  const bom = '\uFEFF'
  const csv = bom + header + '\n' + rows.join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
