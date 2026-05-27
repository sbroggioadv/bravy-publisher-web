import type { Content, Slide, SlideCard } from '@/types/content'

/**
 * Backend stores slide payload in `bodyData` (JSON column, snake_case keys
 * straight from the Claude response). The UI types in @/types/content expect
 * a flat camelCase shape. This mapper bridges that gap so feature code never
 * touches raw API shapes.
 */
type ApiSlide = {
  id: string
  position: number
  slideType?: string
  bodyData?: Record<string, unknown> | null
  imageUrl?: string | null
  imageKey?: string | null
  // legacy/already-mapped fields fallback through
  labelTopo?: string
  tag?: string
  paragraphs?: string[]
  list?: string[]
  stats?: [string, string][]
  cards?: SlideCard[]
  callout?: string
}

function pick<T>(obj: Record<string, unknown> | null | undefined, ...keys: string[]): T | undefined {
  if (!obj) return undefined
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null) return obj[k] as T
  }
  return undefined
}

export function mapApiSlide(api: ApiSlide): Slide {
  const body = api.bodyData ?? {}
  return {
    id: api.id,
    position: api.position,
    labelTopo: api.labelTopo ?? pick<string>(body, 'label_topo', 'labelTopo') ?? '',
    tag: api.tag ?? pick<string>(body, 'tag'),
    headlineTop: pick<string>(body, 'headline_top', 'headlineTop'),
    headlineEm: pick<string>(body, 'headline_em', 'headlineEm'),
    headlineBottom: pick<string>(body, 'headline_bottom', 'headlineBottom'),
    paragraphs: api.paragraphs ?? pick<string[]>(body, 'paragraphs'),
    list: api.list ?? pick<string[]>(body, 'list'),
    stats: api.stats ?? pick<[string, string][]>(body, 'stats'),
    cards: api.cards ?? pick<SlideCard[]>(body, 'cards'),
    callout: api.callout ?? pick<string>(body, 'callout'),
    imageUrl: api.imageUrl ?? undefined,
    imageKey: api.imageKey ?? undefined,
  }
}

type ApiContent = Omit<Content, 'slides' | 'labelTopoCapa' | 'labelCapa' | 'hookCapa' | 'ctaLabelTopo' | 'ctaLabel' | 'ctaText' | 'ctaSub'> & {
  slides?: ApiSlide[]
  slidesData?: Record<string, unknown> | null
  hookCapa?: string | null
  caption?: string | null
  labelTopoCapa?: string | null
  labelCapa?: string | null
  ctaLabelTopo?: string | null
  ctaLabel?: string | null
  ctaText?: string | null
  ctaSub?: string | null
}

/**
 * Normalize a Content payload coming from the API. Pulls cover/CTA fields
 * either from the dedicated columns or from `slidesData` (the raw JSON dump
 * of the generation response), and flattens every slide via `mapApiSlide`.
 */
export function mapApiContent(api: ApiContent): Content {
  const sd = (api.slidesData ?? {}) as Record<string, unknown>
  const slides = (api.slides ?? []).map(mapApiSlide).sort((a, b) => a.position - b.position)

  return {
    ...(api as unknown as Content),
    labelTopoCapa: api.labelTopoCapa ?? (sd.label_topo_capa as string) ?? '',
    labelCapa: api.labelCapa ?? (sd.label_capa as string) ?? '',
    hookCapa: api.hookCapa ?? (sd.hook_capa as string) ?? '',
    ctaLabelTopo: api.ctaLabelTopo ?? (sd.cta_label_topo as string) ?? '',
    ctaLabel: api.ctaLabel ?? (sd.cta_label as string) ?? '',
    ctaText: api.ctaText ?? (sd.cta_text as string) ?? '',
    ctaSub: api.ctaSub ?? (sd.cta_sub as string) ?? '',
    caption: api.caption ?? '',
    slides,
  }
}
