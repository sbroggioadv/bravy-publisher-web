'use client'

/**
 * Kit do tenant (RFC §13). Fallback = seed editorial: cobre o /studio-demo
 * (sem backend), erro de rede e o primeiro paint enquanto carrega.
 */
import { useQuery } from '@tanstack/react-query'
import { SEED_BRAND_KIT, type BrandKit } from '@publisher/scene-engine'
import { getBrandKit } from '../api/brand-kit-api'

export function useBrandKit(): { kit: BrandKit; isLoading: boolean } {
  const hasSession = typeof window !== 'undefined' && !!localStorage.getItem('access_token')
  const { data, isLoading } = useQuery({
    queryKey: ['brand-kit'],
    queryFn: getBrandKit,
    staleTime: 60_000,
    retry: 1,
    enabled: hasSession, // demo/público: usa o seed direto
  })
  return { kit: data ?? SEED_BRAND_KIT, isLoading: hasSession && isLoading }
}
