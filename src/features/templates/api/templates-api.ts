import { api } from '@/lib/api-client'
import type { Template } from '@/types/template'
import type { Persona } from '@/types/content'
import type { TemplateFamily } from '@/types/template'

export interface TemplateFilters {
  family?: TemplateFamily
  persona?: Persona
}

/**
 * The backend `/templates` endpoint returns a paginated `{ data, meta }`
 * envelope (see TemplatesService.findAll). Unwrap it here so consumers
 * receive a plain `Template[]`.
 */
type BackendListResponse = {
  data: Template[]
  meta: { total: number; page: number; limit: number; totalPages: number }
}

export async function getTemplates(filters?: TemplateFilters): Promise<Template[]> {
  const { data } = await api.get<BackendListResponse>('/templates', { params: filters })
  return data.data
}

export async function getTemplate(id: string): Promise<Template> {
  const { data } = await api.get<Template>(`/templates/${id}`)
  return data
}
