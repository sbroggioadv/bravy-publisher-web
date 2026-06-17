'use client'

/**
 * Persiste a edição inline de texto com debounce: PATCH /contents/:id
 * { slidesData } (mesma fonte que o worker server consome → render fica em sync).
 */
import { useEffect, useRef } from 'react'
import type { Content } from '@/types/content'
import { api } from '@/lib/api-client'
import { useStudioStore } from '../studio-store'

/** Persiste texto (slidesData) e estilo do post (styleData) com debounce. */
export function usePersistText(content: Content, debounceMs = 1500): void {
  const draft = useStudioStore((s) => s.draft)
  const style = useStudioStore((s) => s.style)
  const textDirty = useStudioStore((s) => s.textDirty)
  const styleDirty = useStudioStore((s) => s.styleDirty)
  const markTextClean = useStudioStore((s) => s.markTextClean)
  const markStyleClean = useStudioStore((s) => s.markStyleClean)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSaved = useRef<string | null>(null)

  useEffect(() => {
    if ((!textDirty && !styleDirty) || !draft) return
    const json = JSON.stringify({ draft, style })
    if (json === lastSaved.current) {
      markTextClean()
      markStyleClean()
      return
    }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      try {
        await api.patch(`/contents/${content.id}`, {
          slidesData: draft,
          // template da família acompanha o estilo (worker antigo lê daqui)
          ...(draft.template ? { template: draft.template } : {}),
          styleData: style ?? undefined,
        })
        lastSaved.current = json
        markTextClean()
        markStyleClean()
      } catch {
        /* mantém dirty; tenta no próximo ciclo */
      }
    }, debounceMs)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [draft, style, textDirty, styleDirty, content.id, debounceMs, markTextClean, markStyleClean])
}
