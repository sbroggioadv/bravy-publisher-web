'use client'

/**
 * Settings → Marca (RFC §13.4): edita o Brand Kit do tenant — paleta, strings
 * e tipografia por papel (famílias bundled; catálogo Google Fonts no próximo
 * incremento). Preview ao vivo: a capa-exemplo re-renderiza pelo MESMO engine
 * a cada mudança. Salvar versiona o kit (posts antigos não refluem).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, RotateCcw, Save } from 'lucide-react'
import { resolveScene, type BrandKit, type MetricsProvider } from '@publisher/scene-engine'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { updateBrandKit, resetBrandKit } from './api/brand-kit-api'
import { searchFonts, ensureFont, type CatalogEntry } from './api/fonts-api'
import { useBrandKit } from './hooks/use-brand-kit'
import { ensureStudioFonts, sanitizeKit } from './lib/browser-metrics'
import { paintToCanvas } from './lib/paint-canvas'
import { contentToDoc } from './lib/content-to-doc'
import { DEMO_CONTENT } from './demo-content'

/** Famílias embarcadas (mesmos bytes no server, sem download). */
const BUNDLED: Array<{ family: string; weights: number[]; style: 'normal' | 'italic' }> = [
  { family: 'Plus Jakarta Sans', weights: [400, 500, 600, 700, 800], style: 'normal' },
  { family: 'JetBrains Mono', weights: [400, 500, 600], style: 'normal' },
  { family: 'DM Serif Display', weights: [400], style: 'italic' },
]

const ROLES: Array<{ role: keyof BrandKit['typography']; label: string; hint: string }> = [
  { role: 'display', label: 'Títulos', hint: 'headlines e títulos grandes' },
  { role: 'body', label: 'Corpo', hint: 'parágrafos e bullets' },
  { role: 'mono', label: 'Mono', hint: 'rótulos, topo e rodapé' },
  { role: 'accent', label: 'Ênfase', hint: 'itálico de destaque' },
]

const PALETTE_FIELDS: Array<{ token: keyof BrandKit['palette']; label: string }> = [
  { token: 'bg', label: 'Fundo' },
  { token: 'bg2', label: 'Fundo 2' },
  { token: 'bgRose', label: 'Fundo rosé' },
  { token: 'cardBg', label: 'Cartão' },
  { token: 'ink', label: 'Tinta' },
  { token: 'inkSoft', label: 'Tinta suave' },
  { token: 'muted', label: 'Apagado' },
  { token: 'accent', label: 'Destaque' },
  { token: 'accentSoft', label: 'Destaque suave' },
  { token: 'line', label: 'Linha' },
]

const BRAND_FIELDS: Array<{ key: keyof BrandKit['brand']; label: string }> = [
  { key: 'handle', label: 'Handle (@)' },
  { key: 'breadcrumb', label: 'Breadcrumb do topo' },
  { key: 'ctaKeyword', label: 'Palavra do CTA' },
  { key: 'logoGlyph', label: 'Glifo da marca' },
]

