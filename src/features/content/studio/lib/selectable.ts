/**
 * Caixas selecionáveis de um slide (RFC §5.1): seleção = um container
 * (headline, card, callout…), nunca um glyphrun solto. Une os extents dos
 * glyphruns por `container` e expõe rects de fundo (card/callout) como
 * selecionáveis. Decoração (corners, underline, bgnum, footer) fica de fora.
 */
import type { MetricsProvider, SceneNode, SceneSlide } from '@publisher/scene-engine'

export interface SelectBox {
  id: string
  /** text = container de texto (template ou livre); rect = caixa; user = elemento livre */
  kind: 'text' | 'rect'
  user: boolean
  x: number
  y: number
  w: number
  h: number
}

const SELECTABLE_RECT = /\/(card\[\d+\]|callout)$/
const isUser = (id: string) => id.startsWith('user/')

function glyphExtent(node: Extract<SceneNode, { type: 'glyphrun' }>, metrics: MetricsProvider) {
  const m = metrics.measure(node.text, node.style)
  return { x0: node.x, x1: node.x + m.width, y0: node.baselineY - m.ascent, y1: node.baselineY + m.descent }
}

export function selectableBoxes(slide: SceneSlide, metrics: MetricsProvider): SelectBox[] {
  const text = new Map<string, { x0: number; y0: number; x1: number; y1: number }>()
  const boxes: SelectBox[] = []

  for (const node of slide.nodes) {
    if (node.opacity === 0) continue // deletado/oculto (override hidden): fora da seleção e do hit-test
    if (node.type === 'glyphrun' && node.container) {
      const e = glyphExtent(node, metrics)
      const cur = text.get(node.container)
      if (!cur) text.set(node.container, e)
      else text.set(node.container, { x0: Math.min(cur.x0, e.x0), y0: Math.min(cur.y0, e.y0), x1: Math.max(cur.x1, e.x1), y1: Math.max(cur.y1, e.y1) })
    } else if ((node.type === 'rect' || node.type === 'ellipse' || node.type === 'image') && (isUser(node.id) || SELECTABLE_RECT.test(node.id))) {
      boxes.push({ id: node.id, kind: 'rect', user: isUser(node.id), x: node.frame.x, y: node.frame.y, w: node.frame.w, h: node.frame.h })
    } else if (node.type === 'line' && isUser(node.id)) {
      const x = Math.min(node.x1, node.x2)
      const y = Math.min(node.y1, node.y2) - 8
      boxes.push({ id: node.id, kind: 'rect', user: true, x, y, w: Math.max(16, Math.abs(node.x2 - node.x1)), h: Math.max(16, Math.abs(node.y2 - node.y1) + 16) })
    }
  }

  for (const [id, e] of text) {
    boxes.push({ id, kind: 'text', user: isUser(id), x: e.x0, y: e.y0, w: e.x1 - e.x0, h: e.y1 - e.y0 })
  }
  return boxes
}
