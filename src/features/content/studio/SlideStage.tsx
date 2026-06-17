'use client'

/**
 * Palco de um slide. Pixels = <canvas> pintado pelo MESMO paintSlide do server.
 * Por cima, Stage react-konva transparente só pra INTERAÇÃO: seleção (shift =
 * múltipla; clicar em membro de grupo seleciona o grupo inteiro; MARQUEE =
 * arrastar na área vazia seleciona tudo que intersecta, shift adiciona), drag
 * com snapping e DRAG DE GRUPO (membros movem juntos; commit em lote = 1 undo),
 * resize com preview ao vivo, ROTAÇÃO (handle do Transformer, âncora no centro,
 * snaps a 45°), Delete (livre remove / template esconde) e edição inline.
 * Hit-rects são centro-based (offset = w/2,h/2) pra rotação ficar correta.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Layer, Line, Rect, Stage, Transformer } from 'react-konva'
import type Konva from 'konva'
import { headlineRuns, parseInline } from '@publisher/scene-engine'
import type { BrandKit, MetricsProvider, SceneNode, SceneSlide, StyledRun, UserNode } from '@publisher/scene-engine'
import { onSceneImageLoad, paintToCanvas } from './lib/paint-canvas'
import { selectableBoxes, type SelectBox } from './lib/selectable'
import { fieldsFor, getByPath, type FieldRef } from './lib/text-fields'
import { runsText, runsToMarkup } from './lib/rich-text'
import { editorAlign, editorKeyStyles } from './lib/editor-style'
import type { RawCarousel } from './lib/content-to-doc'
import { useStudioStore, type BatchMove } from './studio-store'
import { CanvasTextEditor } from './CanvasTextEditor'
import { StudioContextMenu } from './StudioContextMenu'

const DESIGN = 1080
const V_TARGETS = [96, DESIGN / 2, DESIGN - 96]
const H_TARGETS = [88, DESIGN / 2, DESIGN - 88]
const SNAP = 8

function snap1(edges: number[], targets: number[]): { delta: number; guide: number } | null {
  let best: { delta: number; guide: number } | null = null
  for (const e of edges) {
    for (const t of targets) {
      const d = t - e
      if (Math.abs(d) <= SNAP && (!best || Math.abs(d) < Math.abs(best.delta))) best = { delta: d, guide: t }
    }
  }
  return best
}

function isEditableTarget(): boolean {
  const el = document.activeElement
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || (el as HTMLElement).isContentEditable)
}

/** desloca/escala os nós ancorados num box (preview de gesto, sem tocar o store). */
function transformBox(nodes: SceneNode[], box: SelectBox, tlx: number, tly: number, sx: number, sy: number): SceneNode[] {
  const mapX = (v: number) => tlx + (v - box.x) * sx
  const mapY = (v: number) => tly + (v - box.y) * sy
  return nodes.map((n): SceneNode => {
    if (n.id !== box.id && n.container !== box.id) return n
    if (n.type === 'glyphrun') {
      // escala negativa (flip do Transformer) não espelha texto; só segue a caixa
      const size = Math.max(1, (n.style.size * (Math.abs(sx) + Math.abs(sy))) / 2)
      return { ...n, x: mapX(n.x), baselineY: mapY(n.baselineY), style: { ...n.style, size } }
    }
    if (n.type === 'line') return { ...n, x1: mapX(n.x1), y1: mapY(n.y1), x2: mapX(n.x2), y2: mapY(n.y2) }
    // normaliza frame com w/h negativos (flip) — painter exige dimensões >= 0
    let fx = mapX(n.frame.x)
    let fy = mapY(n.frame.y)
    let w = n.frame.w * sx
    let h = n.frame.h * sy
    if (w < 0) { fx += w; w = -w }
    if (h < 0) { fy += h; h = -h }
    return { ...n, frame: { x: fx, y: fy, w, h } }
  })
}

