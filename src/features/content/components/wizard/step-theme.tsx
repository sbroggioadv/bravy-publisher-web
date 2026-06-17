'use client'

import { useState } from 'react'
import { Lightbulb, Loader2, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import { useWizardStore, type WizardTemplate } from './wizard-store'

const MAX_CHARS = 500

/** famílias visuais do scene-engine (escolha explícita; auto = decide pelo padrão). */
const TEMPLATES: Array<{ value: WizardTemplate; label: string; desc: string }> = [
  { value: 'auto', label: 'Automático', desc: 'Escolhe pelo padrão do hook' },
  { value: 'step', label: 'Editorial', desc: 'Serif + creme, passos numerados' },
  { value: 'compendium', label: 'Terminal', desc: 'Caixa escura estilo terminal' },
]

export function StepTheme() {
  const theme = useWizardStore((s) => s.theme)
  const setTheme = useWizardStore((s) => s.setTheme)
  const persona = useWizardStore((s) => s.persona)
  const pattern = useWizardStore((s) => s.pattern)
  const template = useWizardStore((s) => s.template)
  const setTemplate = useWizardStore((s) => s.setTemplate)

  const [ideas, setIdeas] = useState<string[]>([])
  const [loadingIdeas, setLoadingIdeas] = useState(false)

  const handleSuggestIdeas = async () => {
    setLoadingIdeas(true)
    try {
      const { data } = await api.post<{ ideas: string[] }>(
        '/generation/suggest-theme',
        {
          persona: persona ?? undefined,
          pattern: pattern ?? undefined,
          hint: theme.trim() || undefined,
        }
      )
      if (data.ideas?.length) {
        setIdeas(data.ideas)
      } else {
        toast.error('Nao consegui gerar ideias. Tente de novo.')
      }
    } catch {
      toast.error('Erro ao gerar ideias. Tente de novo.')
    } finally {
      setLoadingIdeas(false)
    }
  }

  const handlePickIdea = (idea: string) => {
    setTheme(idea.slice(0, MAX_CHARS))
    setIdeas([])
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Defina o tema</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Sobre o que sera o conteudo?
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="theme-input">Descreva o tema do conteudo</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleSuggestIdeas}
            disabled={loadingIdeas}
            className="text-primary"
          >
            {loadingIdeas ? (
              <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
            ) : (
              <Lightbulb className="size-4" data-icon="inline-start" />
            )}
            {loadingIdeas ? 'Gerando ideias...' : 'Gerar ideia'}
          </Button>
        </div>

        <Textarea
          id="theme-input"
          value={theme}
          onChange={(e) => {
            if (e.target.value.length <= MAX_CHARS) {
              setTheme(e.target.value)
            }
          }}
          placeholder="Ex: recuperacao tributaria com Claude Code para escritorios contabeis"
          className="min-h-32 resize-none"
        />
        <div className="flex justify-end">
          <span className="text-xs text-muted-foreground tabular-nums">
            {theme.length}/{MAX_CHARS}
          </span>
        </div>
      </div>

      {/* família visual */}
      <div className="space-y-2">
        <Label>Estilo visual</Label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {TEMPLATES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTemplate(t.value)}
              className={cn(
                'rounded-lg border p-3 text-left transition-colors',
                template === t.value ? 'border-primary bg-accent' : 'border-border bg-card hover:border-primary/50',
              )}
            >
              <span className="block text-sm font-medium">{t.label}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{t.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {ideas.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Sugestoes de tema
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleSuggestIdeas}
              disabled={loadingIdeas}
              className="h-auto px-2 py-1 text-xs text-muted-foreground"
            >
              Gerar outras
            </Button>
          </div>
          <div className="space-y-2">
            {ideas.map((idea, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handlePickIdea(idea)}
                className="group flex w-full items-start gap-3 rounded-lg border border-border bg-card p-3 text-left text-sm transition-colors hover:border-primary hover:bg-accent"
              >
                <span className="flex-1">{idea}</span>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
