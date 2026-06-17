import { api } from '@/lib/api-client'
import type { Content, CreateContentInput } from '@/types/content'
import type { PaginatedResponse } from '@/types/api'
import type { ContentFilterParams } from '../types/content-filters'
import { mapApiContent } from '../lib/content-mapper'

/**
 * The backend `/contents` endpoint runs a strict ValidationPipe
 * (`forbidNonWhitelisted: true`) and accepts only `page`, `limit`, `status`,
 * `contentType`, `persona`, `pattern` and `search`. Any extra query key
 * (e.g. the UI's `pageSize`/`platform`) makes it reject the request with a
 * 400, which silently empties the listing. Translate the UI filter shape into
 * that contract here, forwarding only supported keys, and normalize the
 * `{ data, meta }` response back into the frontend `PaginatedResponse` shape.
 */
type BackendListResponse = {
  data: Content[]
  meta: { total: number; page: number; limit: number; totalPages: number }
}

export async function getContents(params: ContentFilterParams): Promise<PaginatedResponse<Content>> {
  const { pageSize, platform, ...rest } = params
  const query: Record<string, unknown> = { ...rest }
  if (pageSize !== undefined) query.limit = pageSize

  const { data } = await api.get<BackendListResponse>('/contents', { params: query })
  return {
    data: data.data.map(mapApiContent),
    total: data.meta.total,
    page: data.meta.page,
    pageSize: data.meta.limit,
    totalPages: data.meta.totalPages,
  }
}

export async function getContent(id: string): Promise<Content> {
  const { data } = await api.get<Content>(`/contents/${id}`)
  return mapApiContent(data)
}

export async function createContent(input: CreateContentInput): Promise<Content> {
  const { data } = await api.post<Content>('/contents', input)
  return mapApiContent(data)
}

export async function updateContent(id: string, input: Partial<CreateContentInput>): Promise<Content> {
  const { data } = await api.patch<Content>(`/contents/${id}`, input)
  return mapApiContent(data)
}

export async function deleteContent(id: string): Promise<void> {
  await api.delete(`/contents/${id}`)
}

export async function duplicateContent(id: string): Promise<Content> {
  const { data } = await api.post<Content>(`/contents/${id}/duplicate`)
  return mapApiContent(data)
}

export async function bulkDeleteContents(ids: string[]): Promise<void> {
  await api.post('/contents/bulk-delete', { ids })
}

export async function bulkUpdateStatus(ids: string[], status: string): Promise<void> {
  await api.post('/contents/bulk-status', { ids, status })
}
