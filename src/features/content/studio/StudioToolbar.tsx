'use client'

/**
 * Barra do estúdio: INSERIR elementos livres (texto, retângulo, elipse, linha,
 * imagem via upload), ALINHAR (1 sel = slide; 2+ = caixa da seleção),
 * DISTRIBUIR espaçamento (3+) e AGRUPAR/DESAGRUPAR (⌘G / ⌘⇧G). Mudanças em
 * lote viram UM snapshot de undo (applyMoves).
 */
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalSpaceAround,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalSpaceAround,
  Circle,
  Group,
  ImagePlus,
  Loader2,
  Minus,
  Square,
  Type,
  Ungroup,
} from 'lucide-react'
import type { BrandKit, UserNode } from '@publisher/scene-engine'
import { Button } from '@/components/ui/button'
import { uploadSlideImage } from './api/studio-api'
import { newUserNodeId } from './lib/scene-payload'
import { computeAlign, computeDistribute, type AlignMode } from './lib/align'
import type { SelectBox } from './lib/selectable'
import { useStudioStore, type BatchMove } from './studio-store'

interface StudioToolbarProps {
  contentId: string
  kit: BrandKit
  boxes: SelectBox[]
}

const ALIGNS: Array<{ mode: AlignMode; icon: typeof AlignStartVertical; label: string }> = [
  { mode: 'left', icon: AlignStartVertical, label: 'Alinhar à esquerda' },
  { mode: 'centerH', icon: AlignCenterVertical, label: 'Centralizar horizontal' },
  { mode: 'right', icon: AlignEndVertical, label: 'Alinhar à direita' },
  { mode: 'top', icon: AlignStartHorizontal, label: 'Alinhar ao topo' },
  { mode: 'middleV', icon: AlignCenterHorizontal, label: 'Centralizar vertical' },
  { mode: 'bottom', icon: AlignEndHorizontal, label: 'Alinhar à base' },
]

export function StudioToolbar({ contentId, kit, boxes }: StudioToolbarProps) {
  const activeIndex = useStudioStore((s) => s.activeIndex)
  const selectedIds = useStudioStore((s) => s.selectedIds)
  const groups = useStudioStore((s) => s.groups)
  const addNode = useStudioStore((s) => s.addNode)
  const applyMoves = useStudioStore((s) => s.applyMoves)
  const groupSelection = useStudioStore((s) => s.groupSelection)
  const ungroupSelection = useStudioStore((s) => s.ungroupSelection)
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const add = (node: UserNode) => addNode(activeIndex, node)
  const inGroup = selectedIds.some((id) =>
    Object.values(groups[activeIndex] ?? {}).some((members) => members.includes(id)),
  )

  function addText() {
    add({ kind: 'text', id: newUserNodeId(), frame: { x: 340, y: 480, w: 400, h: 0 }, text: 'Escreva aqui', role: 'body', weight: 700, size: 36, fill: kit.palette.ink })
  }
  function addRect() {
    add({ kind: 'rect', id: newUserNodeId(), frame: { x: 390, y: 440, w: 300, h: 200 }, fill: kit.palette.accent, radius: 12 })
  }
  function addEllipse() {
    add({ kind: 'ellipse', id: newUserNodeId(), frame: { x: 440, y: 440, w: 200, h: 200 }, fill: kit.palette.bgRose, stroke: kit.palette.accent, strokeWidth: 2 })
  }
  function addLine() {
    add({ kind: 'line', id: newUserNodeId(), x1: 290, y1: 540, x2: 790, y2: 540, stroke: kit.palette.ink, strokeWidth: 3 })
  }

  async function onPickImage(file: File | undefined) {
    if (!file) return
    setUploading(true)
    try {
      const { imageUrl } = await uploadSlideImage(contentId, activeIndex, file)
      add({ kind: 'image', id: newUserNodeId(), frame: { x: 340, y: 340, w: 400, h: 400 }, src: imageUrl, fit: 'cover', radius: 8 })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha no upload da imagem')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  /** aplica deltas (alinhar/distribuir) num lote único. */
  function applyDeltas(deltas: Map<string, { dx: number; dy: number }>) {
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
  }

  const selectedBoxes = boxes.filter((b) => selectedIds.includes(b.id))

  return (
    <div className="flex items-center gap-1 overflow-x-auto border-b px-3 py-1.5">
      <span className="mr-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Inserir</span>
      <Button variant="ghost" size="sm" onClick={addText} title="Texto">
        <Type className="size-4" />
      </Button>
      <Button variant="ghost" size="sm" onClick={addRect} title="Retângulo">
        <Square className="size-4" />
      </Button>
      <Button variant="ghost" size="sm" onClick={addEllipse} title="Elipse">
        <Circle className="size-4" />
      </Button>
      <Button variant="ghost" size="sm" onClick={addLine} title="Linha">
        <Minus className="size-4" />
      </Button>
      <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading} title="Imagem">
        {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
      </Button>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onPickImage(e.target.files?.[0])} />

      <div className="mx-2 h-5 w-px bg-border" />
      <span className="mr-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Alinhar</span>
      {ALIGNS.map(({ mode, icon: Icon, label }) => (
        <Button key={mode} variant="ghost" size="sm" disabled={!selectedIds.length} onClick={() => applyDeltas(computeAlign(selectedBoxes, mode))} title={label}>
          <Icon className="size-4" />
        </Button>
      ))}
      <Button variant="ghost" size="sm" disabled={selectedIds.length < 3} onClick={() => applyDeltas(computeDistribute(selectedBoxes, 'h'))} title="Distribuir horizontal (3+)">
        <AlignHorizontalSpaceAround className="size-4" />
      </Button>
      <Button variant="ghost" size="sm" disabled={selectedIds.length < 3} onClick={() => applyDeltas(computeDistribute(selectedBoxes, 'v'))} title="Distribuir vertical (3+)">
        <AlignVerticalSpaceAround className="size-4" />
      </Button>

      <div className="mx-2 h-5 w-px bg-border" />
      <Button variant="ghost" size="sm" disabled={selectedIds.length < 2} onClick={() => groupSelection(activeIndex)} title="Agrupar (⌘G)">
        <Group className="size-4" />
      </Button>
      <Button variant="ghost" size="sm" disabled={!inGroup} onClick={() => ungroupSelection(activeIndex)} title="Desagrupar (⌘⇧G)">
        <Ungroup className="size-4" />
      </Button>
      {selectedIds.length > 1 && (
        <span className="ml-2 shrink-0 text-[11px] text-muted-foreground">
          {selectedIds.length} selecionados{inGroup ? ' · grupo' : ''}
        </span>
      )}
    </div>
  )
}
