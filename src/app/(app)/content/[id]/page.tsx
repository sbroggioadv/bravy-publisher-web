'use client'

import { use } from 'react'
import { useSearchParams } from 'next/navigation'
import { EditorContainer } from '@/features/content/components/editor/editor-container'
import { StudioContainer } from '@/features/content/studio/studio-container'

export default function ContentEditorPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const sp = useSearchParams()
  // Estúdio Konva é o DEFAULT (cutover Sprint 3). ?legacy=1 volta pro editor antigo.
  const legacy = sp.get('legacy') === '1'

  return legacy ? <EditorContainer contentId={id} /> : <StudioContainer contentId={id} />
}
