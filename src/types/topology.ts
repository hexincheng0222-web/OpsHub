// src/types/topology.ts
export interface TopologyNode {
  device_id: number
  x: number
  y: number
  name: string
  type: string
  model: string
  status: string
  ip: string | null
  monitor_enabled: number
  abbr: string | null
  color: string | null
}

export interface TopologyEdge {
  id: number
  source_device_id: number
  source_device_name: string
  source_port: string
  target_device_id: number
  target_device_name: string
  target_port: string
  protocol: string
}

export interface TopologyData {
  nodes: TopologyNode[]
  edges: TopologyEdge[]
}
