'use client'

/**
 * Carrega o StudioShell client-only (canvas + Konva + FontFace não rodam no
 * SSR). dynamic(ssr:false) precisa viver dentro de um Client Component (Next 16).
 */
import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'

const StudioShell = dynamic(() => import('./StudioShell'), {
  ssr: false,
  loading: () => (
    <div className="p-4">
      <Skeleton className="h-[80vh] w-full rounded-xl" />
    </div>
  ),
})

export function StudioContainer({ contentId }: { contentId: string }) {
  return <StudioShell contentId={contentId} />
}
