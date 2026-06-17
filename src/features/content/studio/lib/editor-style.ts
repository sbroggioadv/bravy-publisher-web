/**
 * Estilos do editor in-place: pra cada StyleKey, o ResolvedTextStyle que o
 * contentEditable deve usar. Fonte primária = glyphruns REAIS do container
 * (match texto-a-texto com os runs parseados → cores/famílias exatas);
 * fallback = tokens do kit (chave ainda não usada no canvas).
 */
import {
  resolveTokens,
  type BrandKit,
  type GlyphRunNode,
  type MetricsProvider,
  type ResolvedTextStyle,
  type SceneSlide,
  type StyleKey,
  type StyledRun,
} from '@publisher/scene-engine'
import { mergeRuns } from './rich-text'

export type KeyStyles = Record<StyleKey, ResolvedTextStyle>

const norm = (s: string) => s.replace(/\s+/g, ' ').trim()

function containerGlyphs(slide: SceneSlide, containerId: string): GlyphRunNode[] {
  return slide.nodes.filter((n): n is GlyphRunNode => n.type === 'glyphrun' && n.container === containerId)
}

/**
 * Casa os glyphruns (linhas quebradas) com os runs parseados (ordem preservada;
 * cada glyphrun é um pedaço de exatamente um run) e anota o estilo da primeira
 * ocorrência de cada chave. Glyphs fora do conteúdo (ex.: glifo da marca) são pulados.
 */
function matchStyles(glyphs: GlyphRunNode[], parsed: StyledRun[]): Partial<KeyStyles> {
  const map: Partial<KeyStyles> = {}
  let gi = 0
  for (const run of mergeRuns(parsed)) {
    let rest = norm(run.text)
    let scan = gi
    while (rest && scan < glyphs.length) {
      const gt = norm(glyphs[scan]!.text)
      if (gt && (rest === gt || rest.startsWith(gt))) {
        if (!map[run.key]) map[run.key] = glyphs[scan]!.style
        rest = norm(rest.slice(gt.length))
        gi = scan + 1
        scan = gi
      } else {
        scan++ // glyph alheio ao run (decoração) — tenta o próximo
      }
    }
  }
  return map
}

/** Estilos por chave pro editor do container. */
export function editorKeyStyles(slide: SceneSlide, containerId: string, parsed: StyledRun[], kit: BrandKit): KeyStyles {
  const tokens = resolveTokens(kit)
  const glyphs = containerGlyphs(slide, containerId)
  const matched = matchStyles(glyphs, parsed)

  const base: ResolvedTextStyle =
    matched.ink ??
    glyphs[0]?.style ?? {
      family: tokens.font('body').family,
      weight: 400,
      italic: false,
      size: 32,
      fill: tokens.color('ink'),
      letterSpacingEm: 0,
      lineHeight: 1.4,
    }
  const accent = tokens.font('accent')
  const mono = tokens.font('mono', 500)

  return {
    ink: base,
    em: matched.em ?? { ...base, family: accent.family, weight: accent.weight, italic: true, fill: tokens.color('accent') },
    strong: matched.strong ?? { ...base, weight: Math.max(600, base.weight) },
    keyword: matched.keyword ?? { ...base, family: mono.family, weight: mono.weight, italic: false, fill: tokens.color('accent') },
    code: matched.code ?? { ...base, family: mono.family, weight: mono.weight, italic: false },
  }
}

/** Alinhamento aparente do container (linhas agrupadas por baseline). */
export function editorAlign(slide: SceneSlide, containerId: string, metrics: MetricsProvider): 'left' | 'center' | 'right' {
  const glyphs = containerGlyphs(slide, containerId)
  const lines = new Map<number, { x0: number; x1: number }>()
  for (const g of glyphs) {
    const w = metrics.measure(g.text, g.style).width
    const cur = lines.get(g.baselineY)
    if (!cur) lines.set(g.baselineY, { x0: g.x, x1: g.x + w })
    else lines.set(g.baselineY, { x0: Math.min(cur.x0, g.x), x1: Math.max(cur.x1, g.x + w) })
  }
  const ls = [...lines.values()]
  if (ls.length < 2) return 'left'
  const x0 = Math.min(...ls.map((l) => l.x0))
  const x1 = Math.max(...ls.map((l) => l.x1))
  const TOL = 6
  if (ls.every((l) => Math.abs((l.x0 + l.x1) / 2 - (x0 + x1) / 2) <= TOL)) {
    if (ls.every((l) => Math.abs(l.x0 - x0) <= TOL)) return 'left' // colunas iguais — texto justificado à esquerda
    return 'center'
  }
  if (ls.every((l) => Math.abs(l.x1 - x1) <= TOL)) return 'right'
  return 'left'
}
