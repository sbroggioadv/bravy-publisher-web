import { api } from '@/lib/api-client'
import type { BrandKit } from '@publisher/scene-engine'

type ApiBrandKit = {
  id: string
  tenantId: string
  version: number
  typography: BrandKit['typography']
  palette: BrandKit['palette']
  brand: BrandKit['brand']
}

/** Kit default do tenant (seed lazy no backend). */
export async function getBrandKit(): Promise<BrandKit> {
  const { data } = await api.get<ApiBrandKit>('/brand-kit')
  return {
    id: data.id,
    tenantId: data.tenantId,
    version: data.version,
    typography: data.typography,
    palette: data.palette,
    brand: data.brand,
  }
}

export async function updateBrandKit(patch: {
  typography?: BrandKit['typography']
  palette?: BrandKit['palette']
  brand?: BrandKit['brand']
}): Promise<BrandKit> {
  const { data } = await api.patch<ApiBrandKit>('/brand-kit', patch)
  return data
}

export async function resetBrandKit(): Promise<BrandKit> {
  const { data } = await api.post<ApiBrandKit>('/brand-kit/reset')
  return data
}
