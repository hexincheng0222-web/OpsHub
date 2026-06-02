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

export const mockPrinters: Printer[] = [
  { id: 1, floor: '-2F', location: '地下二层仓库', manufacturer: 'HP', model: 'LaserJet Pro M404dn', tonerModel: 'HP 58A (CF258A)', notes: '', status: '正常' },
  { id: 2, floor: '-1F', location: '地下一层配电间旁', manufacturer: 'Canon', model: 'iR-ADV C3530', tonerModel: 'Canon NPG-67', notes: '彩色激光', status: '缺墨' },
  { id: 3, floor: '1F', location: '一楼大厅服务台', manufacturer: 'Epson', model: 'L6190', tonerModel: 'Epson 002 原装墨水', notes: '墨仓式', status: '正常' },
  { id: 4, floor: '2F', location: '二楼前台接待处', manufacturer: 'Brother', model: 'DCP-L2550DW', tonerModel: 'Brother TN-2420', notes: '备用机', status: '正常' },
  { id: 5, floor: '3F', location: '三楼东区茶水间', manufacturer: 'HP', model: 'LaserJet Pro M404dn', tonerModel: 'HP 58A (CF258A)', notes: '', status: '正常' },
  { id: 6, floor: '3F', location: '三楼IT运维办公室', manufacturer: 'HP', model: 'LaserJet Pro M203dw', tonerModel: 'HP 30A (CF230A)', notes: '', status: '正常' },
  { id: 7, floor: '4F', location: '四楼市场部打印区', manufacturer: 'HP', model: 'Color LaserJet Pro M454dw', tonerModel: 'HP 414A 四色套装', notes: '报修中', status: '故障' },
  { id: 8, floor: '5F', location: '五楼财务部办公室', manufacturer: 'HP', model: 'LaserJet MFP M437n', tonerModel: 'HP 56A (CF256A)', notes: '', status: '正常' },
  { id: 9, floor: '-2F', location: '地下二层配电房', manufacturer: 'Xerox', model: 'WorkCentre 6515', tonerModel: 'Xerox 106R03780', notes: '', status: '正常' },
  { id: 10, floor: '3F', location: '三楼西区走廊', manufacturer: 'Canon', model: 'iR-ADV C3530', tonerModel: 'Canon NPG-67', notes: '彩色激光', status: '缺墨' },
  { id: 11, floor: '南宜', location: '南宜行政楼大堂', manufacturer: 'HP', model: 'LaserJet Pro M404dn', tonerModel: 'HP 58A (CF258A)', notes: '', status: '正常' },
  { id: 12, floor: '秘园', location: '秘园研发中心二楼', manufacturer: 'Canon', model: 'iR-ADV C3530', tonerModel: 'Canon NPG-67', notes: '', status: '正常' },
  { id: 13, floor: '威斯顿', location: '威斯顿综合楼前台', manufacturer: 'Brother', model: 'DCP-L2550DW', tonerModel: 'Brother TN-2420', notes: '', status: '正常' },
]
