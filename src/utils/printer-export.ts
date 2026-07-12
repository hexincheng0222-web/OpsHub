import { downloadXlsx } from './excel'
import type { Printer } from '../types'

// 导出 xlsx（轻量：走 downloadXlsx / SheetJS，不引入 ExcelJS，不带单元格染色）
export function exportPrintersXlsx(printers: Printer[]) {
  const headers = ['楼层', '位置', '厂商', '型号', '硒鼓型号', '备注', '状态']
  const rows = printers.map(p => [p.floor, p.location, p.manufacturer, p.model, p.tonerModel, p.notes, p.status])
  return downloadXlsx(headers, rows, '打印机清单', '打印机')
}

// 下载导入模板（CSV 格式，含 3 行示例，带 UTF-8 BOM 防止 Excel 乱码）
export function downloadPrinterTemplate() {
  const CSV_HEADERS = ['楼层', '位置', '厂商', '型号', '硒鼓型号', '备注', '状态']
  const csv = '﻿' + CSV_HEADERS.join(',') + '\n'
    + '3F,东区茶水间旁,HP,LaserJet Pro M404dn,HP 58A (CF258A),,正常\n'
    + '3F,西区会议室,Canon,imageCLASS MF4570dw,Canon C-EXV 55,,正常\n'
    + '2F,前台,HP,LaserJet MFP M430f,HP 59X,,缺墨'
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = '打印机导入模板.csv'
  a.click()
  URL.revokeObjectURL(url)
}
