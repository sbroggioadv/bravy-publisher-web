import { api } from '@/lib/api-client'
import type { RenderJob } from '@/types/content'

export async function triggerRender(contentId: string): Promise<RenderJob> {
  const { data } = await api.post<RenderJob>(`/render/${contentId}`)
  return data
}

export async function getRenderStatus(contentId: string): Promise<RenderJob | null> {
  const { data } = await api.get<RenderJob | null>(`/render/${contentId}/status`)
  return data
}
