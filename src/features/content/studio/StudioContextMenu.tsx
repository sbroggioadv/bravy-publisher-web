'use client'

/**
 * Menu de contexto (botão direito num elemento): agrupar/desagrupar, alinhar,
 * distribuir, frente/trás (elemento livre) e deletar — as mesmas ações da
 * toolbar, ancoradas no ponto do clique.
 */
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalSpaceAround,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalSpaceAround,
  ArrowDown,
  ArrowUp,
  Group,
  Trash2,
  Ungroup,
} from 'lucide-react'
import type { SelectBox } from './lib/selectable'
import { useStudioActions } from './hooks/use-studio-actions'
import type { AlignMode } from './lib/align'

interface StudioContextMenuProps {
  x: number
  y: number
  boxes: SelectBox[]
  onClose: () => void
}

const ALIGN_ICONS: Array<{ mode: AlignMode; icon: typeof AlignStartVertical; label: string }> = [
  { mode: 'left', icon: AlignStartVertical, label: 'Esquerda' },
  { mode: 'centerH', icon: AlignCenterVertical, label: 'Centro H' },
  { mode: 'right', icon: AlignEndVertical, label: 'Direita' },
  { mode: 'top', icon: AlignStartHorizontal, label: 'Topo' },
  { mode: 'middleV', icon: AlignCenterHorizontal, label: 'Centro V' },
  { mode: 'bottom', icon: AlignEndHorizontal, label: 'Base' },
]

export function StudioContextMenu({ x, y, boxes, onClose }: StudioContextMenuProps) {
  const a = useStudioActions(boxes)
  const run = (fn: () => void) => () => {
    fn()
    onClose()
  }

  const Item = ({ icon: Icon, label, onClick, danger }: { icon: typeof Group; label: string; onClick: () => void; danger?: boolean }) => (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted ${danger ? 'text-destructive' : ''}`}
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  )

  return (
    <>
      {/* overlay pra fechar com clique fora (contextmenu só previne o menu nativo —
          fechar aqui mataria o menu no mesmo evento que o abriu) */}
      <div className="fixed inset-0 z-40" onClick={onClose} onContextMenu={(e) => e.preventDefault()} />
      <div className="absolute z-50 w-52 rounded-lg border border-border bg-popover p-1.5 shadow-lg" style={{ left: x, top: y }}>
        {a.selectedIds.length >= 2 && <Item icon={Group} label="Agrupar (⌘G)" onClick={run(a.group)} />}
        {a.inGroup && <Item icon={Ungroup} label="Desagrupar (⌘⇧G)" onClick={run(a.ungroup)} />}

        <div className="my-1 border-t border-border" />
        <span className="block px-2 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Alinhar</span>
        <div className="grid grid-cols-6 gap-0.5 px-1 pb-1">
          {ALIGN_ICONS.map(({ mode, icon: Icon, label }) => (
            <button key={mode} type="button" title={label} onClick={run(() => a.align(mode))} className="flex items-center justify-center rounded p-1.5 hover:bg-muted">
              <Icon className="size-3.5" />
            </button>
          ))}
        </div>
        {a.selectedIds.length >= 3 && (
          <div className="grid grid-cols-2 gap-0.5 px-1 pb-1">
            <button type="button" onClick={run(() => a.distribute('h'))} className="flex items-center justify-center gap-1 rounded p-1.5 text-[11px] hover:bg-muted">
              <AlignHorizontalSpaceAround className="size-3.5" /> Distribuir H
            </button>
            <button type="button" onClick={run(() => a.distribute('v'))} className="flex items-center justify-center gap-1 rounded p-1.5 text-[11px] hover:bg-muted">
              <AlignVerticalSpaceAround className="size-3.5" /> Distribuir V
            </button>
          </div>
        )}

        {a.singleUser && (
          <>
            <div className="my-1 border-t border-border" />
            <Item icon={ArrowUp} label="Trazer para frente" onClick={run(a.bringFront)} />
            <Item icon={ArrowDown} label="Enviar para trás" onClick={run(a.sendBack)} />
          </>
        )}

        <div className="my-1 border-t border-border" />
        <Item icon={Trash2} label="Deletar (⌫)" onClick={run(a.deleteSelection)} danger />
      </div>
    </>
  )
}
