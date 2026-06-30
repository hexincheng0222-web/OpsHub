export interface DashboardStats {
  services: number
  manuals: number
  devices: number
  printers: number
  computers: number
  procurementPhones: number
  lmDevices: number
  phones: number
  phonesOnline: number
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const res = await fetch('/api/v1/dashboard/stats')
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  if (json.code >= 400) throw new Error(json.message || `错误码 ${json.code}`)
  return json.data
}