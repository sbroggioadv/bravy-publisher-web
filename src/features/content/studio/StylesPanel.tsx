'use client'

/**
 * Galeria de ESTILOS do post: 5 presets default + estilos do usuário (kits
 * nomeados do tenant). Cada card é a capa real renderizada pelo engine com o
 * kit do estilo. Aplicar troca tipografia/paleta/família do POST inteiro
 * (persistido em styleData; texto e ajustes são preservados). "Criar estilo"
 * monta um do zero (nome, família, papéis com Google Fonts, paleta).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Check, Loader2, Plus, Trash2, X } from 'lucide-react'
import { resolveScene, type BrandKit, type MetricsProvider, type TemplateFamily } from '@publisher/scene-engine'
import { api } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { DEFAULT_PRESETS, presetToKit, presetToStyleData, type StyleData, type StylePreset } from './lib/style-presets'
import { ensureStudioFonts, sanitizeKit } from './lib/browser-metrics'
import { paintToCanvas } from './lib/paint-canvas'
import { contentToDoc } from './lib/content-to-doc'
import { DEMO_CONTENT } from './demo-content'
import { FontPicker } from './FontPicker'
import { ensureFamilyLoaded } from './lib/browser-metrics'
import { useStudioStore } from './studio-store'

const CARD = 168

interface ApiKit {
  id: string
  name?: string | null
  template?: string | null
  isDefault: boolean
  typography: BrandKit['typography']
  palette: BrandKit['palette']
  brand: BrandKit['brand']
}

function kitToPreset(k: ApiKit): StylePreset {
  return {
    id: k.id,
    name: k.name ?? 'Estilo',
    template: (k.template as TemplateFamily) ?? 'step',
    typography: k.typography,
    palette: k.palette,
    brand: k.brand,
    custom: true,
  }
}

function PresetCard({ preset, kit, metrics, active, onApply, onDelete }: { preset: StylePreset; kit: BrandKit; metrics: MetricsProvider | null; active: boolean; onApply: () => void; onDelete?: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!metrics || !ref.current) return
    try {
      const doc = contentToDoc(DEMO_CONTENT)
      doc.content = { ...doc.content, template: preset.template }
      const slide = resolveScene(doc, metrics, sanitizeKit(presetToKit(preset, kit))).slides[0]
      if (slide) paintToCanvas(ref.current, slide, metrics, CARD / 1080)
    } catch {
      /* preview é cosmético */
    }
  }, [metrics, preset, kit])

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onApply}
        className={cn(
          'block overflow-hidden rounded-xl border-2 transition-colors',
          active ? 'border-[#C7634F]' : 'border-border hover:border-[#C7634F]/50',
        )}
        style={{ width: CARD, height: CARD }}
      >
        <canvas ref={ref} width={CARD} height={CARD} style={{ width: CARD, height: CARD, display: 'block' }} />
        {active && (
          <span className="absolute right-1.5 top-1.5 rounded-full bg-[#C7634F] p-1 text-white">
            <Check className="size-3" />
          </span>
        )}
      </button>
      <div className="mt-1 flex items-center justify-between px-0.5">
        <span className="truncate text-xs font-medium">{preset.name}</span>
        {onDelete && (
          <button type="button" onClick={onDelete} title="Excluir estilo" className="text-muted-foreground hover:text-destructive">
            <Trash2 className="size-3" />
          </button>
        )}
      </div>
    </div>
  )
}

interface StylesPanelProps {
  open: boolean
  onClose: () => void
  tenantKit: BrandKit
}

