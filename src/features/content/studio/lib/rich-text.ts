/**
 * Modelo de texto rico do editor in-place: StyledRun[] é a fonte da verdade.
 * O usuário NUNCA vê tags — o contentEditable renderiza spans estilizados e a
 * serialização volta pro subset de markup que o parseInline entende
 * (<em>, <strong>, <span class="keyword">, <code>). Decorações ORTOGONAIS à
 * chave: <u> (sublinhado), <span data-c="#hex"> (cor) e <span data-bg="#hex">
 * (destaque). '\n' = quebra de linha.
 */
import type { StyleKey, StyledRun } from '@publisher/scene-engine'

/** decorações ligáveis/desligáveis (boolean). */
export type FlagDeco = 'underline'
/** decorações com valor hex (cor do texto / destaque). */
export type ValueDeco = 'color' | 'bg'

const WRAP: Record<Exclude<StyleKey, 'ink'>, [string, string]> = {
  em: ['<em>', '</em>'],
  strong: ['<strong>', '</strong>'],
  keyword: ['<span class="keyword">', '</span>'],
  code: ['<code>', '</code>'],
}

const escapeText = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const sameStyle = (a: StyledRun, b: StyledRun): boolean =>
  a.key === b.key && !a.underline === !b.underline && (a.color ?? null) === (b.color ?? null) && (a.bg ?? null) === (b.bg ?? null)

/** Junta runs adjacentes do mesmo estilo (chave + decorações) e descarta vazios. */
export function mergeRuns(runs: StyledRun[]): StyledRun[] {
  const out: StyledRun[] = []
  for (const r of runs) {
    if (!r.text) continue
    const last = out[out.length - 1]
    if (last && sameStyle(last, r)) last.text += r.text
    else out.push({ ...r })
  }
  return out.length ? out : [{ text: '', key: 'ink' }]
}

export const runsText = (runs: StyledRun[]): string => runs.map((r) => r.text).join('')

/** runs → markup persistível (inverso do parseInline; decorações aninham fora da chave). */
export function runsToMarkup(runs: StyledRun[]): string {
  return mergeRuns(runs)
    .map((r) => {
      let s = r.key === 'ink' ? escapeText(r.text) : WRAP[r.key][0] + escapeText(r.text) + WRAP[r.key][1]
      if (r.underline) s = `<u>${s}</u>`
      if (r.color) s = `<span data-c="${r.color}">${s}</span>`
      if (r.bg) s = `<span data-bg="${r.bg}">${s}</span>`
      return s
    })
    .join('')
}

/** runs → HTML do contentEditable (UM span por run com data-attrs; '\n' → <br>). */
export function runsToHtml(runs: StyledRun[]): string {
  return mergeRuns(runs)
    .map((r) => {
      const text = escapeText(r.text).replace(/\n/g, '<br>')
      const attrs: string[] = []
      const css: string[] = []
      if (r.key !== 'ink') attrs.push(`data-key="${r.key}"`)
      if (r.underline) {
        attrs.push('data-u="1"')
        css.push('text-decoration:underline')
      }
      if (r.color) {
        attrs.push(`data-c="${r.color}"`)
        css.push(`color:${r.color}`)
      }
      if (r.bg) {
        attrs.push(`data-bg="${r.bg}"`)
        css.push(`background-color:${r.bg}`)
      }
      if (!attrs.length) return text
      const style = css.length ? ` style="${css.join(';')}"` : ''
      return `<span ${attrs.join(' ')}${style}>${text}</span>`
    })
    .join('')
}

// ---- DOM → runs/offsets (travessia única e compartilhada) ----

interface Seg {
  text: string
  node: Node
  kind: 'text' | 'br' | 'block'
}

/** Segmentos de texto plano em ordem de documento (br = '\n'; div/p novo = '\n'). */
function domSegments(root: HTMLElement): Seg[] {
  const segs: Seg[] = []
  let emitted = false
  function walk(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = node.nodeValue ?? ''
      if (t) {
        segs.push({ text: t, node, kind: 'text' })
        emitted = true
      }
      return
    }
    if (!(node instanceof HTMLElement)) return
    if (node.tagName === 'BR') {
      segs.push({ text: '\n', node, kind: 'br' })
      emitted = true
      return
    }
    if ((node.tagName === 'DIV' || node.tagName === 'P') && emitted) segs.push({ text: '\n', node, kind: 'block' })
    for (const c of Array.from(node.childNodes)) walk(c)
  }
  for (const c of Array.from(root.childNodes)) walk(c)
  return segs
}

