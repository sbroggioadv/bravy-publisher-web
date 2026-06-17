'use client'

/**
 * Editor de texto IN-PLACE (RFC §5.3): contentEditable posicionado exatamente
 * sobre a caixa de transformação, com a MESMA tipografia do canvas — o texto
 * pintado fica oculto enquanto edita. Nada de tags na tela: formatação vem da
 * toolbar flutuante (itálico/negrito/sublinhado, alinhamento, cor do texto e
 * destaque) e vira spans estilizados; a serialização de volta pro markup
 * acontece fora daqui (runs ↔ markup).
 * Enter quebra linha (multiline) ou conclui; Esc/clique fora conclui.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AlignCenter, AlignLeft, AlignRight, Bold, Highlighter, Italic, Underline, X } from 'lucide-react'
import type { ResolvedTextStyle, StyleKey, StyledRun } from '@publisher/scene-engine'
import type { SelectBox } from './lib/selectable'
import type { KeyStyles } from './lib/editor-style'
import {
  clearKey,
  domToRuns,
  rangeFlag,
  rangeKey,
  rangeValue,
  runsToHtml,
  selectionOffsets,
  setSelectionAt,
  setValue,
  toggleFlag,
  toggleKey,
  type ValueDeco,
} from './lib/rich-text'

export type TextAlign = 'left' | 'center' | 'right'

interface CanvasTextEditorProps {
  box: SelectBox
  scale: number
  initial: StyledRun[]
  styles: KeyStyles
  align: TextAlign
  multiline: boolean
  /** chaves de formatação disponíveis na toolbar. */
  formatKeys: StyleKey[]
  /** habilita sublinhado + cor do texto + destaque (campos com markup). */
  decorations?: boolean
  /** paleta da marca pros seletores de cor. */
  palette?: Array<{ hex: string; label: string }>
  /** presente = alinhamento editável (texto livre); muda o nó na hora. */
  onAlign?: (align: TextAlign) => void
  /** headline: ênfase é estrutural — só pode existir UM trecho em por vez. */
  singleEm?: boolean
  onChange: (runs: StyledRun[]) => void
  onClose: () => void
}

const KEY_LABELS: Partial<Record<StyleKey, { icon: typeof Italic; title: string }>> = {
  em: { icon: Italic, title: 'Itálico / ênfase (⌘I)' },
  strong: { icon: Bold, title: 'Negrito (⌘B)' },
}

const ALIGNS: Array<{ value: TextAlign; icon: typeof AlignLeft; title: string }> = [
  { value: 'left', icon: AlignLeft, title: 'Alinhar à esquerda' },
  { value: 'center', icon: AlignCenter, title: 'Centralizar' },
  { value: 'right', icon: AlignRight, title: 'Alinhar à direita' },
]

function applyStyle(el: HTMLElement, s: ResolvedTextStyle, scale: number) {
  el.style.fontFamily = s.family
  el.style.fontWeight = String(s.weight)
  el.style.fontStyle = s.italic ? 'italic' : 'normal'
  el.style.fontSize = `${s.size * scale}px`
  el.style.color = s.fill
  el.style.letterSpacing = `${s.letterSpacingEm}em`
}