export function StylesPanel({ open, onClose, tenantKit }: StylesPanelProps) {
  const qc = useQueryClient()
  const style = useStudioStore((s) => s.style)
  const setStyle = useStudioStore((s) => s.setStyle)
  const [metrics, setMetrics] = useState<MetricsProvider | null>(null)
  const [view, setView] = useState<'gallery' | 'create'>('gallery')

  // estilos do usuário (kits nomeados, exceto o default do tenant)
  const { data: userKits } = useQuery({
    queryKey: ['brand-kit', 'list'],
    queryFn: async () => (await api.get<ApiKit[]>('/brand-kit/list')).data,
    enabled: open && typeof window !== 'undefined' && !!localStorage.getItem('access_token'),
    staleTime: 30_000,
  })
  const userPresets = useMemo(() => (userKits ?? []).filter((k) => !k.isDefault && k.name).map(kitToPreset), [userKits])
  const presets = useMemo(() => [...DEFAULT_PRESETS, ...userPresets], [userPresets])

  // carrega as fontes de TODOS os presets (preview fiel quando chegarem)
  useEffect(() => {
    if (!open) return
    let alive = true
    ;(async () => {
      const m0 = await ensureStudioFonts()
      if (alive) setMetrics(m0)
      for (const p of presets) {
        await ensureStudioFonts(presetToKit(p, tenantKit)).catch(() => null)
      }
      const m1 = await ensureStudioFonts()
      if (alive) setMetrics(m1)
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, presets.length])

  const removeStyle = useMutation({
    mutationFn: async (id: string) => api.delete(`/brand-kit/styles/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['brand-kit', 'list'] }),
  })

  if (!open) return null

  function apply(preset: StylePreset) {
    setStyle(presetToStyleData(preset))
    toast.success(`Estilo "${preset.name}" aplicado`)
    onClose()
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[680px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-background p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">{view === 'gallery' ? 'Estilos' : 'Criar estilo'}</h2>
          <div className="flex items-center gap-2">
            {view === 'gallery' ? (
              <Button size="sm" variant="outline" onClick={() => setView('create')}>
                <Plus className="size-3.5" data-icon="inline-start" />
                Criar estilo
              </Button>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setView('gallery')}>
                Voltar
              </Button>
            )}
            <Button size="icon" variant="ghost" onClick={onClose} aria-label="Fechar">
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {view === 'gallery' ? (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {presets.map((p) => (
                <PresetCard
                  key={p.id}
                  preset={p}
                  kit={tenantKit}
                  metrics={metrics}
                  active={style?.presetId === p.id || (!!p.custom && style?.presetId === p.id)}
                  onApply={() => apply(p)}
                  onDelete={p.custom ? () => removeStyle.mutate(p.id) : undefined}
                />
              ))}
            </div>
            {style && (
              <div className="mt-4 border-t pt-3">
                <Button variant="outline" size="sm" onClick={() => { setStyle(null); onClose() }}>
                  Voltar pro estilo da marca (padrão)
                </Button>
              </div>
            )}
          </>
        ) : (
          <CreateStyleForm
            tenantKit={tenantKit}
            onCreated={(styleData) => {
              qc.invalidateQueries({ queryKey: ['brand-kit', 'list'] })
              setStyle(styleData)
              toast.success(`Estilo "${styleData.name}" criado e aplicado`)
              onClose()
            }}
          />
        )}
      </div>
    </>
  )
}

const PALETTE_FIELDS: Array<{ token: keyof BrandKit['palette']; label: string }> = [
  { token: 'bg', label: 'Fundo' },
  { token: 'cardBg', label: 'Cartão' },
  { token: 'ink', label: 'Tinta' },
  { token: 'inkSoft', label: 'Tinta suave' },
  { token: 'muted', label: 'Apagado' },
  { token: 'accent', label: 'Destaque' },
  { token: 'accentSoft', label: 'Destaque suave' },
  { token: 'line', label: 'Linha' },
  { token: 'bg2', label: 'Fundo 2' },
  { token: 'bgRose', label: 'Fundo rosé' },
]

const ROLES: Array<{ role: keyof BrandKit['typography']; label: string }> = [
  { role: 'display', label: 'Títulos' },
  { role: 'body', label: 'Corpo' },
  { role: 'mono', label: 'Mono' },
  { role: 'accent', label: 'Ênfase' },
]

function CreateStyleForm({ tenantKit, onCreated }: { tenantKit: BrandKit; onCreated: (style: StyleData) => void }) {
  const [name, setName] = useState('Meu estilo')
  const [template, setTemplate] = useState<TemplateFamily>('step')
  const [typography, setTypography] = useState<BrandKit['typography']>(JSON.parse(JSON.stringify(tenantKit.typography)))
  const [palette, setPalette] = useState<BrandKit['palette']>({ ...tenantKit.palette })
  const [metrics, setMetrics] = useState<MetricsProvider | null>(null)
  const previewRef = useRef<HTMLCanvasElement>(null)

  const draftKit: BrandKit = useMemo(
    () => ({ ...tenantKit, typography, palette }),
    [tenantKit, typography, palette],
  )

  // preview ao vivo
  useEffect(() => {
    let alive = true
    ensureStudioFonts(draftKit).then((m) => alive && setMetrics(m)).catch(() => null)
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Object.values(typography).map((r) => r.family).join('|')])

  useEffect(() => {
    if (!metrics || !previewRef.current) return
    try {
      const doc = contentToDoc(DEMO_CONTENT)
      doc.content = { ...doc.content, template }
      const slide = resolveScene(doc, metrics, sanitizeKit(draftKit)).slides[0]
      if (slide) paintToCanvas(previewRef.current, slide, metrics, 280 / 1080)
    } catch {
      /* preview */
    }
  }, [metrics, draftKit, template])

  const save = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/brand-kit/styles', { name, template, typography, palette })
      return data as ApiKit
    },
    onSuccess: (kit) => {
      onCreated({ presetId: kit.id, name, template, typography, palette })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Falha ao salvar estilo'),
  })

  async function setRoleFamily(role: keyof BrandKit['typography'], family: string) {
    await ensureFamilyLoaded(family)
    setTypography((t) => ({ ...t, [role]: { family, weights: [400, 500, 600, 700, 800], style: role === 'accent' ? 'italic' : 'normal', source: 'google' } }))
  }

  return (
    <div className="grid gap-5 sm:grid-cols-[1fr_280px]">
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium">Nome do estilo</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm" />
        </label>

        <div>
          <span className="mb-1 block text-xs font-medium">Família de layout</span>
          <div className="flex gap-2">
            {(['step', 'compendium'] as const).map((t) => (
              <button key={t} type="button" onClick={() => setTemplate(t)} className={cn('rounded-md border px-3 py-1.5 text-sm', template === t ? 'border-[#C7634F] bg-[#C7634F]/10 font-medium' : 'border-border hover:bg-muted')}>
                {t === 'step' ? 'Editorial (passos)' : 'Terminal'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="mb-1 block text-xs font-medium">Tipografia</span>
          <div className="grid grid-cols-2 gap-2">
            {ROLES.map(({ role, label }) => (
              <div key={role}>
                <span className="mb-0.5 block text-[11px] text-muted-foreground">{label}</span>
                <FontPicker current={typography[role].family} onPick={async (c) => { if (c.kind === 'family') await setRoleFamily(role, c.family) }} defaultOption={undefined} />
              </div>
            ))}
          </div>
        </div>

        <div>
          <span className="mb-1 block text-xs font-medium">Paleta</span>
          <div className="grid grid-cols-2 gap-1.5">
            {PALETTE_FIELDS.map(({ token, label }) => (
              <label key={token} className="flex items-center gap-2 rounded-md border border-border p-1.5">
                <input type="color" value={palette[token]} onChange={(e) => setPalette((p) => ({ ...p, [token]: e.target.value }))} className="h-6 w-6 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0" />
                <span className="truncate text-[11px]">{label}</span>
              </label>
            ))}
          </div>
        </div>

        <Button onClick={() => save.mutate()} disabled={save.isPending || !name.trim()}>
          {save.isPending ? <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" /> : <Check className="size-3.5" data-icon="inline-start" />}
          Salvar e aplicar
        </Button>
      </div>

      <div>
        <span className="mb-1 block text-xs font-medium">Preview</span>
        <div className="overflow-hidden rounded-xl border border-border" style={{ width: 280, height: 280 }}>
          <canvas ref={previewRef} width={280} height={280} style={{ width: 280, height: 280, display: 'block' }} />
        </div>
      </div>
    </div>
  )
}
