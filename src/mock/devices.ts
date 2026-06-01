export interface Device {
  id: number
  name: string
  type: 'server' | 'switch' | 'storage' | 'router' | 'firewall' | 'ups' | 'pdu'
  model: string
  u: number
  ports: number
  status: '正常' | '停用'
  ip?: string
  dept?: string
}

export interface Rack {
  id: string
  name: string
  floor: string
  totalU: number
  devices: (Device | null)[]
}

export const FLOORS = ['-1F', '1F', '2F', '3F', '4F']

export const mockRacks: Rack[] = [
  {
    id: 'rack-a1',
    name: '机柜 A',
    floor: '-1F',
    totalU: 42,
    devices: [
      { id: 1, name: 'PDU-A1', type: 'pdu', model: 'APC 3kW', u: 1, ports: 0, dept: '运维部', status: '正常' },
      { id: 2, name: 'PDU-A2', type: 'pdu', model: 'APC 3kW', u: 1, ports: 0, dept: '运维部', status: '正常' },
      null,
      { id: 3, name: 'Core-SW-01', type: 'switch', model: 'S6730-H48X6C', u: 1, ports: 48, dept: '运维部', status: '正常', ip: '10.0.0.1' },
      { id: 4, name: 'Core-SW-02', type: 'switch', model: 'S6730-H48X6C', u: 1, ports: 48, dept: '运维部', status: '正常', ip: '10.0.0.2' },
      null,
      { id: 5, name: 'ESXi-01', type: 'server', model: 'Dell R750', u: 2, ports: 4, dept: '技术部', status: '正常', ip: '10.0.1.10' },
      { id: 6, name: 'ESXi-02', type: 'server', model: 'Dell R750', u: 2, ports: 4, dept: '技术部', status: '正常', ip: '10.0.1.11' },
      null, null,
      { id: 7, name: 'DB-Master', type: 'server', model: 'Dell R750xa', u: 2, ports: 4, dept: '技术部', status: '正常', ip: '10.0.1.20' },
      { id: 8, name: 'DB-Slave', type: 'server', model: 'Dell R750xa', u: 2, ports: 4, dept: '技术部', status: '正常', ip: '10.0.1.21' },
      null,
      { id: 9, name: 'SAN-01', type: 'storage', model: 'OceanStor 5310', u: 3, ports: 8, dept: '运维部', status: '正常', ip: '10.0.2.10' },
      null, null, null, null, null, null,
      { id: 10, name: 'App-01', type: 'server', model: 'Dell R650', u: 1, ports: 4, dept: '技术部', status: '正常', ip: '10.0.1.30' },
      { id: 11, name: 'App-02', type: 'server', model: 'Dell R650', u: 1, ports: 4, dept: '技术部', status: '正常', ip: '10.0.1.31' },
      { id: 12, name: 'App-03', type: 'server', model: 'Dell R650', u: 1, ports: 4, dept: '技术部', status: '正常', ip: '10.0.1.32' },
      { id: 13, name: 'App-04', type: 'server', model: 'Dell R650', u: 1, ports: 4, dept: '技术部', status: '正常', ip: '10.0.1.33' },
      null, null,
      { id: 14, name: 'FW-01', type: 'firewall', model: 'FG-100F', u: 1, ports: 16, dept: '运维部', status: '正常', ip: '10.0.0.10' },
      { id: 15, name: 'FW-02', type: 'firewall', model: 'FG-100F', u: 1, ports: 16, dept: '运维部', status: '正常', ip: '10.0.0.11' },
      null,
      { id: 16, name: 'Router-01', type: 'router', model: 'NE8000', u: 2, ports: 8, dept: '运维部', status: '正常', ip: '10.0.0.100' },
      null, null, null, null, null, null, null,
      { id: 17, name: 'UPS-A', type: 'ups', model: 'SANTAK 20KVA', u: 3, ports: 0, dept: '运维部', status: '正常' },
    ]
  },
  {
    id: 'rack-b1',
    name: '机柜 B',
    floor: '-1F',
    totalU: 42,
    devices: [
      { id: 18, name: 'PDU-B1', type: 'pdu', model: 'APC 5kW', u: 1, ports: 0, dept: '运维部', status: '正常' },
      { id: 19, name: 'PDU-B2', type: 'pdu', model: 'APC 5kW', u: 1, ports: 0, dept: '运维部', status: '正常' },
      null, null,
      { id: 20, name: 'Core-Router', type: 'router', model: 'NE40E', u: 2, ports: 16, dept: '运维部', status: '正常', ip: '10.0.0.254' },
      null,
      { id: 21, name: 'Agg-SW-01', type: 'switch', model: 'S5735-L48P4X', u: 1, ports: 48, dept: '运维部', status: '正常', ip: '10.0.0.11' },
      { id: 22, name: 'Agg-SW-02', type: 'switch', model: 'S5735-L48P4X', u: 1, ports: 48, dept: '运维部', status: '正常', ip: '10.0.0.12' },
      { id: 23, name: 'Agg-SW-03', type: 'switch', model: 'S5735-L48P4X', u: 1, ports: 48, dept: '运维部', status: '正常', ip: '10.0.0.13' },
      null, null,
      { id: 24, name: 'FW-DMZ', type: 'firewall', model: 'FG-200F', u: 1, ports: 16, dept: '运维部', status: '正常', ip: '10.0.0.20' },
      { id: 25, name: 'FW-INT', type: 'firewall', model: 'FG-200F', u: 1, ports: 16, dept: '运维部', status: '正常', ip: '10.0.0.21' },
      null,
      { id: 26, name: 'TOR-SW-01', type: 'switch', model: 'S5735-L24P4X', u: 1, ports: 24, dept: '运维部', status: '正常', ip: '10.0.0.31' },
      { id: 27, name: 'TOR-SW-02', type: 'switch', model: 'S5735-L24P4X', u: 1, ports: 24, dept: '运维部', status: '正常', ip: '10.0.0.32' },
      { id: 28, name: 'TOR-SW-03', type: 'switch', model: 'S5735-L24P4X', u: 1, ports: 24, dept: '运维部', status: '正常', ip: '10.0.0.33' },
      { id: 29, name: 'TOR-SW-04', type: 'switch', model: 'S5735-L24P4X', u: 1, ports: 24, dept: '运维部', status: '正常', ip: '10.0.0.34' },
      null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
      { id: 30, name: 'UPS-B', type: 'ups', model: 'SANTAK 30KVA', u: 3, ports: 0, dept: '运维部', status: '正常' },
    ]
  },
  {
    id: 'rack-a2',
    name: '机柜 A',
    floor: '1F',
    totalU: 12,
    devices: [
      { id: 31, name: 'Web-01', type: 'server', model: 'Dell R650', u: 1, ports: 4, dept: '技术部', status: '正常' },
      null,
      { id: 32, name: 'Web-02', type: 'server', model: 'Dell R650', u: 1, ports: 4, dept: '技术部', status: '正常' },
    ]
  },
  {
    id: 'rack-b2',
    name: '机柜 B',
    floor: '1F',
    totalU: 42,
    devices: [
      { id: 36, name: 'Dev-01', type: 'server', model: 'Dell R650', u: 1, ports: 4, dept: '技术部', status: '正常' },
      { id: 37, name: 'Dev-02', type: 'server', model: 'Dell R650', u: 1, ports: 4, dept: '技术部', status: '正常' },
      null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    ]
  },
]