/** estilo efetivo de um nó: cada propriedade vem do ancestral mais próximo que a define. */
function styleOf(node: Node, root: HTMLElement): Pick<StyledRun, 'key' | 'underline' | 'color' | 'bg'> {
  const out: Pick<StyledRun, 'key' | 'underline' | 'color' | 'bg'> = { key: 'ink' }
  let keyDone = false
  let uDone = false
  let cDone = false
  let bgDone = false
  let el: HTMLElement | null = node instanceof HTMLElement ? node : node.parentElement
  while (el && el !== root) {
    const d = el.dataset ?? {}
    if (!keyDone && d.key) {
      out.key = d.key as StyleKey
      keyDone = true
    }
    if (!uDone && d.u) {
      out.underline = true
      uDone = true
    }
    if (!cDone && d.c) {
      out.color = d.c
      cDone = true
    }
    if (!bgDone && d.bg) {
      out.bg = d.bg
      bgDone = true
    }
    el = el.parentElement
  }
  return out
}

/** Lê o conteúdo do contentEditable de volta pra runs. */
export function domToRuns(root: HTMLElement): StyledRun[] {
  return mergeRuns(
    domSegments(root).map((s) => (s.kind === 'block' ? { text: s.text, key: 'ink' as StyleKey } : { text: s.text, ...styleOf(s.node, root) })),
  )
}

/** (container, offset) do DOM → offset no texto plano (mesma travessia do domToRuns). */
export function plainOffset(root: HTMLElement, container: Node, offset: number): number {
  const probe = document.createRange()
  try {
    probe.setStart(container, offset)
  } catch {
    return 0
  }
  probe.collapse(true)
  let acc = 0
  for (const seg of domSegments(root)) {
    const r = document.createRange()
    if (seg.kind === 'text') r.selectNodeContents(seg.node)
    else r.selectNode(seg.node)
    if (probe.compareBoundaryPoints(Range.START_TO_START, r) <= 0) return acc
    if (seg.kind === 'text' && seg.node === container) return acc + Math.min(offset, seg.text.length)
    if (probe.compareBoundaryPoints(Range.END_TO_END, r) <= 0) return acc + seg.text.length
    acc += seg.text.length
  }
  return acc
}

export function selectionOffsets(root: HTMLElement): { start: number; end: number } | null {
  const sel = window.getSelection()
  if (!sel?.rangeCount) return null
  const r = sel.getRangeAt(0)
  if (!root.contains(r.startContainer) || !root.contains(r.endContainer)) return null
  return { start: plainOffset(root, r.startContainer, r.startOffset), end: plainOffset(root, r.endContainer, r.endOffset) }
}

function resolvePoint(root: HTMLElement, target: number): { node: Node; offset: number } {
  let acc = 0
  for (const seg of domSegments(root)) {
    const len = seg.text.length
    const inside = seg.kind === 'text' ? target <= acc + len : target > acc && target <= acc + len
    if (inside) {
      if (seg.kind === 'text') return { node: seg.node, offset: Math.max(0, target - acc) }
      if (seg.kind === 'br') {
        const p = seg.node.parentNode!
        return { node: p, offset: Array.prototype.indexOf.call(p.childNodes, seg.node) + 1 }
      }
      return { node: seg.node, offset: 0 } // div: início do conteúdo
    }
    acc += len
  }
  return { node: root, offset: root.childNodes.length }
}

export function setSelectionAt(root: HTMLElement, start: number, end: number): void {
  const sel = window.getSelection()
  if (!sel) return
  const a = resolvePoint(root, Math.min(start, end))
  const b = start === end ? a : resolvePoint(root, Math.max(start, end))
  const range = document.createRange()
  range.setStart(a.node, a.offset)
  range.setEnd(b.node, b.offset)
  sel.removeAllRanges()
  sel.addRange(range)
}

