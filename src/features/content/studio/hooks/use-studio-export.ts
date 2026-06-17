'use client'

/**
 * Export client (RFC §4.4/§7): rasteriza cada slide offscreen 2x via o mesmo
 * paintSlide → blob → upload MinIO → grava imageUrl/imageKey no slide.
 */
import { useCallback, useState } from 'react'
import type { MetricsProvider, SceneGraph } from '@publisher/scene-engine'
import type { Content } from '@/types/content'
import { exportSlideBlob } from '../lib/paint-canvas'
import { slideIdByPosition } from '../lib/content-to-doc'
import { patchSlide, uploadSlideImage } from '../api/studio-api'

export function useStudioExport(content: Content) {
  const [exporting, setExporting] = useState(false)
  const [done, setDone] = useState(0)
  const [total, setTotal] = useState(0)

  const exportAll = useCallback(
    async (scene: SceneGraph, metrics: MetricsProvider): Promise<number> => {
      setExporting(true)
      setDone(0)
      setTotal(scene.slides.length)
      const ids = slideIdByPosition(content)
      try {
        for (const slide of scene.slides) {
          const blob = await exportSlideBlob(slide, metrics, 2)
          const { imageUrl, imageKey } = await uploadSlideImage(content.id, slide.index, blob)
          const slideId = ids.get(slide.index)
          if (slideId) await patchSlide(content.id, slideId, { imageUrl, imageKey })
          setDone((d) => d + 1)
        }
        return scene.slides.length
      } finally {
        setExporting(false)
      }
    },
    [content],
  )

  return { exporting, done, total, exportAll }
}
