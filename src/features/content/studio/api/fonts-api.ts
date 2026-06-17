import { api } from '@/lib/api-client'

export interface CatalogEntry {
  family: string
  category: string
  curated?: boolean
}

export interface FontVariant {
  weight: number
  italic: boolean
  key: string
  url: string
}

export interface FamilyManifest {
  family: string
  category?: string
  variants: FontVariant[]
}

export async function searchFonts(q?: string): Promise<{ shortlist: CatalogEntry[]; results: CatalogEntry[] }> {
  const { data } = await api.get('/fonts/catalog', { params: q ? { q } : {} })
  return data
}

/** baixa/cacheia a família no servidor e devolve o manifest de variantes. */
export async function ensureFont(family: string): Promise<FamilyManifest> {
  const { data } = await api.post('/fonts/ensure', { family })
  return data
}
