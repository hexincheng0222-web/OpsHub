// src/composables/useTopologyLayout.ts — 拓扑自动布局（纯函数）
// 按「核心→接入」语义分列：路由器最左，核心交换机中间，服务器/存储最右。

export const TOPO_W = 1600
export const TOPO_H = 900
export const NODE_W = 150
export const NODE_H = 50
const COL_GAP = 200
const ROW_STEP = 90
const MARGIN = 60

/** 计算每台设备的列号（越小越靠左） */
export function columnFor(type: string, name: string): number {
  switch (type) {
    case 'router': return 0
    case 'firewall': return 1
    case 'switch': {
      const n = name.toLowerCase()
      if (n.includes('core') || n.includes('核心')) return 2
      if (n.includes('agg') || n.includes('汇聚')) return 3
      return 2
    }
    case 'server': return 5
    case 'storage': return 6
    case 'ups': return 7
    case 'pdu': return 8
    default: return 4
  }
}

export interface LayoutInput {
  device_id: number
  name: string
  type: string
}

export function computeLayout(devices: LayoutInput[]): Map<number, { x: number; y: number }> {
  // 按列分组，列内按名称排序
  const columns = new Map<number, LayoutInput[]>()
  for (const d of devices) {
    const c = columnFor(d.type, d.name)
    if (!columns.has(c)) columns.set(c, [])
    columns.get(c)!.push(d)
  }
  for (const list of columns.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
  }

  // 最大行数决定垂直方向总高度
  const maxRows = Math.max(...[...columns.values()].map(l => l.length), 1)
  const totalH = maxRows * ROW_STEP
  const startY = Math.max(0, (TOPO_H - totalH) / 2)

  const result = new Map<number, { x: number; y: number }>()
  for (const [col, list] of columns) {
    // 列中心 x：MARGIN + col*(NODE_W+COL_GAP) + NODE_W/2（节点渲染按中心点）
    const x = MARGIN + col * (NODE_W + COL_GAP) + NODE_W / 2
    const colStartY = Math.max(0, startY + (maxRows - list.length) * ROW_STEP / 2)
    list.forEach((d, i) => {
      const y = colStartY + i * ROW_STEP
      result.set(d.device_id, {
        x: Math.max(NODE_W / 2, Math.min(x, TOPO_W - NODE_W / 2)),
        y: Math.max(NODE_H / 2, Math.min(y, TOPO_H - NODE_H / 2)),
      })
    })
  }
  return result
}
