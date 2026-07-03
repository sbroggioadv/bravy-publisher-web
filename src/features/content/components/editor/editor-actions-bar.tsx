'use client'

import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { EditorStatusBar } from './editor-status-bar'
import { Save, CalendarClock, Send } from 'lucide-react'
import type { ContentStatus } from '@/types/content'

interface EditorActionsBarProps {
  status: ContentStatus
  lastSavedAt: string | null
  isSaving: boolean
  onSaveDraft: () => void
  onSchedule: () => void
  onPublish: () => void
}

export function EditorActionsBar({
  status,
  lastSavedAt,
  isSaving,
  onSaveDraft,
  onSchedule,
  onPublish,
}: EditorActionsBarProps) {
  return (
    <div className="sticky bottom-0 z-10 border-t bg-background/95 backdrop-blur-sm">
      <div className="flex items-center justify-between px-4 py-3">
        <EditorStatusBar
          status={status}
          lastSavedAt={lastSavedAt}
          isSaving={isSaving}
        />
        <div className="flex items-center gap-2">
          <Button variant="default" size="sm" onClick={onSaveDraft} disabled={isSaving}>
            <Save className="size-3.5" data-icon="inline-start" />
            Salvar rascunho
          </Button>
          <Separator orientation="vertical" className="h-5" />
          <Button variant="outline" size="sm" onClick={onSchedule}>
            <CalendarClock className="size-3.5" data-icon="inline-start" />
            Agendar
          </Button>
          <Button variant="destructive" size="sm" onClick={onPublish}>
            <Send className="size-3.5" data-icon="inline-start" />
            Publicar agora
          </Button>
        </div>
      </div>
    </div>
  )
}
