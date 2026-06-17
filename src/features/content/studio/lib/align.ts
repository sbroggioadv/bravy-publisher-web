/**
 * Alinhamento (Figma-like): 1 selecionado → alinha ao SLIDE (0..1080);
 * vários → à bounding box da seleção. Retorna deltas por id — quem aplica
 * decide se vira updateNode (livre) ou override (template).
 */
import type { SelectBox } from './selectable'

export type AlignMode = 'left' | 'centerH' | 'right' | 'top' | 'middleV' | 'bottom'
const DESIGN = 1080

export function computeAlign(selected: SelectBox[], mode: AlignMode): Map<string, { dx: number; dy: number }> {
  const out = new Map<string, { dx: number; dy: number }>()
  if (!selected.length) return out

  let x0 = 0
  let y0 = 0
  let x1 = DESIGN
  let y1 = DESIGN
  if (selected.length > 1) {
    x0 = Math.min(...selected.map((b) => b.x))
    y0 = Math.min(...selected.map((b) => b.y))
    x1 = Math.max(...selected.map((b) => b.x + b.w))
    y1 = Math.max(...selected.map((b) => b.y + b.h))
  }

  for (const b of selected) {
    let dx = 0
    let dy = 0
    switch (mode) {
      case 'left': dx = x0 - b.x; break
      case 'centerH': dx = (x0 + x1) / 2 - (b.x + b.w / 2); break
      case 'right': dx = x1 - (b.x + b.w); break
      case 'top': dy = y0 - b.y; break
      case 'middleV': dy = (y0 + y1) / 2 - (b.y + b.h / 2); break
      case 'bottom': dy = y1 - (b.y + b.h); break
    }
    out.set(b.id, { dx, dy })
  }
  return out
}

/**
 * Distribuir espaçamento (3+ itens): mantém o primeiro e o último no lugar e
 * espaça os do meio com gaps iguais ao longo do eixo.
 */
export function computeDistribute(selected: SelectBox[], axis: 'h' | 'v'): Map<string, { dx: number; dy: number }> {
  const out = new Map<string, { dx: number; dy: number }>()
  if (selected.length < 3) return out
  const sorted = [...selected].sort((a, b) => (axis === 'h' ? a.x - b.x : a.y - b.y))
  const first = sorted[0]!
  const last = sorted[sorted.length - 1]!
  const sizes = sorted.reduce((s, b) => s + (axis === 'h' ? b.w : b.h), 0)
  const span = axis === 'h' ? last.x + last.w - first.x : last.y + last.h - first.y
  const gap = (span - sizes) / (sorted.length - 1)
  let cursor = (axis === 'h' ? first.x + first.w : first.y + first.h) + gap
  for (let i = 1; i < sorted.length - 1; i++) {
    const b = sorted[i]!
    if (axis === 'h') out.set(b.id, { dx: cursor - b.x, dy: 0 })
    else out.set(b.id, { dx: 0, dy: cursor - b.y })
    cursor += (axis === 'h' ? b.w : b.h) + gap
  }
  return out
}
