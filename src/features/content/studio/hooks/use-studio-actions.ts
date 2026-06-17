'use client'

/**
 * Ações sobre a seleção (compartilhadas pela toolbar e pelo menu de contexto):
 * alinhar, distribuir, agrupar/desagrupar, frente/trás, deletar.
 * Mudanças posicionais em lote = 1 snapshot de undo (applyMoves).
 */
import { useCallback } from 'react'
import type { UserNode } from '@publisher/scene-engine'
import { computeAlign, computeDistribute, type AlignMode } from '../lib/align'
import type { SelectBox } from '../lib/selectable'
import { useStudioStore, type BatchMove } from '../studio-store'

export function useStudioActions(boxes: SelectBox[]) {
  const activeIndex = useStudioStore((s) => s.activeIndex)
  const selectedIds = useStudioStore((s) => s.selectedIds)
  const groups = useStudioStore((s) => s.groups)
  const applyMoves = useStudioStore((s) => s.applyMoves)
  const groupSelection = useStudioStore((s) => s.groupSelection)
  const ungroupSelection = useStudioStore((s) => s.ungroupSelection)
  const removeNode = useStudioStore((s) => s.removeNode)
  const setOverride = useStudioStore((s) => s.setOverride)
  const reorderNode = useStudioStore((s) => s.reorderNode)
  const select = useStudioStore((s) => s.select)

  const selectedBoxes = boxes.filter((b) => selectedIds.includes(b.id))
  const inGroup = selectedIds.some((id) =>
    Object.values(groups[activeIndex] ?? {}).some((members) => members.includes(id)),
  )
  const singleUser = selectedIds.length === 1 && selectedIds[0]!.startsWith('user/') ? selectedIds[0]! : null

  const applyDeltas = useCallback(
    (deltas: Map<string, { dx: number; dy: number }>) => {
      const { added, overrides } = useStudioStore.getState()
      const moves: BatchMove[] = []
      for (const b of boxes) {
        const d = deltas.get(b.id)
        if (!d || (d.dx === 0 && d.dy === 0)) continue
        if (b.user) {
          const n = (added[activeIndex] ?? []).find((x) => x.id === b.id)
          if (!n) continue
          if (n.kind === 'line') moves.push({ type: 'user', id: b.id, patch: { x1: n.x1 + d.dx, y1: n.y1 + d.dy, x2: n.x2 + d.dx, y2: n.y2 + d.dy } as Partial<UserNode> })
          else moves.push({ type: 'user', id: b.id, patch: { frame: { ...n.frame, x: n.frame.x + d.dx, y: n.frame.y + d.dy } } as Partial<UserNode> })
        } else if (b.kind === 'rect') {
          moves.push({ type: 'override', id: b.id, patch: { frame: { x: b.x + d.dx, y: b.y + d.dy, w: b.w, h: b.h } } })
        } else {
          const cur = overrides[activeIndex]?.[b.id]?.frame
          moves.push({ type: 'override', id: b.id, patch: { frame: { x: (cur?.x ?? 0) + d.dx, y: (cur?.y ?? 0) + d.dy } } })
        }
      }
      applyMoves(activeIndex, moves)
    },
    [boxes, activeIndex, applyMoves],
  )

  return {
    selectedIds,
    selectedBoxes,
    inGroup,
    singleUser,
    align: (mode: AlignMode) => applyDeltas(computeAlign(selectedBoxes, mode)),
    distribute: (axis: 'h' | 'v') => applyDeltas(computeDistribute(selectedBoxes, axis)),
    group: () => groupSelection(activeIndex),
    ungroup: () => ungroupSelection(activeIndex),
    bringFront: () => singleUser && reorderNode(activeIndex, singleUser, 'front'),
    sendBack: () => singleUser && reorderNode(activeIndex, singleUser, 'back'),
    deleteSelection: () => {
      for (const id of selectedIds) {
        if (id.startsWith('user/')) removeNode(activeIndex, id)
        else setOverride(activeIndex, id, { hidden: true })
      }
      select(null)
    },
  }
}
