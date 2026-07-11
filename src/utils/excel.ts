/**
 * Excel (.xlsx) 导入/导出工具，基于 SheetJS (xlsx)
 */
import * as XLSX from 'xlsx'

/**
 * 导出二维数据为 .xlsx 文件
 * @param headers 表头数组
 * @param rows    数据行数组（每行为字段数组）
 * @param filename 文件名（不含扩展名）
 * @param sheetName 工作表名
 */
export function downloadXlsx(
  headers: string[],
  rows: (string | number | boolean)[],
  filename: string,
  sheetName = 'Sheet1',
) {
  const aoa = [headers, ...rows.map(r => Array.isArray(r) ? r : [r])]
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
  const wb = XLSX.read(buf, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const aoa: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
  if (aoa.length === 0) return { headers: [], rows: [] }
  const headers = (aoa[0] as unknown[]).map(c => String(c ?? '').trim())
  const rows = aoa.slice(1).map(r =>
    (r as unknown[]).map(c => String(c ?? '').trim()),
  )
  return { headers, rows }
}
