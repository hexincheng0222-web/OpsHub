/**
 * 下载 CSV 文件（UTF-8 BOM，支持中文 Excel 打开）
 */
export function downloadCsv(header: string, rows: string[], filename: string) {
  const bom = '﻿'
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

/**
 * 转义 CSV 字段值
 */
export function escapeCsvField(v: unknown): string {
  return `"${(v ?? '').toString().replace(/"/g, '""')}"`
}
