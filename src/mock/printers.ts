export interface Printer {
  id: number
  name: string
  floor: string
  location: string
  manufacturer: string
  model: string
  tonerModel: string
  notes: string
  ip: string
  inkLevel: number
  status: '正常' | '缺墨' | '故障'
}

export const PRINTER_HEADERS = ['楼层', '位置', '厂商', '型号', '硒鼓型号', '备注'] as const

export const mockPrinters: Printer[] = [
  { id: 1, name: '3楼-东区-HP', floor: '3F', location: '东区茶水间旁', manufacturer: 'HP', model: 'LaserJet Pro M404dn', tonerModel: 'HP 58A (CF258A)', notes: '', ip: '192.168.1.200', inkLevel: 75, status: '正常' },
  { id: 2, name: '3楼-西区-Canon', floor: '3F', location: '西区走廊', manufacturer: 'Canon', model: 'iR-ADV C3530', tonerModel: 'Canon NPG-67', notes: '彩色激光', ip: '192.168.1.201', inkLevel: 18, status: '缺墨' },
  { id: 3, name: '5楼-财务部', floor: '5F', location: '财务部办公室', manufacturer: 'HP', model: 'LaserJet MFP M437n', tonerModel: 'HP 56A (CF256A)', notes: '', ip: '192.168.1.210', inkLevel: 60, status: '正常' },
  { id: 4, name: '2楼-前台', floor: '2F', location: '前台接待处', manufacturer: 'Brother', model: 'DCP-L2550DW', tonerModel: 'Brother TN-2420', notes: '备用机', ip: '192.168.1.220', inkLevel: 45, status: '正常' },
  { id: 5, name: '4楼-市场部', floor: '4F', location: '市场部打印区', manufacturer: 'HP', model: 'Color LaserJet Pro M454dw', tonerModel: 'HP 414A 四色套装', notes: '报修中', ip: '192.168.1.230', inkLevel: 8, status: '故障' },
  { id: 6, name: '6楼-总经理办', floor: '6F', location: '总经理办公室', manufacturer: 'Xerox', model: 'WorkCentre 6515', tonerModel: 'Xerox 106R03780', notes: '', ip: '192.168.1.240', inkLevel: 90, status: '正常' },
  { id: 7, name: '1楼-大厅', floor: '1F', location: '一楼大厅服务台', manufacturer: 'Epson', model: 'L6190', tonerModel: 'Epson 002 原装墨水', notes: '墨仓式', ip: '192.168.1.100', inkLevel: 55, status: '正常' },
  { id: 8, name: '3楼-IT部', floor: '3F', location: 'IT运维办公室', manufacturer: 'HP', model: 'LaserJet Pro M203dw', tonerModel: 'HP 30A (CF230A)', notes: '', ip: '192.168.1.202', inkLevel: 30, status: '正常' },
]
