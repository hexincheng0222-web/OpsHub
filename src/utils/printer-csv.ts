import type { Printer } from '../types'

const CSV_HEADERS = ['楼层', '位置', '厂商', '型号', '硒鼓型号', '备注'] as const

/** 导出打印机列表为 CSV 并触发下载 */
export function exportPrintersCSV(printers: Printer[]) {
  const header = CSV_HEADERS.join(',')
  const rows = printers.map(p => [
    escapeCSV(p.floor),
    escapeCSV(p.location),
    escapeCSV(p.manufacturer),
    escapeCSV(p.model),
    escapeCSV(p.tonerModel),
    escapeCSV(p.notes),
  ].join(','))
  const bom = '\uFEFF'
  const csv = bom + header + '\n' + rows.join('\n')
  downloadBlob(csv, '打印机清单.csv', 'text/csv;charset=utf-8')
}

/** 下载空白 CSV 模板 */
export function downloadPrinterTemplate() {
  const bom = '\uFEFF'
  const csv = bom + CSV_HEADERS.join(',') + '\n' + '3F,东区茶水间旁,HP,LaserJet Pro M404dn,HP 58A (CF258A),'
  downloadBlob(csv, '打印机导入模板.csv', 'text/csv;charset=utf-8')
}

/** 解析 CSV 文件，返回 Printer 数组 */
export function parsePrintersCSV(text: string): Partial<Printer>[] {
  // 去除 BOM
  const clean = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text
  const lines = clean.trim().split(/\r?\n/)
  if (lines.length < 2) return []
  const result: Partial<Printer>[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i])
    if (cols.length === 0 || cols.every(c => !c)) continue
    const [floor, location, manufacturer, model, tonerModel, notes] = cols
    result.push({
      floor: floor?.trim() || '',
      location: location?.trim() || '',
      manufacturer: manufacturer?.trim() || '',
      model: model?.trim() || '',
      tonerModel: tonerModel?.trim() || '',
      notes: notes?.trim() || '',
      status: '正常' as const,
    })
  }
  return result
}

function escapeCSV(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return '"' + val.replace(/"/g, '""') + '"'
  }
  return val
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        result.push(current)
        current = ''
      } else {
        current += ch
      }
    }
  }
  result.push(current)
  return result
}

function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
