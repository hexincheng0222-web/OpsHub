// src/api/topology.ts
import { request } from '../utils/http'
import type { TopologyData, TopologyEdge, TopologyNode } from '../types/topology'

const BASE = '/api/v1/topology'

export async function fetchTopology(): Promise<TopologyData> {
  return request(BASE)
}

export async function addTopologyNode(deviceId: number, x?: number, y?: number): Promise<TopologyNode> {
  return request(`${BASE}/nodes`, {
    method: 'POST',
    body: JSON.stringify({ device_id: deviceId, x, y }),
  })
}

export async function updateTopologyNodePosition(deviceId: number, x: number, y: number): Promise<void> {
  await request(`${BASE}/nodes/${deviceId}`, {
    method: 'PUT',
    body: JSON.stringify({ x, y }),
  })
}

export async function bulkUpdateTopologyNodes(nodes: { device_id: number; x: number; y: number }[]): Promise<void> {
  await request(`${BASE}/nodes`, {
    method: 'PUT',
    body: JSON.stringify({ nodes }),
  })
}

export async function removeTopologyNode(deviceId: number): Promise<void> {
  await request(`${BASE}/nodes/${deviceId}`, { method: 'DELETE' })
}

export async function addTopologyEdge(payload: {
  source_device_id: number
  source_port: string
  target_device_id: number
  target_port: string
  protocol?: string
}): Promise<TopologyEdge> {
  return request(`${BASE}/edges`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function removeTopologyEdge(id: number): Promise<void> {
  await request(`${BASE}/edges/${id}`, { method: 'DELETE' })
}