export function CanvasTextEditor({
  box,
  scale,
  initial,
  styles,
  align,
  multiline,
  formatKeys,
  decorations,
  palette,
  onAlign,
  singleEm,
  onChange,
  onClose,
}: CanvasTextEditorProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const editRef = useRef<HTMLDivElement>(null)
  const [activeKey, setActiveKey] = useState<StyleKey | null>(null)
  const [activeU, setActiveU] = useState(false)
  const [activeColor, setActiveColor] = useState<string | null>(null)
  const [activeBg, setActiveBg] = useState<string | null>(null)
  const [alignState, setAlignState] = useState<TextAlign>(align)
  // painel de cor aberto + seleção congelada no momento da abertura (o picker
  // nativo rouba o foco; aplicamos sobre o intervalo capturado aqui)
  const [colorPanel, setColorPanel] = useState<{ deco: ValueDeco; start: number; end: number } | null>(null)

  // geometria congelada na abertura (o texto pode refluir enquanto digita)
  const [frame] = useState(() => ({ left: box.x * scale, top: box.y * scale, width: Math.max(40, box.w * scale) }))

  function renderRuns(runs: StyledRun[]) {
    const el = editRef.current
    if (!el) return
    el.innerHTML = runsToHtml(runs)
    el.querySelectorAll<HTMLElement>('[data-key]').forEach((span) => {
      const st = styles[span.dataset.key as StyleKey]
      if (st) applyStyle(span, st, scale)
    })
    // cor decorativa vence o fill da chave (applyStyle sobrescreve color)
    el.querySelectorAll<HTMLElement>('[data-c]').forEach((span) => {
      if (span.dataset.c) span.style.color = span.dataset.c
    })
  }

  // monta: pinta o conteúdo, foca e seleciona tudo
  useLayoutEffect(() => {
    const el = editRef.current
    if (!el) return
    applyStyle(el, styles.ink, scale)
    renderRuns(initial)
    el.focus()
    const sel = window.getSelection()
    if (sel) {
      const r = document.createRange()
      r.selectNodeContents(el)
      sel.removeAllRanges()
      sel.addRange(r)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // estado ativo da toolbar segue a seleção
  useEffect(() => {
    if (!formatKeys.length && !decorations) return
    function onSel() {
      const el = editRef.current
      if (!el) return
      const off = selectionOffsets(el)
      const runs = off ? domToRuns(el) : null
      setActiveKey(off && runs ? rangeKey(runs, off.start, off.end) : null)
      setActiveU(off && runs ? rangeFlag(runs, off.start, off.end, 'underline') : false)
      setActiveColor(off && runs ? rangeValue(runs, off.start, off.end, 'color') : null)
      setActiveBg(off && runs ? rangeValue(runs, off.start, off.end, 'bg') : null)
    }
    document.addEventListener('selectionchange', onSel)
    return () => document.removeEventListener('selectionchange', onSel)
  }, [formatKeys.length, decorations])

  function emit() {
    const el = editRef.current
    if (el) onChange(domToRuns(el))
  }

  function applyFormat(key: StyleKey) {
    const el = editRef.current
    if (!el) return
    const off = selectionOffsets(el)
    if (!off || off.end <= off.start) return
    let runs = domToRuns(el)
    const already = rangeKey(runs, off.start, off.end) === key
    if (singleEm && key === 'em' && !already) runs = clearKey(runs, 'em') // uma ênfase por vez
    runs = toggleKey(runs, off.start, off.end, key)
    renderRuns(runs)
    setSelectionAt(el, off.start, off.end)
    onChange(runs)
  }

  function applyUnderline() {
    const el = editRef.current
    if (!el) return
    const off = selectionOffsets(el)
    if (!off || off.end <= off.start) return
    const runs = toggleFlag(domToRuns(el), off.start, off.end, 'underline')
    renderRuns(runs)
    setSelectionAt(el, off.start, off.end)
    onChange(runs)
  }

  function openColorPanel(deco: ValueDeco) {
    const el = editRef.current
    if (!el) return
    if (colorPanel?.deco === deco) {
      setColorPanel(null)
      return
    }
    const off = selectionOffsets(el)
    if (!off || off.end <= off.start) return
    setColorPanel({ deco, start: off.start, end: off.end })
  }

  function applyColor(value: string | undefined) {
    const el = editRef.current
    if (!el || !colorPanel) return
    const runs = setValue(domToRuns(el), colorPanel.start, colorPanel.end, colorPanel.deco, value)
    renderRuns(runs)
    setSelectionAt(el, colorPanel.start, colorPanel.end)
    onChange(runs)
  }

  function applyAlign(a: TextAlign) {
    setAlignState(a)
    onAlign?.(a)
    editRef.current?.focus()
  }

  function insertLineBreak() {
    const sel = window.getSelection()
    if (!sel?.rangeCount) return
    const range = sel.getRangeAt(0)
    range.deleteContents()
    const br = document.createElement('br')
    range.insertNode(br)
    range.setStartAfter(br)
    range.collapse(true)
    sel.removeAllRanges()
    sel.addRange(range)
    emit()
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const mod = e.metaKey || e.ctrlKey
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (multiline) insertLineBreak()
      else onClose()
      return
    }
    if (mod && e.key.toLowerCase() === 'i' && formatKeys.includes('em')) {
      e.preventDefault()
      applyFormat('em')
      return
    }
    if (mod && e.key.toLowerCase() === 'b' && formatKeys.includes('strong')) {
      e.preventDefault()
      applyFormat('strong')
      return
    }
    if (mod && e.key.toLowerCase() === 'u' && decorations) {
      e.preventDefault()
      applyUnderline()
      return
    }
    // undo/redo nativos do contentEditable (onInput re-sincroniza o draft);
    // segura a propagação pro undo global do estúdio não disparar junto
    if (mod && (e.key.toLowerCase() === 'z' || e.key.toLowerCase() === 'y')) e.stopPropagation()
  }

  function onPaste(e: React.ClipboardEvent) {
    e.preventDefault() // só texto puro — sem HTML alheio dentro do editor
    const text = e.clipboardData.getData('text/plain')
    const sel = window.getSelection()
    if (!sel?.rangeCount || !text) return
    const range = sel.getRangeAt(0)
    range.deleteContents()
    const lines = (multiline ? text : text.replace(/\n+/g, ' ')).split('\n')
    const frag = document.createDocumentFragment()
    lines.forEach((line, i) => {
      if (i > 0) frag.appendChild(document.createElement('br'))
      if (line) frag.appendChild(document.createTextNode(line))
    })
    const last = frag.lastChild
    range.insertNode(frag)
    if (last) {
      range.setStartAfter(last)
      range.collapse(true)
      sel.removeAllRanges()
      sel.addRange(range)
    }
    emit()
  }

  function onBlur(e: React.FocusEvent) {
    // clique na toolbar mantém a edição; qualquer outro destino conclui
    if (wrapRef.current?.contains(e.relatedTarget as Node | null)) return
    onClose()
  }

  const btnCls = (active: boolean) =>
    `flex size-7 items-center justify-center rounded ${active ? 'bg-[#C7634F] text-white' : 'text-foreground hover:bg-muted'}`
  const divider = <span className="mx-0.5 h-4 w-px bg-border" />
  const hasToolbar = formatKeys.length > 0 || decorations || onAlign

  return (
    <div ref={wrapRef} className="absolute inset-0 z-20" style={{ pointerEvents: 'none' }}>
      {hasToolbar && (
        <div
          className="absolute"
          style={{ left: frame.left, top: frame.top - 38, pointerEvents: 'auto' }}
          // não rouba foco/seleção do editor (exceto inputs, que precisam dele)
          onMouseDown={(e) => {
            if (!(e.target instanceof HTMLInputElement)) e.preventDefault()
          }}
        >
          <div className="flex items-center gap-0.5 rounded-md border border-border bg-popover p-0.5 shadow-md">
            {formatKeys.map((key) => {
              const meta = KEY_LABELS[key]
              if (!meta) return null
              const Icon = meta.icon
              return (
                <button key={key} type="button" title={meta.title} onClick={() => applyFormat(key)} className={btnCls(activeKey === key)}>
                  <Icon className="size-3.5" />
                </button>
              )
            })}
            {decorations && (
              <button type="button" title="Sublinhado (⌘U)" onClick={applyUnderline} className={btnCls(activeU)}>
                <Underline className="size-3.5" />
              </button>
            )}

            {onAlign && (
              <>
                {divider}
                {ALIGNS.map(({ value, icon: Icon, title }) => (
                  <button key={value} type="button" title={title} onClick={() => applyAlign(value)} className={btnCls(alignState === value)}>
                    <Icon className="size-3.5" />
                  </button>
                ))}
              </>
            )}

            {decorations && (
              <>
                {divider}
                <button
                  type="button"
                  title="Cor do texto"
                  onClick={() => openColorPanel('color')}
                  className={btnCls(colorPanel?.deco === 'color')}
                >
                  <span className="flex flex-col items-center leading-none">
                    <span className="text-[11px] font-semibold">A</span>
                    <span className="mt-px h-0.75 w-3.5 rounded-sm" style={{ backgroundColor: activeColor ?? styles.ink.fill }} />
                  </span>
                </button>
                <button
                  type="button"
                  title="Cor de destaque"
                  onClick={() => openColorPanel('bg')}
                  className={btnCls(colorPanel?.deco === 'bg')}
                  style={activeBg ? { backgroundColor: activeBg } : undefined}
                >
                  <Highlighter className="size-3.5" />
                </button>
              </>
            )}
          </div>

          {colorPanel && (
            <div className="mt-1 flex items-center gap-1 rounded-md border border-border bg-popover p-1.5 shadow-md">
              {(palette ?? []).map(({ hex, label }) => (
                <button
                  key={hex}
                  type="button"
                  title={label}
                  onClick={() => applyColor(hex)}
                  className={`h-6 w-6 rounded border ${
                    (colorPanel.deco === 'color' ? activeColor : activeBg) === hex ? 'ring-2 ring-[#C7634F] ring-offset-1' : 'border-border'
                  }`}
                  style={{ backgroundColor: hex }}
                />
              ))}
              <input
                type="color"
                title="Cor personalizada"
                onChange={(e) => applyColor(e.target.value)}
                className="h-6 w-7 cursor-pointer rounded border-0 bg-transparent p-0"
              />
              <button
                type="button"
                title="Remover"
                onClick={() => applyColor(undefined)}
                className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted"
              >
                <X className="size-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      <div
        ref={editRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline={multiline}
        spellCheck={false}
        className="absolute outline-none"
        style={{
          left: frame.left,
          top: frame.top,
          width: frame.width,
          minHeight: box.h * scale,
          lineHeight: styles.ink.lineHeight,
          textAlign: alignState,
          whiteSpace: multiline ? 'pre-wrap' : 'pre',
          overflowWrap: 'break-word',
          caretColor: '#C7634F',
          pointerEvents: 'auto',
          background: 'transparent',
        }}
        onInput={emit}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onBlur={onBlur}
        onMouseDown={(e) => e.stopPropagation()}
      />
    </div>
  )
}
