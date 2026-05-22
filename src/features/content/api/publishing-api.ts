import { api } from '@/lib/api-client'
import type { PublishTarget } from '@/types/content'

export interface PublishInput {
  socialAccountId: string
  scheduledAt?: string
}

export async function publishContent(
  contentId: string,
  input: PublishInput,
): Promise<PublishTarget> {
  const { data } = await api.post<PublishTarget>(`/publish/${contentId}`, input)
  return data
}
