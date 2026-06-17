'use client'

/**
 * Demo do estúdio SEM backend (fora do grupo (app) → sem auth guard).
 * Testa: seleção, drag c/ snapping, resize (rect/texto), edição inline,
 * undo/redo, thumbnails. Persistência/export falham de propósito (sem API).
 */
import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'
import { DEMO_CONTENT } from '@/features/content/studio/demo-content'

const StudioEditor = dynamic(
  () => import('@/features/content/studio/StudioShell').then((m) => m.StudioEditor),
  {
    ssr: false,
    loading: () => (
      <div className="p-4">
        <Skeleton className="h-[80vh] w-full rounded-xl" />
      </div>
    ),
  },
)

export default function StudioDemoPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-amber-500/10 px-4 py-1.5 text-xs text-amber-700 dark:text-amber-400">
        Demo sem backend — edição funciona; salvar/exportar falham de propósito.
      </div>
      <StudioEditor content={DEMO_CONTENT} />
    </div>
  )
}
