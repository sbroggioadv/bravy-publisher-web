import { api } from '@/lib/api-client'

export interface SlidePatch {
  sceneOverrides?: Record<string, unknown>
  imageUrl?: string
  imageKey?: string
  bodyData?: Record<string, unknown>
}

/** PATCH /contents/:contentId/slides/:slideId — persiste overrides/imagem/texto do slide. */
export async function patchSlide(contentId: string, slideId: string, data: SlidePatch): Promise<void> {
  await api.patch(`/contents/${contentId}/slides/${slideId}`, data)
}

/** PATCH /contents/:id { slidesData } — persiste a edição inline de texto (CarouselInput cru). */
export async function saveSlidesData(contentId: string, slidesData: Record<string, unknown>): Promise<void> {
  await api.patch(`/contents/${contentId}`, { slidesData })
}

/** POST /generation/regenerate-slide — regenera 1 slide de corpo (reconcilia overrides daquele slide). */
export async function regenerateSlide(contentId: string, position: number, hint?: string): Promise<void> {
  await api.post('/generation/regenerate-slide', { contentId, position, hint })
}

/** Upload do PNG exportado (multipart) → MinIO. Deixa o browser definir o boundary. */
export async function uploadSlideImage(
  contentId: string,
  position: number,
  blob: Blob,
): Promise<{ imageUrl: string; imageKey: string }> {
  const fd = new FormData()
  fd.append('file', blob, `slide-${String(position).padStart(2, '0')}.png`)
  fd.append('contentId', contentId)
  fd.append('position', String(position))
  const { data } = await api.post<{ imageUrl: string; imageKey: string }>('/uploads/slide-image', fd, {
    headers: { 'Content-Type': undefined as unknown as string },
  })
  return data
}
