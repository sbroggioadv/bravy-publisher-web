'use client'

/**
 * Regenera o slide de corpo ativo (RFC §6.4). Abre um popover p/ um hint
 * opcional, chama o backend e invalida a query do Content → o StudioShell
 * recarrega e re-inicializa (overrides do slide regenerado já vêm zerados do
 * backend; os dos demais slides ficam intactos).
 */
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { regenerateSlide } from './api/studio-api'

interface RegenerateSlideButtonProps {
  contentId: string
  position: number
  /** total de slides de cena; corpo = 1..total-2 */
  total: number
}

export function RegenerateSlideButton({ contentId, position, total }: RegenerateSlideButtonProps) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [hint, setHint] = useState('')
  const isBody = position >= 1 && position <= total - 2

  const mutation = useMutation({
    mutationFn: () => regenerateSlide(contentId, position, hint.trim() || undefined),
    onSuccess: async () => {
      setOpen(false)
      setHint('')
      await qc.invalidateQueries({ queryKey: ['content', contentId] })
      toast.success('Slide regenerado')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Falha ao regenerar'),
  })

  if (!isBody) return null

  return (
    <div className="relative">
      <Button variant="outline" size="sm" onClick={() => setOpen((o) => !o)} disabled={mutation.isPending}>
        {mutation.isPending ? <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" /> : <Sparkles className="size-3.5" data-icon="inline-start" />}
        Regenerar slide
      </Button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-72 rounded-lg border border-border bg-popover p-3 shadow-lg">
          <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Ajuste (opcional)</label>
          <textarea
            className="w-full resize-none rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-[#C7634F]"
            rows={2}
            placeholder="ex.: mais direto, com um número de impacto"
            value={hint}
            onChange={(e) => setHint(e.target.value)}
          />
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              Regenerar
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
