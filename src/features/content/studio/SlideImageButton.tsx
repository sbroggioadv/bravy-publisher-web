'use client'

/**
 * Imagem por slide do template tweet (P1). Visível só quando o template é
 * tweet e o slide ativo é de corpo. "Gerar" abre popover com descrição
 * opcional (sem ela, o backend usa o image_prompt do LLM) e chama o POST;
 * "Remover" chama o DELETE. Ambos invalidam a query do Content → o
 * StudioShell re-inicializa o draft (obrigatório no remove: um draft
 * desatualizado com `image` explícita ressuscitaria a imagem no autosave).
 */
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ImageOff, ImagePlus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { generateSlideImage, removeSlideImage } from './api/studio-api'
import { useStudioStore } from './studio-store'

interface SlideImageButtonProps {
  contentId: string
  position: number
  /** total de slides de cena; corpo = 1..total-2 */
  total: number
}

export function SlideImageButton({ contentId, position, total }: SlideImageButtonProps) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [prompt, setPrompt] = useState('')
  // template + imagem atual vêm do draft (slidesData cru) — mesma fonte da cena
  const template = useStudioStore((s) => s.draft?.template)
  const hasImage = useStudioStore((s) => !!s.draft?.slides?.[position - 1]?.image)
  const isBody = position >= 1 && position <= total - 2

  const generate = useMutation({
    mutationFn: () => generateSlideImage(contentId, position, prompt.trim() || undefined),
    onSuccess: async () => {
      setOpen(false)
      setPrompt('')
      await qc.invalidateQueries({ queryKey: ['content', contentId] })
      toast.success('Imagem gerada')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Falha ao gerar imagem'),
  })

  const remove = useMutation({
    mutationFn: () => removeSlideImage(contentId, position),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['content', contentId] })
      toast.success('Imagem removida')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Falha ao remover imagem'),
  })

  if (template !== 'tweet' || !isBody) return null

  return (
    <div className="relative flex items-center gap-1">
      {hasImage && (
        <Button variant="ghost" size="sm" onClick={() => remove.mutate()} disabled={remove.isPending || generate.isPending}>
          {remove.isPending ? <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" /> : <ImageOff className="size-3.5" data-icon="inline-start" />}
          Remover imagem
        </Button>
      )}
      <Button variant="outline" size="sm" onClick={() => setOpen((o) => !o)} disabled={generate.isPending || remove.isPending}>
        {generate.isPending ? <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" /> : <ImagePlus className="size-3.5" data-icon="inline-start" />}
        Gerar imagem
      </Button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-72 rounded-lg border border-border bg-popover p-3 shadow-lg">
          <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Descrição da imagem (opcional)</label>
          <textarea
            className="w-full resize-none rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-[#C7634F]"
            rows={3}
            maxLength={600}
            placeholder="Sem preencher, usa a sugestão criada pela IA para este slide"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={() => generate.mutate()} disabled={generate.isPending}>
              Gerar
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
