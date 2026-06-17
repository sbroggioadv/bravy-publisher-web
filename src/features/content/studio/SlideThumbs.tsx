'use client'

/**
 * Thumbnails rasterizados (RFC §5.5): imagem cacheada via paintSlide em escala
 * pequena — não 6 stages Konva vivos. Clique troca o slide ativo. Drag nos
 * slides de corpo reordena (capa e CTA são fixos — vêm de campos próprios do
 * CarouselInput); os contadores re-resolvem com a nova ordem.
 */
import { useEffect, useRef, useState, type DragEvent } from 'react'
import type { MetricsProvider, SceneGraph } from '@publisher/scene-engine'
import { onSceneImageLoad, paintToCanvas } from './lib/paint-canvas'
import { cn } from '@/lib/utils'

const THUMB = 116

interface SlideThumbsProps {
  scene: SceneGraph
  metrics: MetricsProvider
  activeIndex: number
  onSelect: (index: number) => void
  /** reordena slides de corpo (índices de cena); ausente = drag desabilitado. */
  onReorder?: (from: number, to: number) => void
}

interface ThumbDnd {
  draggable: boolean
  dragging: boolean
  /** slot de inserção ativo neste índice → barra "antes" do thumb. */
  showBar: boolean
  onDragStart: (e: DragEvent) => void
  onDragOver?: (e: DragEvent) => void
  onDrop?: (e: DragEvent) => void
  onDragEnd: () => void
}

function Thumb({ scene, metrics, index, active, onSelect, dnd }: { scene: SceneGraph; metrics: MetricsProvider; index: number; active: boolean; onSelect: (i: number) => void; dnd: ThumbDnd }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const slide = scene.slides[index]
  useEffect(() => {
    const paint = () => ref.current && slide && paintToCanvas(ref.current, slide, metrics, THUMB / 1080)
    paint()
    return onSceneImageLoad(paint)
  }, [slide, metrics])

  return (
    <div className="relative shrink-0">
      {dnd.showBar && (
        <span className="pointer-events-none absolute z-10 rounded-full bg-[#C7634F] max-lg:-left-1.25 max-lg:top-0 max-lg:bottom-0 max-lg:w-0.5 lg:-top-1.25 lg:left-0 lg:right-0 lg:h-0.5" />
      )}
      <button
        type="button"
        onClick={() => onSelect(index)}
        draggable={dnd.draggable}
        onDragStart={dnd.onDragStart}
        onDragOver={dnd.onDragOver}
        onDrop={dnd.onDrop}
        onDragEnd={dnd.onDragEnd}
        className={cn(
          'relative block rounded-lg overflow-hidden border-2 transition-colors',
          active ? 'border-[#C7634F]' : 'border-transparent hover:border-muted-foreground/30',
          dnd.draggable && 'cursor-grab',
          dnd.dragging && 'opacity-40',
        )}
        style={{ width: THUMB, height: THUMB }}
        aria-label={`Slide ${index + 1}`}
      >
        <canvas ref={ref} width={THUMB} height={THUMB} style={{ width: THUMB, height: THUMB, display: 'block' }} />
        <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
          {index + 1}
        </span>
      </button>
    </div>
  )
}

export function SlideThumbs({ scene, metrics, activeIndex, onSelect, onReorder }: SlideThumbsProps) {
  const listRef = useRef<HTMLDivElement>(null)
  // drag em andamento: from = índice de cena arrastado; slot ∈ [1..último] =
  // gap de inserção (slot i = antes do slide i; slot último = depois do corpo)
  const [drag, setDrag] = useState<{ from: number; slot: number } | null>(null)
  const last = scene.slides.length - 1
  const isBody = (i: number) => i > 0 && i < last

  function slotFromEvent(e: DragEvent, index: number): number {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const column = listRef.current ? getComputedStyle(listRef.current).flexDirection === 'column' : true
    const before = column ? e.clientY < r.top + r.height / 2 : e.clientX < r.left + r.width / 2
    return before ? index : index + 1
  }

  function dndFor(index: number): ThumbDnd {
    const draggable = !!onReorder && isBody(index)
    return {
      draggable,
      dragging: drag?.from === index,
      showBar: drag != null && drag.slot === index && drag.slot !== drag.from && drag.slot !== drag.from + 1,
      onDragStart: (e) => {
        if (!draggable) return
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', String(index)) // exigido pelo Firefox
        setDrag({ from: index, slot: index })
      },
      onDragOver: isBody(index)
        ? (e) => {
            if (!drag) return
            e.preventDefault()
            e.dataTransfer.dropEffect = 'move'
            const slot = slotFromEvent(e, index)
            if (slot !== drag.slot) setDrag({ ...drag, slot })
          }
        : undefined,
      onDrop: isBody(index)
        ? (e) => {
            e.preventDefault()
            if (drag && onReorder) {
              const to = drag.slot > drag.from ? drag.slot - 1 : drag.slot
              if (to !== drag.from) onReorder(drag.from, to)
            }
            setDrag(null)
          }
        : undefined,
      onDragEnd: () => setDrag(null),
    }
  }

  return (
    <div ref={listRef} className="flex gap-2 overflow-x-auto p-2 lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden">
      {scene.slides.map((s) => (
        <Thumb key={s.index} scene={scene} metrics={metrics} index={s.index} active={s.index === activeIndex} onSelect={onSelect} dnd={dndFor(s.index)} />
      ))}
    </div>
  )
}
