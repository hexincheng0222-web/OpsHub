export interface Printer {
  id: number
  floor: string
  location: string
  manufacturer: string
  model: string
  tonerModel: string
  notes: string
  status: '正常' | '缺墨' | '故障'
}

export const PRINTER_HEADERS = ['楼层', '位置', '厂商', '型号', '硒鼓型号', '备注'] as const