/** delta de movimento de UM box → BatchMove (livre muda o nó; template, o override). */
function moveFor(box: SelectBox, dx: number, dy: number, ctx: { user?: UserNode; curFrame?: { x?: number; y?: number } }): BatchMove {
  if (box.user && ctx.user) {
    const n = ctx.user
    if (n.kind === 'line') return { type: 'user', id: box.id, patch: { x1: n.x1 + dx, y1: n.y1 + dy, x2: n.x2 + dx, y2: n.y2 + dy } as Partial<UserNode> }
    return { type: 'user', id: box.id, patch: { frame: { ...n.frame, x: n.frame.x + dx, y: n.frame.y + dy } } as Partial<UserNode> }
  }
  if (box.kind === 'rect') return { type: 'override', id: box.id, patch: { frame: { x: box.x + dx, y: box.y + dy, w: box.w, h: box.h } } }
  return { type: 'override', id: box.id, patch: { frame: { x: (ctx.curFrame?.x ?? 0) + dx, y: (ctx.curFrame?.y ?? 0) + dy } } }
}

/** headline editada como runs únicos → de volta pros 3 campos (top/em/bottom). */
function splitHeadline(runs: StyledRun[]): { top: string; em: string; bottom: string } {
  let top = ''
  let em = ''
  let bottom = ''
  let seenEm = false
  for (const r of runs) {
    if (r.key === 'em') {
      em += r.text
      seenEm = true
    } else if (!seenEm) top += r.text
    else bottom += r.text
  }
  return { top: top.trim(), em: em.trim(), bottom: bottom.trim() }
}

interface SlideStageProps {
  slide: SceneSlide
  metrics: MetricsProvider
  index: number
  size: number
  kit: BrandKit
}

