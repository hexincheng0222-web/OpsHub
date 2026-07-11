// utils/printer-table-helper.ts
export interface PrinterTableRow {
  printer: { id: number; manufacturer: string; model: string; location: string; floor: string; tonerModel: string; notes: string; status: string }
  count: number
  ids: number[]
  isFirstInLocation: boolean
  locationSpan: number
  locationOdd: boolean
}

export interface FloorGroup {
  floor: string
  rows: PrinterTableRow[]
  totalCount: number
}

/** 楼层排序权重 */
export function floorWeight(f: string): number {
  const map: Record<string, number> = {
    '负二楼': -20, '负一楼': -10, '负0.5': -5,
    '一楼': 1, '二楼': 2, '三楼': 3, '四楼': 4, '五楼': 5, '六楼': 6, '七楼': 7, '八楼': 8, '九楼': 9, '十楼': 10,
  }
  if (map[f] !== undefined) return map[f]
  const m = f.match(/负?(\d+(\.\d+)?)F?/)
  if (m) return f.startsWith('负') ? -parseFloat(m[1]) : parseFloat(m[1])
  return 999
}

export function buildFloorGroups(
  printers: { id: number; manufacturer: string; model: string; location: string; floor: string; tonerModel: string; notes: string; status: string }[],
  selectedFloors: Set<string> | string | null,
  searchQuery: string,
  statusFilter = ''
): FloorGroup[] {
  let filtered = printers

  if (statusFilter) filtered = filtered.filter(p => p.status === statusFilter)

  if (selectedFloors instanceof Set && selectedFloors.size > 0) {
    filtered = filtered.filter(p => selectedFloors.has(p.floor))
  } else if (selectedFloors && typeof selectedFloors === 'string') {
    filtered = filtered.filter(p => p.floor === selectedFloors)
  }

  const q = searchQuery.toLowerCase()
  if (q) {
    filtered = filtered.filter(p =>
      p.manufacturer.toLowerCase().includes(q) ||
      p.model.toLowerCase().includes(q) ||
      p.location.toLowerCase().includes(q) ||
      p.tonerModel.toLowerCase().includes(q)
    )
  }

  // 按楼层分组
  const floorMap = new Map<string, typeof printers>()
  for (const p of filtered) {
    const list = floorMap.get(p.floor) || []; list.push(p); floorMap.set(p.floor, list)
  }

  return [...floorMap.entries()]
    .sort(([a], [b]) => floorWeight(a) - floorWeight(b))
    .map(([floor, printers]) => {
      // 按位置分组
      const locMap = new Map<string, typeof printers>()
      for (const p of printers) {
        const key = p.location || '未分配'
        const list = locMap.get(key) || []; list.push(p); locMap.set(key, list)
      }

      const rows: PrinterTableRow[] = []
      let locIdx = 0
      for (const [, locPrinters] of locMap) {
        const modelMap = new Map<string, typeof printers>()
        for (const p of locPrinters) {
          const key = `${p.manufacturer}|${p.model}`
          const list = modelMap.get(key) || []; list.push(p); modelMap.set(key, list)
        }
        const modelEntries = [...modelMap.values()]
        const locationSpan = modelEntries.length
        const locationOdd = locIdx % 2 === 0

        modelEntries.forEach((group, idx) => {
          rows.push({
            printer: group[0],
            count: group.length,
            ids: group.map(p => p.id),
            isFirstInLocation: idx === 0,
            locationSpan,
            locationOdd,
          })
        })
        locIdx++
      }
      return { floor, rows, totalCount: printers.length }
    })
}