// ---- operações no modelo ----

/** divide nos limites e mapeia só os trechos dentro de [start,end). */
function mapRange(runs: StyledRun[], start: number, end: number, fn: (r: StyledRun) => StyledRun): StyledRun[] {
  if (end <= start) return runs
  const merged = mergeRuns(runs)
  const out: StyledRun[] = []
  let pos = 0
  for (const r of merged) {
    const a = pos
    const b = pos + r.text.length
    pos = b
    if (b <= start || a >= end) {
      out.push(r)
      continue
    }
    const s = Math.max(a, start)
    const e = Math.min(b, end)
    if (s > a) out.push({ ...r, text: r.text.slice(0, s - a) })
    out.push(fn({ ...r, text: r.text.slice(s - a, e - a) }))
    if (e < b) out.push({ ...r, text: r.text.slice(e - a) })
  }
  return mergeRuns(out)
}

/** runs que intersectam [start,end) (caret → run do char anterior). */
function runsInRange(runs: StyledRun[], start: number, end: number): StyledRun[] {
  const merged = mergeRuns(runs)
  if (start === end) {
    let pos = 0
    for (const r of merged) {
      const b = pos + r.text.length
      if (start <= b && (start > pos || pos === 0)) return [r]
      pos = b
    }
    return merged.length ? [merged[merged.length - 1]!] : []
  }
  const out: StyledRun[] = []
  let pos = 0
  for (const r of merged) {
    const a = pos
    const b = pos + r.text.length
    pos = b
    if (a < end && b > start) out.push(r)
  }
  return out
}

/** Chave uniforme de [start,end); null se misto. */
export function rangeKey(runs: StyledRun[], start: number, end: number): StyleKey | null {
  const inRange = runsInRange(runs, start, end)
  if (!inRange.length) return 'ink'
  const first = inRange[0]!.key
  return inRange.every((r) => r.key === first) ? first : null
}

/** Decoração boolean ativa em TODO o intervalo? */
export function rangeFlag(runs: StyledRun[], start: number, end: number, flag: FlagDeco): boolean {
  const inRange = runsInRange(runs, start, end)
  return inRange.length > 0 && inRange.every((r) => !!r[flag])
}

/** Valor uniforme da decoração em [start,end); null se misto/ausente. */
export function rangeValue(runs: StyledRun[], start: number, end: number, deco: ValueDeco): string | null {
  const inRange = runsInRange(runs, start, end)
  if (!inRange.length) return null
  const first = inRange[0]![deco] ?? null
  return inRange.every((r) => (r[deco] ?? null) === first) ? first : null
}

/** Aplica/remove a chave em [start,end) preservando decorações. */
export function toggleKey(runs: StyledRun[], start: number, end: number, key: StyleKey): StyledRun[] {
  const allKeyed = runsInRange(runs, start, end).every((r) => r.key === key)
  const target: StyleKey = allKeyed ? 'ink' : key
  return mapRange(runs, start, end, (r) => ({ ...r, key: target }))
}

/** Liga/desliga decoração boolean em [start,end). */
export function toggleFlag(runs: StyledRun[], start: number, end: number, flag: FlagDeco): StyledRun[] {
  const on = !rangeFlag(runs, start, end, flag)
  return mapRange(runs, start, end, (r) => {
    const next = { ...r }
    if (on) next[flag] = true
    else delete next[flag]
    return next
  })
}

/** Define (ou remove, com undefined) a decoração de valor em [start,end). */
export function setValue(runs: StyledRun[], start: number, end: number, deco: ValueDeco, value: string | undefined): StyledRun[] {
  return mapRange(runs, start, end, (r) => {
    const next = { ...r }
    if (value) next[deco] = value
    else delete next[deco]
    return next
  })
}

/** Rebaixa toda chave ≠ ink pra ink (headline: garante UMA ênfase por vez). */
export function clearKey(runs: StyledRun[], key: StyleKey): StyledRun[] {
  return mergeRuns(runs.map((r) => (r.key === key ? { ...r, key: 'ink' as StyleKey } : r)))
}
