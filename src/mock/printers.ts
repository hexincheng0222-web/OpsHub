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
  { id: 1, name: 'B2-仓库', floor: '-2F', location: '地下二层仓库', manufacturer: 'HP', model: 'LaserJet Pro M404dn', tonerModel: 'HP 58A (CF258A)', notes: '', ip: '192.168.1.200', inkLevel: 75, status: '正常' },
  { id: 2, name: 'B1-配电间', floor: '-1F', location: '地下一层配电间旁', manufacturer: 'Canon', model: 'iR-ADV C3530', tonerModel: 'Canon NPG-67', notes: '彩色激光', ip: '192.168.1.201', inkLevel: 18, status: '缺墨' },
  { id: 3, name: '1F-大厅', floor: '1F', location: '一楼大厅服务台', manufacturer: 'Epson', model: 'L6190', tonerModel: 'Epson 002 原装墨水', notes: '墨仓式', ip: '192.168.1.100', inkLevel: 55, status: '正常' },
  { id: 4, name: '2F-前台', floor: '2F', location: '二楼前台接待处', manufacturer: 'Brother', model: 'DCP-L2550DW', tonerModel: 'Brother TN-2420', notes: '备用机', ip: '192.168.1.220', inkLevel: 45, status: '正常' },
  { id: 5, name: '3F-东区-HP', floor: '3F', location: '三楼东区茶水间', manufacturer: 'HP', model: 'LaserJet Pro M404dn', tonerModel: 'HP 58A (CF258A)', notes: '', ip: '192.168.1.210', inkLevel: 60, status: '正常' },
  { id: 6, name: '3F-IT部', floor: '3F', location: '三楼IT运维办公室', manufacturer: 'HP', model: 'LaserJet Pro M203dw', tonerModel: 'HP 30A (CF230A)', notes: '', ip: '192.168.1.202', inkLevel: 30, status: '正常' },
  { id: 7, name: '4F-市场部', floor: '4F', location: '四楼市场部打印区', manufacturer: 'HP', model: 'Color LaserJet Pro M454dw', tonerModel: 'HP 414A 四色套装', notes: '报修中', ip: '192.168.1.230', inkLevel: 8, status: '故障' },
  { id: 8, name: '5F-财务部', floor: '5F', location: '五楼财务部办公室', manufacturer: 'HP', model: 'LaserJet MFP M437n', tonerModel: 'HP 56A (CF256A)', notes: '', ip: '192.168.1.240', inkLevel: 90, status: '正常' },
  { id: 9, name: '-2F-配电', floor: '-2F', location: '地下二层配电房', manufacturer: 'Xerox', model: 'WorkCentre 6515', tonerModel: 'Xerox 106R03780', notes: '', ip: '192.168.1.241', inkLevel: 40, status: '正常' },
  { id: 10, name: '3F-西区-Canon', floor: '3F', location: '三楼西区走廊', manufacturer: 'Canon', model: 'iR-ADV C3530', tonerModel: 'Canon NPG-67', notes: '彩色激光', ip: '192.168.1.203', inkLevel: 25, status: '缺墨' },
  { id: 11, name: '南宜-行政', floor: '南宜', location: '南宜行政楼大堂', manufacturer: 'HP', model: 'LaserJet Pro M404dn', tonerModel: 'HP 58A (CF258A)', notes: '', ip: '192.168.2.100', inkLevel: 80, status: '正常' },
  { id: 12, name: '秘园-研发', floor: '秘园', location: '秘园研发中心二楼', manufacturer: 'Canon', model: 'iR-ADV C3530', tonerModel: 'Canon NPG-67', notes: '', ip: '192.168.3.100', inkLevel: 50, status: '正常' },
  { id: 13, name: '威斯顿-综合', floor: '威斯顿', location: '威斯顿综合楼前台', manufacturer: 'Brother', model: 'DCP-L2550DW', tonerModel: 'Brother TN-2420', notes: '', ip: '192.168.4.100', inkLevel: 35, status: '正常' },
]
