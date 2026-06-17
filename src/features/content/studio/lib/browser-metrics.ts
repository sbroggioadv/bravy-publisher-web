/**
 * Métricas + fontes no browser (RFC §3.2 / §4.3 / §13.3). Carrega os MESMOS
 * bytes de fonte que o server: seed de /public/fonts e famílias Google do
 * cache MinIO (manifest via /fonts/ensure). fontkit mede (quebra idêntica nos
 * dois runtimes) e FontFace registra pro ctx.fillText desenhar os glifos.
 * Carregamento INCREMENTAL: famílias do kit entram sob demanda; quem falhar
 * degrada pro papel do seed (sanitizeKit) — o estúdio nunca quebra por fonte.
 */
import { create as createFont } from 'fontkit'
import {
  FontkitMetrics,
  SEED_BRAND_KIT,
  SEED_FONT_MANIFEST,
  type BrandKit,
  type MetricsProvider,
} from '@publisher/scene-engine'
import { ensureFont } from '../api/fonts-api'

let shared: FontkitMetrics | null = null
let seedPromise: Promise<FontkitMetrics> | null = null
const familyLoads = new Map<string, Promise<void>>()

async function loadSeed(): Promise<FontkitMetrics> {
  const m = new FontkitMetrics()
  await Promise.all(
    SEED_FONT_MANIFEST.map(async (f) => {
      const buf = await fetch(`/fonts/${f.file}`).then((r) => {
        if (!r.ok) throw new Error(`Falha ao baixar fonte ${f.file}: ${r.status}`)
        return r.arrayBuffer()
      })
      m.register(f.family, f.italic, { font: createFont(new Uint8Array(buf)), variable: f.variable })
      if (typeof document !== 'undefined' && 'fonts' in document) {
        const face = new FontFace(f.family, buf, {
          style: f.italic ? 'italic' : 'normal',
          weight: f.variable ? '100 900' : '400',
        } as FontFaceDescriptors)
        document.fonts.add(await face.load())
      }
    }),
  )
  shared = m
  return m
}

/** baixa e registra uma família Google (1x; bytes do cache MinIO). */
function loadGoogleFamily(m: FontkitMetrics, family: string): Promise<void> {
  let p = familyLoads.get(family)
  if (!p) {
    p = (async () => {
      const manifest = await ensureFont(family)
      await Promise.all(
        manifest.variants.map(async (v) => {
          const buf = await fetch(v.url).then((r) => {
            if (!r.ok) throw new Error(`fonte ${family} ${v.weight}: ${r.status}`)
            return r.arrayBuffer()
          })
          m.register(family, v.italic, { font: createFont(new Uint8Array(buf)), variable: false, weight: v.weight })
          if (typeof document !== 'undefined' && 'fonts' in document) {
            const face = new FontFace(family, buf, {
              style: v.italic ? 'italic' : 'normal',
              weight: String(v.weight),
            } as FontFaceDescriptors)
            document.fonts.add(await face.load())
          }
        }),
      )
    })().catch((e) => {
      familyLoads.delete(family) // permite re-tentar depois
      console.warn(`[studio] família "${family}" indisponível; usando fallback do seed`, e)
    })
    familyLoads.set(family, p)
  }
  return p
}

/**
 * Garante seed + famílias Google do kit. Retorna um wrapper com identidade
 * NOVA a cada chamada (invalida memos do React quando novas fontes chegam).
 */
export async function ensureStudioFonts(kit?: BrandKit): Promise<MetricsProvider> {
  if (!seedPromise) seedPromise = loadSeed()
  const m = await seedPromise
  if (kit) {
    const families = [...new Set(Object.values(kit.typography).filter((r) => r.source === 'google').map((r) => r.family))]
    await Promise.all(families.map((f) => loadGoogleFamily(m, f)))
  }
  return { measure: m.measure.bind(m) }
}

/** carrega uma família avulsa (fonte direta de um elemento de texto). */
export async function ensureFamilyLoaded(family: string): Promise<void> {
  if (!seedPromise) seedPromise = loadSeed()
  const m = await seedPromise
  await loadGoogleFamily(m, family)
}

/** a família já está medível (seed ou carregada)? */
export function isFamilyLoaded(family: string): boolean {
  return !!shared && (shared.has(family, false) || shared.has(family, true))
}

/** papéis cuja família não carregou caem pro papel equivalente do seed. */
export function sanitizeKit(kit: BrandKit): BrandKit {
  if (!shared) return SEED_BRAND_KIT
  const typography = { ...kit.typography }
  let changed = false
  for (const role of ['display', 'body', 'mono', 'accent'] as const) {
    if (!shared.has(typography[role].family, false) && !shared.has(typography[role].family, true)) {
      typography[role] = SEED_BRAND_KIT.typography[role]
      changed = true
    }
  }
  return changed ? { ...kit, typography } : kit
}
