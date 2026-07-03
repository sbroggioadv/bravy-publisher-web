/**
 * Content (frontend) → DesignDocument (scene-engine). Espelha o adapter do
 * backend (carousel-to-doc.ts): usa `content.slidesData` (CarouselInput cru,
 * snake_case) como fonte de verdade do texto → o estúdio resolve a MESMA cena
 * que o worker server. Overrides vêm de cada Slide.sceneOverrides por position
 * (== índice de cena: cover=0, body i→i+1, cta=N+1).
 */
import type { Content } from '@/types/content'
import type {
  CardText,
  ContentText,
  DesignDocument,
  OverrideMap,
  SlideImage,
  SlideText,
  TemplateFamily,
  UserNode,
} from '@publisher/scene-engine'
import { parseScenePayload, type GroupMap } from './scene-payload'

type RawCard = { label?: string; icon?: string; title?: string; body?: string; highlight?: boolean }
/** Imagem por slide gravada em slidesData (snake_case, espelho do SlideImageInput do backend). */
export type RawSlideImage = {
  enabled: boolean
  role: 'figure' | 'background'
  prompt: string
  model: 'nano-banana' | 'gpt-5.5-image'
  seed?: number
  focal?: { x: number; y: number }
  treatment?: 'duotone' | 'grain' | 'none'
  status: 'idle' | 'queued' | 'generating' | 'ready' | 'failed'
  asset_url?: string
  asset_key?: string
  width?: number
  height?: number
  last_error?: string
}
type RawSlide = {
  label_topo?: string
  tag?: string
  headline_top?: string
  headline_em?: string
  headline_bottom?: string
  paragraphs?: string[]
  list?: string[]
  stats?: [string, string][]
  cards?: RawCard[]
  callout?: string
  /** sugestão de imagem emitida pelo LLM (usada como prompt default da geração). */
  image_prompt?: string
  image?: RawSlideImage
}
export type RawCarousel = {
  slug?: string
  template?: TemplateFamily
  persona?: string
  label_topo_capa?: string
  label_capa?: string
  hook_capa?: string
  slides?: RawSlide[]
  cta_label_topo?: string
  cta_label?: string
  cta_text?: string
  cta_sub?: string
  caption?: string
}

function mapCard(c: RawCard): CardText {
  return { label: c.label, icon: c.icon, title: c.title, body: c.body, highlight: c.highlight }
}

/** snake_case → camelCase, espelho exato do mapSlideImage do backend (carousel-to-doc.ts). */
function mapSlideImage(i: RawSlideImage): SlideImage {
  return {
    enabled: i.enabled,
    role: i.role,
    prompt: i.prompt,
    model: i.model,
    seed: i.seed,
    focal: i.focal,
    treatment: i.treatment,
    status: i.status,
    assetUrl: i.asset_url,
    assetKey: i.asset_key,
    width: i.width,
    height: i.height,
    lastError: i.last_error,
  }
}

function mapSlide(s: RawSlide): SlideText {
  return {
    labelTopo: s.label_topo,
    tag: s.tag,
    headlineTop: s.headline_top,
    headlineEm: s.headline_em,
    headlineBottom: s.headline_bottom,
    paragraphs: s.paragraphs,
    list: s.list,
    stats: s.stats,
    cards: s.cards?.map(mapCard),
    callout: s.callout,
    image: s.image ? mapSlideImage(s.image) : undefined,
  }
}

