import { downloadXlsx } from './excel'
import type { Printer } from '../types'

// 导出 xlsx（轻量：走 downloadXlsx / SheetJS，不引入 ExcelJS，不带单元格染色）
export function exportPrintersXlsx(printers: Printer[]) {
  const headers = ['楼层', '位置', '厂商', '型号', '硒鼓型号', '备注', '状态']
  const rows = printers.map(p => [p.floor, p.location, p.manufacturer, p.model, p.tonerModel, p.notes, p.status])
  return downloadXlsx(headers, rows, '打印机清单', '打印机')
}
