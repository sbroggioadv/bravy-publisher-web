'use client'

import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'

// client-only: o preview usa canvas + FontFace (mesmo engine do estúdio)
const BrandKitEditor = dynamic(
  () => import('@/features/content/studio/BrandKitEditor').then((m) => m.BrandKitEditor),
  { ssr: false, loading: () => <Skeleton className="h-96 w-full rounded-xl" /> },
)

export default function BrandSettingsPage() {
  return <BrandKitEditor />
}