/** Constrói o ContentText preferindo slidesData (raw); fallback p/ campos camelCase do Content. */
function buildContentText(content: Content): ContentText {
  const raw = (content.slidesData ?? {}) as RawCarousel
  const template: TemplateFamily = raw.template ?? 'step'

  if (raw.slides && raw.slides.length) {
    return {
      slug: raw.slug ?? content.slug,
      template,
      persona: raw.persona ?? content.persona,
      labelTopoCapa: raw.label_topo_capa ?? content.labelTopoCapa,
      labelCapa: raw.label_capa ?? content.labelCapa,
      hookCapa: raw.hook_capa ?? content.hookCapa ?? '',
      slides: raw.slides.map(mapSlide),
      ctaLabelTopo: raw.cta_label_topo ?? content.ctaLabelTopo,
      ctaLabel: raw.cta_label ?? content.ctaLabel,
      ctaText: raw.cta_text ?? content.ctaText,
      ctaSub: raw.cta_sub ?? content.ctaSub,
      caption: raw.caption ?? content.caption,
    }
  }

  // fallback: deriva do Content camelCase + slides de corpo (exclui cover/cta por slideType).
  // Sem `image` aqui: o Slide camelCase não expõe bodyData/image — a imagem por
  // slide só existe via slidesData (raw), que é o caminho preferido acima.
  const body = content.slides.filter((s) => s.position > 0 && s.position < content.slides.length - 1)
  return {
    slug: content.slug,
    template,
    persona: content.persona,
    labelTopoCapa: content.labelTopoCapa,
    labelCapa: content.labelCapa,
    hookCapa: content.hookCapa ?? '',
    slides: body.map((s) => ({
      labelTopo: s.labelTopo,
      tag: s.tag,
      headlineTop: s.headlineTop,
      headlineEm: s.headlineEm,
      headlineBottom: s.headlineBottom,
      paragraphs: s.paragraphs,
      list: s.list,
      stats: s.stats,
      cards: s.cards?.map((c) => ({ label: c.label, icon: c.icon, title: c.title, body: c.body, highlight: c.highlight })),
      callout: s.callout,
    })),
    ctaLabelTopo: content.ctaLabelTopo,
    ctaLabel: content.ctaLabel,
    ctaText: content.ctaText,
    ctaSub: content.ctaSub,
    caption: content.caption,
  }
}

/** Overrides + elementos adicionados + grupos, por índice de cena (retrocompat v1/v2). */
export function collectScenePayloads(content: Content): {
  overrides: Record<number, OverrideMap>
  added: Record<number, UserNode[]>
  groups: Record<number, GroupMap>
} {
  const overrides: Record<number, OverrideMap> = {}
  const added: Record<number, UserNode[]> = {}
  const groups: Record<number, GroupMap> = {}
  for (const s of content.slides) {
    if (!s.sceneOverrides) continue
    const p = parseScenePayload(s.sceneOverrides)
    if (Object.keys(p.overrides).length) overrides[s.position] = p.overrides
    if (p.added.length) added[s.position] = p.added
    if (Object.keys(p.groups).length) groups[s.position] = p.groups
  }
  return { overrides, added, groups }
}

/** ContentText direto do CarouselInput cru (usado pela edição inline de texto). */
export function contentTextFromRaw(raw: RawCarousel): ContentText {
  return {
    slug: raw.slug ?? '',
    template: raw.template ?? 'step',
    persona: raw.persona,
    labelTopoCapa: raw.label_topo_capa,
    labelCapa: raw.label_capa,
    hookCapa: raw.hook_capa ?? '',
    slides: (raw.slides ?? []).map(mapSlide),
    ctaLabelTopo: raw.cta_label_topo,
    ctaLabel: raw.cta_label,
    ctaText: raw.cta_text,
    ctaSub: raw.cta_sub,
    caption: raw.caption,
  }
}

export function docFromRaw(raw: RawCarousel, overrides?: Record<number, OverrideMap>): DesignDocument {
  return { schemaVersion: 1, content: contentTextFromRaw(raw), overrides }
}

export function contentToDoc(content: Content): DesignDocument {
  const { overrides, added } = collectScenePayloads(content)
  return {
    schemaVersion: 1,
    content: buildContentText(content),
    overrides: Object.keys(overrides).length ? overrides : undefined,
    added: Object.keys(added).length ? added : undefined,
  }
}

/** slidesData cru inicial p/ o draft de texto. */
export function initialRaw(content: Content): RawCarousel {
  return (content.slidesData ?? {}) as RawCarousel
}

/** Mapa position(scene index) → Slide.id, p/ persistir overrides via PATCH /slides/:id. */
export function slideIdByPosition(content: Content): Map<number, string> {
  const m = new Map<number, string>()
  for (const s of content.slides) m.set(s.position, s.id)
  return m
}