export function SlideStage({ slide, metrics, index, size, kit }: SlideStageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const trRef = useRef<Konva.Transformer>(null)
  const nodes = useRef<Map<string, Konva.Rect>>(new Map())
  const editedRef = useRef(false)
  const previewRaf = useRef(0)
  const dragStart = useRef<Map<string, { x: number; y: number }>>(new Map())
  // comportamento Figma: mousedown em item JÁ selecionado não colapsa a
  // multi-seleção (permite drag conjunto); o colapso acontece no click sem drag
  const downWasSelected = useRef(false)
  const dragHappened = useRef(false)
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  // marquee: arrasto na área vazia → retângulo de seleção por interseção
  const marqueeStart = useRef<{ x: number; y: number; base: string[] } | null>(null)
  const lastMarqueeIds = useRef('')
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null)

  const selectedIds = useStudioStore((s) => s.selectedIds)
  const select = useStudioStore((s) => s.select)
  const selectMany = useStudioStore((s) => s.selectMany)
  const setOverride = useStudioStore((s) => s.setOverride)
  const setText = useStudioStore((s) => s.setText)
  const updateNode = useStudioStore((s) => s.updateNode)
  const removeNode = useStudioStore((s) => s.removeNode)
  const applyMoves = useStudioStore((s) => s.applyMoves)
  const added = useStudioStore((s) => s.added)
  const overrides = useStudioStore((s) => s.overrides)
  const draft = useStudioStore((s) => s.draft) as RawCarousel | null

  const [editingBox, setEditingBox] = useState<SelectBox | null>(null)
  const [guides, setGuides] = useState<{ v: number[]; h: number[] }>({ v: [], h: [] })

  // editor in-place só vive enquanto o box segue selecionado (derivado, sem
  // efeito; o blur do editor limpa o estado quando o foco sai)
  const editBox = editingBox && selectedIds.includes(editingBox.id) ? editingBox : null

  const scale = size / DESIGN
  const boxes = useMemo(() => selectableBoxes(slide, metrics), [slide, metrics])
  const userNode = (id: string): UserNode | undefined => (added[index] ?? []).find((n) => n.id === id)
  const rotationOf = (id: string): number => {
    const u = userNode(id)
    if (u && u.kind !== 'line') return u.rotation ?? 0
    return overrides[index]?.[id]?.rotation ?? 0
  }

  useEffect(() => {
    // em edição in-place, o texto do container fica oculto no canvas — quem
    // mostra é o contentEditable por cima (mesma tipografia)
    const visible = editBox
      ? { ...slide, nodes: slide.nodes.filter((n) => !(n.type === 'glyphrun' && n.container === editBox.id)) }
      : slide
    const paint = () => canvasRef.current && paintToCanvas(canvasRef.current, visible, metrics, 1)
    paint()
    return onSceneImageLoad(paint) // repinta quando imagens da cena carregarem
  }, [slide, metrics, editBox])

  useEffect(() => () => cancelAnimationFrame(previewRaf.current), [])

  // preview ao vivo durante o gesto: repinta o canvas com os boxes mapeados,
  // sem tocar no store (commit só no fim — 1 undo por gesto)
  function paintPreview(moved: Array<{ box: SelectBox; tlx: number; tly: number; sx: number; sy: number }>) {
    cancelAnimationFrame(previewRaf.current)
    previewRaf.current = requestAnimationFrame(() => {
      if (!canvasRef.current) return
      let nodesNow = slide.nodes
      for (const m of moved) nodesNow = transformBox(nodesNow, m.box, m.tlx, m.tly, m.sx, m.sy)
      paintToCanvas(canvasRef.current, { ...slide, nodes: nodesNow }, metrics, 1)
    })
  }

  useEffect(() => {
    const tr = trRef.current
    if (!tr) return
    const sel = selectedIds.map((id) => nodes.current.get(id)).filter(Boolean) as Konva.Rect[]
    tr.nodes(sel)
    tr.getLayer()?.batchDraw()
  }, [selectedIds, boxes])

  // Delete/Backspace: livre remove; template esconde
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      if (isEditableTarget() || !selectedIds.length) return
      e.preventDefault()
      for (const id of selectedIds) {
        if (id.startsWith('user/')) removeNode(index, id)
        else setOverride(index, id, { hidden: true })
      }
      select(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedIds, index, removeNode, setOverride, select])

  const primaryBox = boxes.find((b) => b.id === selectedIds[0]) ?? null

  function startEdit(box: SelectBox) {
    if (box.user) {
      const n = userNode(box.id)
      if (n?.kind !== 'text') return
    } else if (!fieldsFor(box.id, draft ?? ({} as RawCarousel))) {
      return
    }
    editedRef.current = false
    select(box.id)
    setEditingBox(box)
  }

  // ---- marquee (arrasto na área vazia = seleção múltipla por interseção) ----
  function marqueePoint(e: MouseEvent): { x: number; y: number } | null {
    const rect = wrapRef.current?.getBoundingClientRect()
    if (!rect) return null
    return {
      x: Math.max(0, Math.min(DESIGN, (e.clientX - rect.left) / scale)),
      y: Math.max(0, Math.min(DESIGN, (e.clientY - rect.top) / scale)),
    }
  }

  function onMarqueeMove(e: MouseEvent) {
    const start = marqueeStart.current
    const p = marqueePoint(e)
    if (!start || !p) return
    const x = Math.min(start.x, p.x)
    const y = Math.min(start.y, p.y)
    const w = Math.abs(p.x - start.x)
    const h = Math.abs(p.y - start.y)
    setMarquee({ x, y, w, h })
    // interseção pelo AABB sem rotação (aproximação suficiente pra seleção)
    const hits = boxes.filter((b) => b.x < x + w && b.x + b.w > x && b.y < y + h && b.y + b.h > y).map((b) => b.id)
    const ids = [...start.base, ...hits.filter((id) => !start.base.includes(id))]
    const key = ids.join('\n')
    if (key === lastMarqueeIds.current) return // evita set redundante por mousemove
    lastMarqueeIds.current = key
    selectMany(ids)
  }

  function onMarqueeUp() {
    marqueeStart.current = null
    setMarquee(null)
    window.removeEventListener('mousemove', onMarqueeMove)
    window.removeEventListener('mouseup', onMarqueeUp)
  }

  // ---- drag (individual e de grupo) ----
  function onDragStart() {
    dragHappened.current = true
    dragStart.current = new Map(
      selectedIds
        .map((id) => {
          const kn = nodes.current.get(id)
          return kn ? ([id, { x: kn.x(), y: kn.y() }] as const) : null
        })
        .filter(Boolean) as Array<readonly [string, { x: number; y: number }]>,
    )
  }

  function onDragMove(box: SelectBox, e: Konva.KonvaEventObject<DragEvent>) {
    const node = e.target as Konva.Rect
    const tlx0 = node.x() - box.w / 2
    const tly0 = node.y() - box.h / 2
    const vs = snap1([tlx0, tlx0 + box.w / 2, tlx0 + box.w], V_TARGETS)
    const hs = snap1([tly0, tly0 + box.h / 2, tly0 + box.h], H_TARGETS)
    if (vs) node.x(node.x() + vs.delta)
    if (hs) node.y(node.y() + hs.delta)
    setGuides({ v: vs ? [vs.guide] : [], h: hs ? [hs.guide] : [] })

    // grupo: arrasta os demais selecionados pelo mesmo delta
    const start = dragStart.current.get(box.id)
    const moved: Array<{ box: SelectBox; tlx: number; tly: number; sx: number; sy: number }> = []
    if (start && selectedIds.length > 1 && selectedIds.includes(box.id)) {
      const dx = node.x() - start.x
      const dy = node.y() - start.y
      for (const id of selectedIds) {
        if (id === box.id) continue
        const kn = nodes.current.get(id)
        const st = dragStart.current.get(id)
        const b = boxes.find((x) => x.id === id)
        if (!kn || !st || !b) continue
        kn.x(st.x + dx)
        kn.y(st.y + dy)
        moved.push({ box: b, tlx: kn.x() - b.w / 2, tly: kn.y() - b.h / 2, sx: 1, sy: 1 })
      }
    }
    moved.push({ box, tlx: node.x() - box.w / 2, tly: node.y() - box.h / 2, sx: 1, sy: 1 })
    paintPreview(moved)
  }

  function commitDrag(box: SelectBox, node: Konva.Rect) {
    cancelAnimationFrame(previewRaf.current) // evita frame stale por cima do commit
    setGuides({ v: [], h: [] })
    const start = dragStart.current.get(box.id)
    if (!start) return
    const dx = node.x() - start.x
    const dy = node.y() - start.y
    if (dx === 0 && dy === 0) return

    const ids = selectedIds.length > 1 && selectedIds.includes(box.id) ? selectedIds : [box.id]
    const moves: BatchMove[] = []
    for (const id of ids) {
      const b = boxes.find((x) => x.id === id)
      if (!b) continue
      moves.push(moveFor(b, dx, dy, { user: userNode(id), curFrame: overrides[index]?.[id]?.frame }))
    }
    applyMoves(index, moves)
  }

  // ---- resize + rotação ----
  function onTransform(box: SelectBox, node: Konva.Rect) {
    // preview só pra escala (rotação ao vivo fica no box konva; canvas no commit)
    const sx = node.scaleX()
    const sy = node.scaleY()
    paintPreview([{ box, tlx: node.x() - (box.w * sx) / 2, tly: node.y() - (box.h * sy) / 2, sx, sy }])
  }

  function commitTransform(box: SelectBox, node: Konva.Rect) {
    cancelAnimationFrame(previewRaf.current)
    const sx = node.scaleX()
    const sy = node.scaleY()
    const rot = node.rotation()
    node.scaleX(1)
    node.scaleY(1)
    const baseRot = rotationOf(box.id)
    const rotChanged = Math.abs(rot - baseRot) > 0.5
    const scaled = Math.abs(sx - 1) > 0.01 || Math.abs(sy - 1) > 0.01

    if (rotChanged) {
      const newRot = Math.round(rot * 10) / 10
      if (box.user) updateNode(index, box.id, { rotation: newRot } as Partial<UserNode>)
      else setOverride(index, box.id, { rotation: newRot })
    }
    if (!scaled) return

    const tlx = node.x() - (box.w * sx) / 2
    const tly = node.y() - (box.h * sy) / 2
    if (box.user) {
      const n = userNode(box.id)
      if (!n) return
      if (n.kind === 'line') {
        updateNode(index, box.id, { x2: n.x1 + (n.x2 - n.x1) * sx, y2: n.y1 + (n.y2 - n.y1) * sy } as Partial<UserNode>)
      } else {
        updateNode(index, box.id, { frame: { x: tlx, y: tly, w: Math.max(24, n.frame.w * sx), h: Math.max(24, n.frame.h * sy) } } as Partial<UserNode>)
      }
    } else if (box.kind === 'rect') {
      setOverride(index, box.id, { frame: { x: tlx, y: tly, w: Math.max(24, box.w * sx), h: Math.max(24, box.h * sy) } })
    } else {
      const cur = overrides[index]?.[box.id]?.fontScale ?? 1
      setOverride(index, box.id, { fontScale: Math.max(0.5, Math.min(2, (cur * (sx + sy)) / 2)) })
    }
  }

  // edição in-place: template → campos do conteúdo; livre → texto do nó.
  // headline (3 campos) vira UM fluxo de runs com a ênfase marcada (singleEm).
  const editUser = editBox?.user ? userNode(editBox.id) : undefined
  const editFields: FieldRef[] | null = editBox
    ? editBox.user
      ? editUser?.kind === 'text'
        ? [{ path: '__user__', label: 'Texto', multiline: true }]
        : null
      : fieldsFor(editBox.id, draft ?? ({} as RawCarousel))
    : null

  const editor = (() => {
    if (!editBox || !editFields) return null
    const isHeadline = editFields.length === 3
    let initial: StyledRun[]
    if (editBox.user) {
      initial = parseInline(editUser?.kind === 'text' ? editUser.text : '')
    } else if (isHeadline) {
      initial = headlineRuns(
        getByPath(draft, editFields[0]!.path),
        getByPath(draft, editFields[1]!.path),
        getByPath(draft, editFields[2]!.path),
      )
    } else {
      const value = getByPath(draft, editFields[0]!.path)
      initial = editFields[0]!.markup ? parseInline(value) : [{ text: value, key: 'ink' }]
    }
    // texto livre e campos com markup têm formatação completa (B/I/U, cores);
    // headline mantém só a ênfase estrutural (3 campos não guardam decoração)
    const rich = editBox.user || (!isHeadline && !!editFields[0]!.markup)
    return {
      initial,
      isHeadline,
      multiline: editBox.user ? true : isHeadline ? false : !!editFields[0]!.multiline,
      formatKeys: rich ? (['em', 'strong'] as const) : isHeadline ? (['em'] as const) : [],
      decorations: rich,
      styles: editorKeyStyles(slide, editBox.id, initial, kit),
      align: editBox.user
        ? editUser?.kind === 'text'
          ? (editUser.align ?? 'left')
          : ('left' as const)
        : editorAlign(slide, editBox.id, metrics),
    }
  })()

  const palette = useMemo(
    () =>
      (
        [
          ['ink', 'Tinta'],
          ['inkSoft', 'Tinta suave'],
          ['muted', 'Apagado'],
          ['accent', 'Destaque'],
          ['accentSoft', 'Destaque suave'],
          ['bg', 'Fundo'],
          ['bg2', 'Fundo 2'],
          ['bgRose', 'Fundo rosé'],
          ['cardBg', 'Cartão'],
        ] as Array<[keyof BrandKit['palette'], string]>
      ).map(([token, label]) => ({ hex: kit.palette[token], label })),
    [kit],
  )

  function onEditorChange(runs: StyledRun[]) {
    if (!editBox || !editFields) return
    const first = !editedRef.current
    editedRef.current = true
    if (editBox.user) {
      updateNode(index, editBox.id, { text: runsToMarkup(runs) } as Partial<UserNode>, first)
      return
    }
    if (editFields.length === 3) {
      const { top, em, bottom } = splitHeadline(runs)
      setText(editFields[0]!.path, top, first)
      setText(editFields[1]!.path, em, false)
      setText(editFields[2]!.path, bottom, false)
      return
    }
    const f = editFields[0]!
    setText(f.path, f.markup ? runsToMarkup(runs) : runsText(runs), first)
  }

  return (
    <div ref={wrapRef} className="relative" style={{ width: size, height: size }}>
      <canvas ref={canvasRef} width={DESIGN} height={DESIGN} style={{ width: size, height: size, display: 'block', borderRadius: 12 }} />
      <div className="absolute inset-0">
        <Stage
          width={size}
          height={size}
          scaleX={scale}
          scaleY={scale}
          onMouseDown={(e) => {
            if (e.target !== e.target.getStage()) return
            setEditingBox(null)
            setMenu(null)
            if (e.evt.button !== 0) {
              select(null)
              return
            }
            // começa o marquee; shift preserva a seleção atual como base
            const base = e.evt.shiftKey ? [...selectedIds] : []
            if (!e.evt.shiftKey) select(null)
            const p = marqueePoint(e.evt)
            if (!p) return
            marqueeStart.current = { ...p, base }
            lastMarqueeIds.current = base.join('\n')
            window.addEventListener('mousemove', onMarqueeMove)
            window.addEventListener('mouseup', onMarqueeUp)
          }}
          onContextMenu={(e) => {
            // sem menu nativo do browser sobre o palco
            if (e.target === e.target.getStage()) e.evt.preventDefault()
          }}
        >
          <Layer>
            {boxes.map((b) => (
              <Rect
                key={b.id}
                ref={(node) => {
                  if (node) nodes.current.set(b.id, node)
                  else nodes.current.delete(b.id)
                }}
                x={b.x + b.w / 2}
                y={b.y + b.h / 2}
                offsetX={b.w / 2}
                offsetY={b.h / 2}
                width={b.w}
                height={b.h}
                rotation={rotationOf(b.id)}
                fill="#000"
                opacity={0.001}
                draggable
                stroke="#C7634F"
                strokeWidth={selectedIds.includes(b.id) ? 2 / scale : 0}
                strokeScaleEnabled={false}
                onMouseDown={(e) => {
                  if (e.evt.button === 2) return // right-click: tratado no contextmenu
                  dragHappened.current = false // novo gesto começa limpo
                  downWasSelected.current = selectedIds.includes(b.id)
                  if (e.evt.shiftKey) select(b.id, true)
                  else if (!downWasSelected.current) select(b.id)
                  // já selecionado sem shift: mantém a seleção → drag conjunto
                }}
                onClick={(e) => {
                  if (dragHappened.current) {
                    dragHappened.current = false
                    return
                  }
                  // click sem drag em item que JÁ estava selecionado → colapsa pra ele
                  if (!e.evt.shiftKey && downWasSelected.current && selectedIds.length > 1) select(b.id)
                }}
                onContextMenu={(e) => {
                  e.evt.preventDefault()
                  if (!selectedIds.includes(b.id)) select(b.id)
                  const host = e.target.getStage()?.container().getBoundingClientRect()
                  setMenu({ x: e.evt.clientX - (host?.left ?? 0) + 4, y: e.evt.clientY - (host?.top ?? 0) + 4 })
                }}
                onTap={() => select(b.id)}
                onDblClick={() => startEdit(b)}
                onDblTap={() => startEdit(b)}
                onDragStart={onDragStart}
                onDragMove={(e) => onDragMove(b, e)}
                onDragEnd={(e) => commitDrag(b, e.target as Konva.Rect)}
                onTransform={(e) => onTransform(b, e.target as Konva.Rect)}
                onTransformEnd={(e) => commitTransform(b, e.target as Konva.Rect)}
              />
            ))}

            {guides.v.map((x) => (
              <Line key={`v${x}`} points={[x, 0, x, DESIGN]} stroke="#C7634F" strokeWidth={1 / scale} dash={[6 / scale, 6 / scale]} listening={false} />
            ))}
            {guides.h.map((y) => (
              <Line key={`h${y}`} points={[0, y, DESIGN, y]} stroke="#C7634F" strokeWidth={1 / scale} dash={[6 / scale, 6 / scale]} listening={false} />
            ))}

            {marquee && (
              <Rect
                x={marquee.x}
                y={marquee.y}
                width={marquee.w}
                height={marquee.h}
                fill="rgba(199, 99, 79, 0.08)"
                stroke="#C7634F"
                strokeWidth={1 / scale}
                listening={false}
              />
            )}

            <Transformer
              ref={trRef}
              rotateEnabled={selectedIds.length === 1}
              rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
              resizeEnabled={selectedIds.length === 1}
              keepRatio={primaryBox ? !primaryBox.user && primaryBox.kind === 'text' : false}
              ignoreStroke
              anchorSize={8}
              borderStroke="#C7634F"
              anchorStroke="#C7634F"
            />
          </Layer>
        </Stage>
      </div>

      {editBox && editor && (
        <CanvasTextEditor
          key={editBox.id}
          box={editBox}
          scale={scale}
          initial={editor.initial}
          styles={editor.styles}
          align={editor.align}
          multiline={editor.multiline}
          formatKeys={[...editor.formatKeys]}
          decorations={editor.decorations}
          palette={palette}
          onAlign={editBox.user && editUser?.kind === 'text' ? (a) => updateNode(index, editBox.id, { align: a } as Partial<UserNode>) : undefined}
          singleEm={editor.isHeadline}
          onChange={onEditorChange}
          onClose={() => setEditingBox(null)}
        />
      )}

      {menu && <StudioContextMenu x={menu.x} y={menu.y} boxes={boxes} onClose={() => setMenu(null)} />}
    </div>
  )
}
