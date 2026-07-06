import { request } from '../utils/http'

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

export function fetchDashboardStats(): Promise<DashboardStats> {
  return request<DashboardStats>('/api/v1/dashboard/stats')
}