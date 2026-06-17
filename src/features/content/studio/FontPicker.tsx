'use client'

/**
 * Seletor de fonte pra elementos de texto: papéis da marca (métricas
 * garantidas) + shortlist curada ★ + busca no catálogo do Google Fonts.
 * Escolher uma família dispara o ensure no servidor (cache MinIO) — preview,
 * export e render usam os mesmos bytes.
 */
import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { searchFonts, ensureFont, type CatalogEntry } from './api/fonts-api'

export type FontChoice =
  | { kind: 'role'; role: 'display' | 'body' | 'mono' | 'accent' }
  | { kind: 'family'; family: string }
  | { kind: 'default' }

const ROLE_OPTIONS: Array<{ role: 'display' | 'body' | 'mono' | 'accent'; label: string }> = [
  { role: 'display', label: 'Títulos (marca)' },
  { role: 'body', label: 'Corpo (marca)' },
  { role: 'mono', label: 'Mono (marca)' },
  { role: 'accent', label: 'Ênfase (marca)' },
]

interface FontPickerProps {
  /** valor atual exibido (família custom ou rótulo do papel). */
  current: string
  onPick: (choice: FontChoice) => Promise<void> | void
  /** modo template: troca os papéis por uma opção "padrão do template". */
  defaultOption?: string
}

export function FontPicker({ current, onPick, defaultOption }: FontPickerProps) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [shortlist, setShortlist] = useState<CatalogEntry[]>([])
  const [results, setResults] = useState<CatalogEntry[]>([])
  const [busy, setBusy] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  // dropdown em position:fixed (ancorado no botão) — escapa do overflow do
  // aside do inspetor, que clipava o popover absoluto
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)

  function toggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, right: Math.max(8, window.innerWidth - r.right) })
    }
    setOpen((o) => !o)
  }

  useEffect(() => {
    if (!open) return
    searchFonts().then((r) => setShortlist(r.shortlist)).catch(() => setShortlist([]))
  }, [open])

  useEffect(() => {
    if (!open || !q.trim()) {
      setResults([])
      return
    }
    const t = setTimeout(() => searchFonts(q).then((r) => setResults(r.results)).catch(() => setResults([])), 300)
    return () => clearTimeout(t)
  }, [q, open])

  async function pickRole(role: (typeof ROLE_OPTIONS)[number]['role']) {
    await onPick({ kind: 'role', role })
    setOpen(false)
    setQ('')
  }

  async function pickFamily(family: string) {
    setBusy(true)
    try {
      await ensureFont(family) // cacheia no servidor (browser baixa em seguida)
      await onPick({ kind: 'family', family })
      setOpen(false)
      setQ('')
    } finally {
      setBusy(false)
    }
  }

  const list = q.trim() ? results : shortlist

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        className="flex w-full items-center justify-between rounded-md border border-input bg-background px-2 py-1 text-sm"
      >
        <span className="truncate">{current}</span>
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <span className="text-muted-foreground">⌄</span>}
      </button>

      {open && pos && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="fixed z-50 w-64 rounded-lg border border-border bg-popover p-2 shadow-lg" style={{ top: pos.top, right: pos.right }}>
            <input
              autoFocus
              placeholder="Buscar no Google Fonts…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="mb-2 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none"
            />
            <div className="max-h-60 overflow-y-auto">
              {!q.trim() && (
                <>
                  {defaultOption ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={async () => {
                        await onPick({ kind: 'default' })
                        setOpen(false)
                        setQ('')
                      }}
                      className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted disabled:opacity-50"
                    >
                      {defaultOption}
                    </button>
                  ) : (
                    <>
                      <span className="block px-2 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Papéis da marca</span>
                      {ROLE_OPTIONS.map((r) => (
                        <button key={r.role} type="button" disabled={busy} onClick={() => pickRole(r.role)} className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted disabled:opacity-50">
                          {r.label}
                        </button>
                      ))}
                    </>
                  )}
                  <span className="mt-1 block border-t border-border px-2 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Catálogo</span>
                </>
              )}
              {list.length === 0 && q.trim() && <p className="px-2 py-2 text-[11px] text-muted-foreground">Nada encontrado.</p>}
              {list.map((f) => (
                <button
                  key={f.family}
                  type="button"
                  disabled={busy}
                  onClick={() => pickFamily(f.family)}
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
