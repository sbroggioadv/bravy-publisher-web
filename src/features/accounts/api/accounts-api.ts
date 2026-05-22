import { api } from '@/lib/api-client'
import type { Platform, SocialAccount } from '@/types/social-account'

export async function getAccounts(): Promise<SocialAccount[]> {
  const { data } = await api.get<SocialAccount[]>('/social-accounts')
  return data
}

export async function disconnectAccount(id: string): Promise<void> {
  await api.delete(`/social-accounts/${id}`)
}

export async function startOAuth(platform: Platform): Promise<{ authUrl: string }> {
  const slug = platform.toLowerCase()
  const { data } = await api.get<{ authUrl: string }>(`/oauth/${slug}/start`)
  return data
}
