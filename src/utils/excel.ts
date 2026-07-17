/**
 * Excel (.xlsx) 导入/导出工具，基于 SheetJS (xlsx)
 */
import * as XLSX from 'xlsx'

/**
 * 公式注入防护：单元格值若以 = + - @ \t \r 开头，前置单引号让 Excel 当作文本
 * SheetJS 没有内置 sanitize，需在写入 cell 前手动处理
 */
function sanitizeCell(v: string | number | boolean): string | number | boolean {
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(v)) {
    return "'" + v
  }
  return v
}

/**
 * 导出二维数据为 .xlsx 文件
 * @param headers 表头数组
 * @param rows    数据行数组（每行为字段数组）
 * @param filename 文件名（不含扩展名）
 * @param sheetName 工作表名
 */
export function downloadXlsx(
  headers: string[],
  rows: (string | number | boolean)[] | (string | number | boolean)[][],
  filename: string,
  sheetName = 'Sheet1',
) {
  const safeRows = (rows as any[]).map(r =>
    (Array.isArray(r) ? r : [r]).map(sanitizeCell)
  )
  const aoa = [headers, ...safeRows]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

/**
 * 解析 .xlsx 文件为首行表头 + 数据行
 * @param file 用户选择的文件
 * @returns { headers: string[], rows: string[][] }
 */
export async function parseXlsx(file: File): Promise<{ headers: string[]; rows: string[][] }> {
  const buf = await file.arrayBuffer()
  // cellDates: 让日期单元格返回 Date 对象；raw: false 让日期按 cellText 格式化（YYYY-MM-DD）
  const wb = XLSX.read(buf, { type: 'array', cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const aoa: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false })
  if (aoa.length === 0) return { headers: [], rows: [] }
  const headers = (aoa[0] as unknown[]).map(c => String(c ?? '').trim())
  const colCount = headers.length
  const rows = aoa.slice(1).map(r => {
    const arr = (r as unknown[]).map(c => {
      if (c instanceof Date) return c.toISOString().slice(0, 10)  // Date → YYYY-MM-DD
      return String(c ?? '').trim()
    })
    // 补齐长度不足 header 的行
    while (arr.length < colCount) arr.push('')
    return arr.slice(0, colCount)
  })
  return { headers, rows }
}
