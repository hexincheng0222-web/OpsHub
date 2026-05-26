export interface Printer {
  id: number; name: string; model: string; ip: string; location: string; inkLevel: number; status: string
}
export const mockPrinters: Printer[] = [
  { id: 1, name: '3楼-东区-HP', model: 'HP LaserJet Pro M404dn', ip: '192.168.1.200', location: '3楼东区茶水间旁', inkLevel: 75, status: '正常' },
  { id: 2, name: '3楼-西区-Canon', model: 'Canon iR-ADV C3530', ip: '192.168.1.201', location: '3楼西区走廊', inkLevel: 18, status: '缺墨' },
  { id: 3, name: '5楼-财务部', model: 'HP LaserJet MFP M437n', ip: '192.168.1.210', location: '5楼财务部办公室', inkLevel: 60, status: '正常' },
  { id: 4, name: '2楼-前台', model: 'Brother DCP-L2550DW', ip: '192.168.1.220', location: '2楼前台接待处', inkLevel: 45, status: '正常' },
  { id: 5, name: '4楼-市场部', model: 'HP Color LaserJet Pro M454dw', ip: '192.168.1.230', location: '4楼市场部打印区', inkLevel: 8, status: '故障' },
  { id: 6, name: '6楼-总经理办', model: 'Xerox WorkCentre 6515', ip: '192.168.1.240', location: '6楼总经理办公室', inkLevel: 90, status: '正常' }
]
