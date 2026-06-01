// src/components/devices/useDragDrop.ts
import { reactive, onMounted, onBeforeUnmount } from 'vue'
import type { Rack, Device } from '../../mock/devices'
import { canPlaceAt } from '../../utils/rack-utils'

interface DragState {
  active: boolean
  sourceRackId: string
  sourceOffset: number
  deviceId: number
  device: Device | null
  targetRackId: string
  targetOffset: number
  ghostEl: HTMLElement | null
  sourceEl: HTMLElement | null
}

const dragState = reactive<DragState>({
  active: false, sourceRackId: '', sourceOffset: -1, deviceId: -1, device: null,
  targetRackId: '', targetOffset: -1, ghostEl: null, sourceEl: null,
})

export function useDragDrop(
  racks: () => Rack[],
  onMove: (sourceRackId: string, targetRackId: string, targetOffset: number, deviceId: number) => void
) {
  function onMouseDown(e: MouseEvent, device: Device, rackId: string, slotOffset: number) {
    const slotEl = (e.target as HTMLElement).closest('.u-slot') as HTMLElement
    if (!slotEl) return
    dragState.active = true
    dragState.sourceRackId = rackId
    dragState.sourceOffset = slotOffset
    dragState.deviceId = device.id
    dragState.device = device
    dragState.sourceEl = slotEl

    const ghost = document.createElement('div')
    ghost.className = 'drag-ghost'
    ghost.textContent = device.name
    ghost.style.cssText = 'position:fixed;z-index:9999;pointer-events:none;padding:4px 10px;border-radius:4px;font-size:12px;color:#fff;background:rgba(74,222,128,0.9);border:2px solid #4ade80;box-shadow:0 4px 12px rgba(0,0,0,0.4);left:' + (e.clientX - 40) + 'px;top:' + (e.clientY - 12) + 'px;'
    document.body.appendChild(ghost)
    dragState.ghostEl = ghost
    slotEl.classList.add('drag-source')
    document.addEventListener('selectstart', preventSelect)
  }

  function onMouseMove(e: MouseEvent) {
    if (!dragState.active || !dragState.ghostEl) return
    dragState.ghostEl.style.left = (e.clientX - 40) + 'px'
    dragState.ghostEl.style.top = (e.clientY - 12) + 'px'
    dragState.ghostEl.style.display = 'none'
    const elUnder = document.elementFromPoint(e.clientX, e.clientY)
    dragState.ghostEl.style.display = ''
    clearHighlights()
    if (!elUnder) return
    const targetSlot = elUnder.closest('.u-slot') as HTMLElement
    if (!targetSlot) return
    const targetRackId = targetSlot.dataset.rackId || ''
    const targetOffset = parseInt(targetSlot.dataset.uOffset || '-1', 10)
    if (targetOffset < 0 || !targetRackId) return
    dragState.targetRackId = targetRackId
    dragState.targetOffset = targetOffset
    const targetRack = racks().find(r => r.id === targetRackId)
    if (!targetRack) return
    const ok = canPlaceAt(targetRack, targetOffset, dragState.device!.u, dragState.deviceId)
    highlightDropZone(targetRackId, targetOffset, dragState.device!.u, ok)
  }

  function onMouseUp() {
    if (!dragState.active) return
    if (dragState.ghostEl) { dragState.ghostEl.remove(); dragState.ghostEl = null }
    if (dragState.sourceEl) { dragState.sourceEl.classList.remove('drag-source') }
    clearHighlights()
    if (dragState.targetRackId && dragState.targetOffset >= 0) {
      const targetRack = racks().find(r => r.id === dragState.targetRackId)
      if (targetRack && canPlaceAt(targetRack, dragState.targetOffset, dragState.device!.u, dragState.deviceId)) {
        onMove(dragState.sourceRackId, dragState.targetRackId, dragState.targetOffset, dragState.deviceId)
      }
    }
    dragState.active = false; dragState.sourceRackId = ''; dragState.sourceOffset = -1
    dragState.deviceId = -1; dragState.device = null; dragState.targetRackId = ''
    dragState.targetOffset = -1; dragState.ghostEl = null; dragState.sourceEl = null
    document.removeEventListener('selectstart', preventSelect)
  }

  function highlightDropZone(rackId: string, offset: number, uSize: number, ok: boolean) {
    const slots = document.querySelectorAll('.u-slot[data-rack-id="' + rackId + '"]')
    const cls = ok ? 'drop-ok' : 'drop-no'
    for (const slot of slots) {
      const so = parseInt((slot as HTMLElement).dataset.uOffset || '-1', 10)
      if (so >= offset && so < offset + uSize) {
        slot.classList.add(cls)
      }
    }
  }

  function clearHighlights() {
    document.querySelectorAll('.u-slot.drop-ok, .u-slot.drop-no').forEach(el => {
      el.classList.remove('drop-ok', 'drop-no')
    })
  }

  function preventSelect(e: Event) { e.preventDefault() }

  onMounted(() => { document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp) })
  onBeforeUnmount(() => { document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); document.removeEventListener('selectstart', preventSelect) })

  return { onMouseDown }
}
