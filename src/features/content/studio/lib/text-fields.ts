/**
 * Mapeia o id de um container de texto (scene-engine) → caminho no CarouselInput
 * cru (snake_case), p/ a edição inline (RFC §5.3). Edição escreve no CAMPO do
 * ContentText (não no glyphrun) e o engine re-deriva → reflow de graça.
 */
import type { RawCarousel } from './content-to-doc'

export interface FieldRef {
  path: string
  label: string
  multiline?: boolean
  /** aceita markup inline (<em>/<strong>/keyword/code) — passa por parseInline no engine. */
  markup?: boolean
}

type Token = string | number

function tokenize(path: string): Token[] {
  const out: Token[] = []
  for (const part of path.split('.')) {
    const m = part.match(/^([a-zA-Z_]+)((\[\d+\])*)$/)
    if (!m) {
      out.push(part)
      continue
    }
    out.push(m[1]!)
    const idx = m[2]!.match(/\[(\d+)\]/g) ?? []
    for (const i of idx) out.push(Number(i.slice(1, -1)))
  }
  return out
}

export function getByPath(obj: unknown, path: string): string {
  let cur: unknown = obj
  for (const t of tokenize(path)) {
    if (cur == null) return ''
    cur = (cur as Record<Token, unknown>)[t]
  }
  return cur == null ? '' : String(cur)
}

/** Set imutável ao longo do caminho (clona só o que toca). */
export function setByPath<T>(obj: T, path: string, value: string): T {
  const tokens = tokenize(path)
  function rec(node: unknown, i: number): unknown {
    const t = tokens[i]!
    const isIndex = typeof t === 'number'
    const base: Record<Token, unknown> | unknown[] = isIndex
      ? Array.isArray(node)
        ? [...node]
        : []
      : { ...(node as Record<Token, unknown>) }
    if (i === tokens.length - 1) {
      ;(base as Record<Token, unknown>)[t] = value
    } else {
      ;(base as Record<Token, unknown>)[t] = rec((base as Record<Token, unknown>)[t], i + 1)
    }
    return base
  }
  return rec(obj, 0) as T
}

const RE = {
  coverHook: /^cover\/hook$/,
  coverLabel: /^cover\/label$/,
  ctaText: /^cta\/text$/,
  ctaSub: /^cta\/sub$/,
  ctaLabel: /^cta\/label$/,
  headline: /^slide\[(\d+)\]\/headline$/,
  kicker: /^slide\[(\d+)\]\/kicker$/,
  callout: /^slide\[(\d+)\]\/callout$/,
  bullet: /^slide\[(\d+)\]\/body\.bullet\[(\d+)\]$/,
  stat: /^slide\[(\d+)\]\/stat\[(\d+)\]\.text$/,
  card: /^slide\[(\d+)\]\/card\[(\d+)\]\.(title|body|label)$/,
}

const TWEET = {
  lead: /^slide\[(\d+)\]\/lead$/,
  para: /^slide\[(\d+)\]\/para\[(\d+)\]$/,
}

/**
 * Família tweet: containers genéricos (`lead` / `para[k]`) → id canônico com o
 * MESMO campo de origem, espelhando a derivação do template (lead = headline,
 * senão tag; parágrafos seguem a prioridade list > paragraphs > stats > cards
 * de paragraphsFrom). Reusa os mapeamentos canônicos de fieldsFor.
 */
function tweetCanonicalId(containerId: string, raw: RawCarousel): string | null {
  if (containerId === 'cover/lead') return 'cover/hook'
  if (containerId === 'cover/para[0]') return 'cover/label'
  if (containerId === 'cta/lead') return 'cta/text'
  if (containerId === 'cta/para[0]') return 'cta/sub'

  let m: RegExpMatchArray | null
  if ((m = containerId.match(TWEET.lead))) {
    const b = Number(m[1])
    const s = raw.slides?.[b]
    return s?.headline_top || s?.headline_em || s?.headline_bottom ? `slide[${b}]/headline` : `slide[${b}]/kicker`
  }
  if ((m = containerId.match(TWEET.para))) {
    const b = Number(m[1])
    const k = Number(m[2])
    const s = raw.slides?.[b]
    if (s?.list || s?.paragraphs) return `slide[${b}]/body.bullet[${k}]`
    if (s?.stats) return `slide[${b}]/stat[${k}].text`
    if (s?.cards) return `slide[${b}]/card[${k}].body`
  }
  return null
}

/** Campos editáveis de um container; null se não for texto editável. */
export function fieldsFor(containerId: string, raw: RawCarousel): FieldRef[] | null {
  if (RE.coverHook.test(containerId)) return [{ path: 'hook_capa', label: 'Hook da capa', multiline: true, markup: true }]
  if (RE.coverLabel.test(containerId)) return [{ path: 'label_capa', label: 'Rótulo da capa' }]
  if (RE.ctaText.test(containerId)) return [{ path: 'cta_text', label: 'Texto do CTA', multiline: true, markup: true }]
  if (RE.ctaSub.test(containerId)) return [{ path: 'cta_sub', label: 'Subtítulo do CTA', markup: true }]
  if (RE.ctaLabel.test(containerId)) return [{ path: 'cta_label', label: 'Rótulo do CTA' }]

  let m: RegExpMatchArray | null
  if ((m = containerId.match(RE.headline))) {
    const b = Number(m[1])
    return [
      { path: `slides[${b}].headline_top`, label: 'Linha 1' },
      { path: `slides[${b}].headline_em`, label: 'Ênfase (serif)' },
      { path: `slides[${b}].headline_bottom`, label: 'Linha 3' },
    ]
  }
  if ((m = containerId.match(RE.kicker))) return [{ path: `slides[${Number(m[1])}].tag`, label: 'Kicker' }]
  if ((m = containerId.match(RE.callout))) return [{ path: `slides[${Number(m[1])}].callout`, label: 'Callout', multiline: true, markup: true }]
  if ((m = containerId.match(RE.bullet))) {
    const b = Number(m[1])
    const k = Number(m[2])
    const hasList = Array.isArray(raw.slides?.[b]?.list)
    return [{ path: `slides[${b}].${hasList ? 'list' : 'paragraphs'}[${k}]`, label: `Item ${k + 1}`, multiline: true, markup: true }]
  }
  if ((m = containerId.match(RE.stat))) return [{ path: `slides[${Number(m[1])}].stats[${Number(m[2])}][1]`, label: 'Descrição', multiline: true }]
  if ((m = containerId.match(RE.card))) {
    const b = Number(m[1])
    const k = Number(m[2])
    const f = m[3]!
    return [{ path: `slides[${b}].cards[${k}].${f}`, label: f === 'title' ? 'Título' : f === 'body' ? 'Texto' : 'Rótulo', multiline: f === 'body', markup: f === 'body' }]
  }

  // família tweet: lead/para[k] delegam pro container canônico equivalente
  const canonical = tweetCanonicalId(containerId, raw)
  return canonical ? fieldsFor(canonical, raw) : null
}
