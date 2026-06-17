'use client'

/**
 * Persiste o payload de cena (overrides do template + elementos adicionados)
 * com debounce — PATCH slide.sceneOverrides no formato v2. Salva só os slides
 * cujo payload mudou; mantém `dirty` se a rede falhar.
 */
import { useEffect, useRef } from 'react'
import type { Content } from '@/types/content'
import { slideIdByPosition } from '../lib/content-to-doc'
import { buildScenePayload, parseScenePayload } from '../lib/scene-payload'
import { patchSlide } from '../api/studio-api'
import { useStudioStore } from '../studio-store'

export function usePersistOverrides(content: Content, debounceMs = 1200): void {
  const overrides = useStudioStore((s) => s.overrides)
  const added = useStudioStore((s) => s.added)
  const groups = useStudioStore((s) => s.groups)
  const dirty = useStudioStore((s) => s.dirty)
  const markClean = useStudioStore((s) => s.markClean)
  const lastSaved = useRef<Record<number, string>>({})
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // seed do diff com o payload já salvo no servidor — sem isso, um payload que
  // sai de um índice (reordenação de slides) não gera o PATCH de limpeza na
  // linha antiga, e o render server aplicaria overrides do slide errado.
  useEffect(() => {
    const seeded: Record<number, string> = {}
    for (const s of content.slides) {
      if (!s.sceneOverrides) continue
      const p = parseScenePayload(s.sceneOverrides)
      seeded[s.position] = JSON.stringify(buildScenePayload(p.overrides, p.added, p.groups))
    }
    lastSaved.current = seeded
  }, [content.id, content.updatedAt, content.slides])

  useEffect(() => {
    if (!dirty) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      const ids = slideIdByPosition(content)
      const indices = new Set<number>([
        ...Object.keys(overrides).map(Number),
        ...Object.keys(added).map(Number),
        ...Object.keys(groups).map(Number),
        ...Object.keys(lastSaved.current).map(Number),
      ])
      for (const idx of indices) {
        const payload = buildScenePayload(overrides[idx] ?? {}, added[idx] ?? [], groups[idx] ?? {})
        const json = JSON.stringify(payload)
        if (lastSaved.current[idx] === json) continue
        const slideId = ids.get(idx)
        if (!slideId) continue
        try {
          await patchSlide(content.id, slideId, { sceneOverrides: payload })
          lastSaved.current[idx] = json
        } catch {
          /* mantém dirty; tenta no próximo ciclo */
        }
      }
      markClean()
    }, debounceMs)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [overrides, added, groups, dirty, content, debounceMs, markClean])
}
