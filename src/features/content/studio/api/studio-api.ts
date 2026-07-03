import { isAxiosError } from 'axios'
import type { SlideImage } from '@publisher/scene-engine'
import { api } from '@/lib/api-client'

/** Extrai a mensagem de erro do backend (NestJS: message string|string[]) — o
 *  AxiosError cru só traria "Request failed with status code NNN". */
function apiError(e: unknown, fallback: string): Error {
  if (isAxiosError(e)) {
    const msg = (e.response?.data as { message?: string | string[] } | undefined)?.message
    if (Array.isArray(msg) && msg.length) return new Error(msg.join(' '))
    if (typeof msg === 'string' && msg) return new Error(msg)
  }
  return e instanceof Error ? e : new Error(fallback)
}

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

/** POST /generation/:contentId/slides/:position/image — gera a imagem do slide
 *  (template tweet). Sem `prompt`, o backend usa o image_prompt gravado no slide. */
export async function generateSlideImage(contentId: string, position: number, prompt?: string): Promise<SlideImage> {
  try {
    const { data } = await api.post<SlideImage>(
      `/generation/${contentId}/slides/${position}/image`,
      prompt ? { prompt } : {},
    )
    return data
  } catch (e) {
    throw apiError(e, 'Falha ao gerar imagem')
  }
}

/** DELETE /generation/:contentId/slides/:position/image — remove a imagem do slide. */
export async function removeSlideImage(contentId: string, position: number): Promise<void> {
  try {
    await api.delete(`/generation/${contentId}/slides/${position}/image`)
  } catch (e) {
    throw apiError(e, 'Falha ao remover imagem')
  }
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
