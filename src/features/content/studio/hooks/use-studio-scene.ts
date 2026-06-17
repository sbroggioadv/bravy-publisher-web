'use client'

/**
 * Resolve a cena viva do estúdio: doc (texto do Content) + overrides (store) →
 * resolveScene com as métricas do browser. Memoizado por (metrics, doc,
 * overrides) → repintura só quando algo muda (RFC §5.5).
 */
import { useEffect, useMemo, useState } from 'react'
import {
  resolveScene,
  type BrandKit,
  type MetricsProvider,
  type SceneGraph,
  type UserNode,
} from '@publisher/scene-engine'
import type { Content } from '@/types/content'
import { contentToDoc, docFromRaw } from '../lib/content-to-doc'
import { ensureFamilyLoaded, ensureStudioFonts, isFamilyLoaded, sanitizeKit } from '../lib/browser-metrics'
import { useStudioStore } from '../studio-store'
import { useBrandKit } from './use-brand-kit'

export interface StudioScene {
  scene: SceneGraph | null
  metrics: MetricsProvider | null
  /** kit em uso (Sprint 6: virá do tenant via API; hoje, seed). */
  brandKit: BrandKit
  ready: boolean
  fontError: string | null
}

export function useStudioScene(content: Content): StudioScene {
  const [metrics, setMetrics] = useState<MetricsProvider | null>(null)
  const [fontError, setFontError] = useState<string | null>(null)
  const { kit: tenantKit } = useBrandKit()
  const style = useStudioStore((s) => s.style)
  // estilo do POST sobrepõe o kit do tenant (tipografia/paleta; brand opcional)
  const kit = useMemo<BrandKit>(() => {
    if (!style) return tenantKit
    return {
      ...tenantKit,
      typography: style.typography,
      palette: style.palette,
      brand: style.brand ?? tenantKit.brand,
    }
  }, [tenantKit, style])
  const overrides = useStudioStore((s) => s.overrides)
  const added = useStudioStore((s) => s.added)
  const draft = useStudioStore((s) => s.draft)

  // carrega seed + famílias Google do kit; re-roda quando as famílias mudam
  const kitFamilies = Object.values(kit.typography).map((r) => `${r.source}:${r.family}`).join('|')
  useEffect(() => {
    let alive = true
    ensureStudioFonts(kit)
      .then((m) => alive && setMetrics(m))
      .catch((e) => alive && setFontError(e instanceof Error ? e.message : String(e)))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kitFamilies])

  // famílias custom (elementos livres + overrides de template) → sob demanda
  const addedFamilies = useMemo(() => {
    const fams = new Set<string>()
    for (const n of Object.values(added).flat()) {
      if (n.kind === 'text' && n.family) fams.add(n.family)
    }
    for (const map of Object.values(overrides)) {
      for (const ov of Object.values(map)) {
        if (ov.family) fams.add(ov.family)
      }
    }
    return [...fams].join('|')
  }, [added, overrides])
  useEffect(() => {
    if (!addedFamilies) return
    let alive = true
    Promise.all(addedFamilies.split('|').map((f) => ensureFamilyLoaded(f))).then(async () => {
      if (!alive) return
      const m = await ensureStudioFonts() // identidade nova → re-resolve
      if (alive) setMetrics(m)
    })
    return () => {
      alive = false
    }
  }, [addedFamilies])

  // texto vem do draft (editável); se não houver draft com slides, cai no Content
  const baseDoc = useMemo(() => {
    if (draft && Array.isArray(draft.slides) && draft.slides.length) return docFromRaw(draft)
    return contentToDoc(content)
  }, [content, draft])

  const scene = useMemo(() => {
    if (!metrics) return null
    // famílias ainda não carregadas degradam (kit → seed; elemento/override → padrão)
    const safeAdded: typeof added = Object.fromEntries(
      Object.entries(added).map(([i, list]) => [
        i,
        list.map((n) => (n.kind === 'text' && n.family && !isFamilyLoaded(n.family) ? { ...n, family: undefined } : n)),
      ]),
    )
    const safeOverrides: typeof overrides = Object.fromEntries(
      Object.entries(overrides).map(([i, map]) => [
        i,
        Object.fromEntries(
          Object.entries(map).map(([id, ov]) => [id, ov.family && !isFamilyLoaded(ov.family) ? { ...ov, family: undefined } : ov]),
        ),
      ]),
    )
    return resolveScene({ ...baseDoc, overrides: safeOverrides, added: safeAdded }, metrics, sanitizeKit(kit))
  }, [metrics, baseDoc, overrides, added, kit])

  return { scene, metrics, brandKit: kit, ready: !!scene, fontError }
}