export function BrandKitEditor() {
  const qc = useQueryClient()
  const { kit: saved, isLoading } = useBrandKit()
  const [draft, setDraft] = useState<BrandKit | null>(null)
  const [metrics, setMetrics] = useState<MetricsProvider | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // inicializa o draft quando o kit chega/atualiza
  useEffect(() => {
    setDraft(JSON.parse(JSON.stringify(saved)))
  }, [saved])

  // carrega seed + famílias Google do draft; re-roda quando as famílias mudam
  const draftFamilies = draft ? Object.values(draft.typography).map((r) => `${r.source}:${r.family}`).join('|') : ''
  useEffect(() => {
    if (!draft) return
    ensureStudioFonts(draft).then(setMetrics).catch(() => setMetrics(null))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftFamilies])

  // preview ao vivo: capa demo com o kit em edição (fonte não carregada degrada pro seed)
  const previewSlide = useMemo(() => {
    if (!metrics || !draft) return null
    try {
      return resolveScene(contentToDoc(DEMO_CONTENT), metrics, sanitizeKit(draft)).slides[0] ?? null
    } catch {
      return null
    }
  }, [metrics, draft])

  useEffect(() => {
    if (canvasRef.current && previewSlide && metrics) paintToCanvas(canvasRef.current, previewSlide, metrics, 840 / 1080)
  }, [previewSlide, metrics])

  const saveMutation = useMutation({
    mutationFn: () => updateBrandKit({ typography: draft!.typography, palette: draft!.palette, brand: draft!.brand }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['brand-kit'] })
      toast.success('Marca salva — novos conteúdos usam o kit atualizado')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Falha ao salvar'),
  })

  const resetMutation = useMutation({
    mutationFn: resetBrandKit,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['brand-kit'] })
      toast.success('Kit restaurado pro padrão editorial')
    },
  })

  if (isLoading || !draft) {
    return <Skeleton className="h-96 w-full rounded-xl" />
  }

  const setPalette = (token: keyof BrandKit['palette'], hex: string) =>
    setDraft({ ...draft, palette: { ...draft.palette, [token]: hex } })
  const setBrand = (key: keyof BrandKit['brand'], value: string) =>
    setDraft({ ...draft, brand: { ...draft.brand, [key]: value } })

  /** escolhe família pra um papel: bundled direto; Google → ensure no servidor. */
  async function setRole(role: keyof BrandKit['typography'], family: string) {
    const bundled = BUNDLED.find((x) => x.family === family)
    if (bundled) {
      setDraft((d) => d && ({
        ...d,
        typography: { ...d.typography, [role]: { family: bundled.family, weights: bundled.weights, style: role === 'accent' ? bundled.style : 'normal', source: 'bundled' } },
      }))
      return
    }
    try {
      const manifest = await ensureFont(family) // baixa/cacheia no MinIO
      const weights = [...new Set(manifest.variants.filter((v) => !v.italic).map((v) => v.weight))].sort((a, b) => a - b)
      const hasItalic = manifest.variants.some((v) => v.italic)
      setDraft((d) => d && ({
        ...d,
        typography: {
          ...d.typography,
          [role]: { family, weights: weights.length ? weights : [400], style: role === 'accent' && hasItalic ? 'italic' : 'normal', source: 'google' },
        },
      }))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `Não consegui carregar "${family}"`)
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_420px]">
      <div className="space-y-8">
        {/* Tipografia */}
        <section>
          <h3 className="mb-3 text-sm font-semibold">Tipografia</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {ROLES.map(({ role, label, hint }) => (
              <FontRolePicker
                key={role}
                label={label}
                hint={hint}
                value={draft.typography[role].family}
                onPick={(family) => setRole(role, family)}
              />
            ))}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Embarcadas + catálogo do Google Fonts (baixadas e cacheadas — mesma renderização no post final).
          </p>
        </section>

        {/* Paleta */}
        <section>
          <h3 className="mb-3 text-sm font-semibold">Paleta</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {PALETTE_FIELDS.map(({ token, label }) => (
              <label key={token} className="flex items-center gap-2 rounded-md border border-border p-2">
                <input
                  type="color"
                  value={draft.palette[token]}
                  onChange={(e) => setPalette(token, e.target.value)}
                  className="h-8 w-8 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
                />
                <span className="min-w-0">
                  <span className="block truncate text-xs font-medium">{label}</span>
                  <span className="block text-[10px] uppercase text-muted-foreground">{draft.palette[token]}</span>
                </span>
              </label>
            ))}
          </div>
        </section>

        {/* Strings da marca */}
        <section>
          <h3 className="mb-3 text-sm font-semibold">Textos da marca</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {BRAND_FIELDS.map(({ key, label }) => (
              <label key={key} className="block">
                <span className="mb-1 block text-xs font-medium">{label}</span>
                <input
                  className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                  value={draft.brand[key] ?? ''}
                  onChange={(e) => setBrand(key, e.target.value)}
                />
              </label>
            ))}
          </div>
        </section>

        <div className="flex gap-2">
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" /> : <Save className="size-3.5" data-icon="inline-start" />}
            Salvar marca
          </Button>
          <Button variant="outline" onClick={() => resetMutation.mutate()} disabled={resetMutation.isPending}>
            <RotateCcw className="size-3.5" data-icon="inline-start" />
            Restaurar padrão
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Salvar cria uma nova versão do kit. Conteúdos já gerados mantêm o visual da versão em que foram criados.
        </p>
      </div>

      {/* Preview ao vivo */}
      <div>
        <h3 className="mb-3 text-sm font-semibold">Preview ao vivo</h3>
        <div className="overflow-hidden rounded-xl border border-border shadow-sm" style={{ width: 420, height: 420 }}>
          {previewSlide ? (
            <canvas ref={canvasRef} style={{ width: 420, height: 420, display: 'block' }} />
          ) : (
            <Skeleton className="h-full w-full" />
          )}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">Renderizado pelo mesmo engine dos posts.</p>
      </div>
    </div>
  )
}

/** seletor de família por papel: shortlist curada + busca no Google Fonts. */
function FontRolePicker({ label, hint, value, onPick }: { label: string; hint: string; value: string; onPick: (family: string) => void }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [shortlist, setShortlist] = useState<CatalogEntry[]>([])
  const [results, setResults] = useState<CatalogEntry[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    searchFonts().then((r) => setShortlist(r.shortlist)).catch(() => setShortlist(BUNDLED.map((b) => ({ family: b.family, category: '', curated: true }))))
  }, [open])

  useEffect(() => {
    if (!open || !q.trim()) {
      setResults([])
      return
    }
    const t = setTimeout(() => {
      searchFonts(q).then((r) => setResults(r.results)).catch(() => setResults([]))
    }, 300)
    return () => clearTimeout(t)
  }, [q, open])

  async function pick(family: string) {
    setBusy(true)
    try {
      await onPick(family)
      setOpen(false)
      setQ('')
    } finally {
      setBusy(false)
    }
  }

  const list = q.trim() ? results : shortlist

  return (
    <div className="relative">
      <span className="mb-1 block text-xs font-medium">{label}</span>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-md border border-input bg-background px-2 py-1.5 text-sm"
      >
        <span className="truncate">{value}</span>
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <span className="text-muted-foreground">⌄</span>}
      </button>
      <span className="mt-0.5 block text-[11px] text-muted-foreground">{hint}</span>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-popover p-2 shadow-lg">
            <input
              autoFocus
              placeholder="Buscar no Google Fonts…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="mb-2 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none"
            />
            <div className="max-h-56 overflow-y-auto">
              {list.length === 0 && <p className="px-2 py-2 text-[11px] text-muted-foreground">{q.trim() ? 'Nada encontrado.' : 'Carregando…'}</p>}
              {list.map((f) => (
                <button
                  key={f.family}
                  type="button"
                  disabled={busy}
                  onClick={() => pick(f.family)}
                  className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-muted disabled:opacity-50"
                >
                  <span className="truncate">{f.family}</span>
                  <span className="ml-2 shrink-0 text-[10px] uppercase text-muted-foreground">{f.curated ? '★' : f.category}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
