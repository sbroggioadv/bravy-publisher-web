'use client'

/**
 * Inspetor do bloco selecionado (RFC §5/§13.4): recolorir com swatches da
 * PALETA do Brand Kit (validação no engine garante só cores da marca),
 * escala tipográfica (corner-resize numérico), esconder/mostrar e resetar.
 * Tudo vira NodeOverride — persiste e re-deriva a cena na hora.
 */
import type { BrandKit, NodeOverride, UserNode } from '@publisher/scene-engine'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ArrowDown, ArrowUp, Eye, EyeOff, RotateCcw, Trash2 } from 'lucide-react'
import { useStudioStore } from './studio-store'
import type { SelectBox } from './lib/selectable'
import { FontPicker } from './FontPicker'
import { ensureFamilyLoaded } from './lib/browser-metrics'

/** rótulos humanos pros tokens da paleta (ordem de exibição). */
const COLOR_TOKENS: Array<{ token: keyof BrandKit['palette']; label: string }> = [
  { token: 'ink', label: 'Tinta' },
  { token: 'inkSoft', label: 'Tinta suave' },
  { token: 'muted', label: 'Apagado' },
  { token: 'accent', label: 'Destaque' },
  { token: 'accentSoft', label: 'Destaque suave' },
  { token: 'bg', label: 'Fundo' },
  { token: 'bg2', label: 'Fundo 2' },
  { token: 'bgRose', label: 'Fundo rosé' },
  { token: 'cardBg', label: 'Cartão' },
  { token: 'line', label: 'Linha' },
]

const SCALE_STEPS = [0.75, 0.9, 1, 1.15, 1.35, 1.6]

interface InspectorProps {
  kit: BrandKit
  activeIndex: number
  selectedBox: SelectBox | null
  /** px real do texto selecionado (estilo dominante) — edição em px. */
  textPx?: number
}

export function Inspector({ kit, activeIndex, selectedBox, textPx }: InspectorProps) {
  const overrides = useStudioStore((s) => s.overrides)
  const setOverride = useStudioStore((s) => s.setOverride)

  if (!selectedBox) {
    return (
      <div className="p-4">
        <p className="text-xs text-muted-foreground">
          Selecione um bloco no slide (shift = vários). Arraste pra mover, cantos redimensionam, duplo-clique edita o texto, Delete remove.
        </p>
      </div>
    )
  }

  if (selectedBox.user) {
    return <UserNodeInspector kit={kit} activeIndex={activeIndex} id={selectedBox.id} />
  }

  const id = selectedBox.id
  const current: NodeOverride = overrides[activeIndex]?.[id] ?? {}
  const isText = selectedBox.kind === 'text'
  const hidden = current.hidden === true
  const fontScale = current.fontScale ?? 1

  const patch = (p: NodeOverride | null) => setOverride(activeIndex, id, p)

  // mesmo formato do painel de elemento livre (cor livre + atalhos da marca)
  const colorRow = (label: string, value: string | undefined, onChange: (hex: string) => void) => (
    <label className="flex items-center justify-between gap-2">
      <span className="text-xs">{label}</span>
      <span className="flex items-center gap-1.5">
        <input type="color" value={value ?? '#1A1815'} onChange={(e) => onChange(e.target.value)} className="h-7 w-9 cursor-pointer rounded border-0 bg-transparent p-0" />
        <span className="flex gap-1">
          {(['ink', 'accent', 'bg'] as const).map((t) => (
            <button key={t} type="button" title={t} onClick={() => onChange(kit.palette[t])} className="h-5 w-5 rounded border border-border" style={{ backgroundColor: kit.palette[t] }} />
          ))}
        </span>
      </span>
    </label>
  )

  // px exibido = px real do estilo dominante; editar converte pra fontScale
  const pxValue = textPx ? Math.round(textPx) : undefined
  const setPx = (px: number) => {
    if (!textPx || px <= 0) return
    const next = Math.max(0.25, Math.min(4, fontScale * (px / textPx)))
    patch({ fontScale: next })
  }

  return (
    <div className="space-y-4 p-4">
      <div>
        <h3 className="text-sm font-semibold">{isText ? 'Texto do template' : 'Bloco do template'}</h3>
        <p className="mt-1 break-all text-[11px] text-muted-foreground">{id}</p>
      </div>

      {colorRow('Cor', current.fill, (hex) => patch({ fill: hex }))}
      {current.fill && (
        <button type="button" className="-mt-2 text-[11px] text-muted-foreground underline" onClick={() => patch({ fill: undefined } as NodeOverride)}>
          cor original
        </button>
      )}

      {isText && (
        <>
          <label className="flex items-center justify-between gap-2">
            <span className="text-xs">Tamanho (px)</span>
            <input
              type="number"
              min={8}
              max={400}
              value={pxValue ?? ''}
              onChange={(e) => setPx(Number(e.target.value) || 0)}
              className="w-20 rounded-md border border-input bg-background px-2 py-1 text-right text-sm"
            />
          </label>
          <label className="flex items-center justify-between gap-2">
            <span className="text-xs">Peso</span>
            <select
              value={current.weight ?? ''}
              onChange={(e) => patch({ weight: e.target.value ? Number(e.target.value) : undefined } as NodeOverride)}
              className="rounded-md border border-input bg-background px-2 py-1 text-sm"
            >
              <option value="">Padrão</option>
              {[400, 500, 600, 700, 800].map((w) => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </label>
          <div className="flex items-center justify-between gap-2">
            <span className="shrink-0 text-xs">Fonte</span>
            <div className="w-40">
              <FontPicker
                current={current.family ?? 'Padrão do template'}
                defaultOption="Padrão do template"
                onPick={async (choice) => {
                  if (choice.kind === 'family') {
                    await ensureFamilyLoaded(choice.family)
                    patch({ family: choice.family } as NodeOverride)
                  } else {
                    patch({ family: undefined, weight: undefined } as NodeOverride)
                  }
                }}
              />
            </div>
          </div>
        </>
      )}

      {/* Opacidade */}
      <label className="block">
        <span className="mb-1 flex justify-between text-xs">
          <span>Opacidade</span>
          <span className="text-muted-foreground">{Math.round((current.opacity ?? 1) * 100)}%</span>
        </span>
        <input type="range" min={5} max={100} value={Math.round((current.opacity ?? 1) * 100)} onChange={(e) => patch({ opacity: Number(e.target.value) / 100 })} className="w-full" />
      </label>

      {/* Rotação */}
      <label className="flex items-center justify-between gap-2">
        <span className="text-xs">Rotação (°)</span>
        <input
          type="number"
          min={-180}
          max={180}
          step={1}
          value={Math.round(current.rotation ?? 0)}
          onChange={(e) => patch({ rotation: Number(e.target.value) || 0 })}
          className="w-20 rounded-md border border-input bg-background px-2 py-1 text-right text-sm"
        />
      </label>

      {/* Visibilidade + reset */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={() => patch({ hidden: !hidden })}>
          {hidden ? <Eye className="size-3.5" data-icon="inline-start" /> : <EyeOff className="size-3.5" data-icon="inline-start" />}
          {hidden ? 'Mostrar' : 'Esconder'}
        </Button>
        <Button variant="outline" size="sm" className="flex-1" onClick={() => patch(null)}>
          <RotateCcw className="size-3.5" data-icon="inline-start" />
          Resetar
        </Button>
      </div>
    </div>
  )
}

/** Inspetor de elemento LIVRE — edita o próprio nó (cor livre, px, ordem, deletar). */
function UserNodeInspector({ kit, activeIndex, id }: { kit: BrandKit; activeIndex: number; id: string }) {
  const added = useStudioStore((s) => s.added)
  const updateNode = useStudioStore((s) => s.updateNode)
  const removeNode = useStudioStore((s) => s.removeNode)
  const reorderNode = useStudioStore((s) => s.reorderNode)

  const node = (added[activeIndex] ?? []).find((n) => n.id === id)
  if (!node) return null

  const patch = (p: Partial<UserNode>) => updateNode(activeIndex, id, p)
  const KIND_LABEL: Record<UserNode['kind'], string> = { text: 'Texto livre', rect: 'Retângulo', ellipse: 'Elipse', line: 'Linha', image: 'Imagem' }

  const colorRow = (label: string, value: string | undefined, onChange: (hex: string) => void) => (
    <label className="flex items-center justify-between gap-2">
      <span className="text-xs">{label}</span>
      <span className="flex items-center gap-1.5">
        <input type="color" value={value ?? '#000000'} onChange={(e) => onChange(e.target.value)} className="h-7 w-9 cursor-pointer rounded border-0 bg-transparent p-0" />
        <span className="flex gap-1">
          {(['ink', 'accent', 'bg'] as const).map((t) => (
            <button key={t} type="button" title={t} onClick={() => onChange(kit.palette[t])} className="h-5 w-5 rounded border border-border" style={{ backgroundColor: kit.palette[t] }} />
          ))}
        </span>
      </span>
    </label>
  )

  return (
    <div className="space-y-4 p-4">
      <div>
        <h3 className="text-sm font-semibold">{KIND_LABEL[node.kind]}</h3>
        <p className="mt-1 break-all text-[11px] text-muted-foreground">{id}</p>
      </div>

      {node.kind === 'text' && (
        <>
          {colorRow('Cor', node.fill, (hex) => patch({ fill: hex }))}
          <label className="flex items-center justify-between gap-2">
            <span className="text-xs">Tamanho (px)</span>
            <input
              type="number"
              min={8}
              max={400}
              value={node.size}
              onChange={(e) => patch({ size: Math.max(8, Number(e.target.value) || 8) })}
              className="w-20 rounded-md border border-input bg-background px-2 py-1 text-right text-sm"
            />
          </label>
          <label className="flex items-center justify-between gap-2">
            <span className="text-xs">Peso</span>
            <select value={node.weight ?? 400} onChange={(e) => patch({ weight: Number(e.target.value) })} className="rounded-md border border-input bg-background px-2 py-1 text-sm">
              {[400, 500, 600, 700, 800].map((w) => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </label>
          <div className="flex items-center justify-between gap-2">
            <span className="shrink-0 text-xs">Fonte</span>
            <div className="w-40">
              <FontPicker
                current={node.family ?? { display: 'Títulos (marca)', body: 'Corpo (marca)', mono: 'Mono (marca)', accent: 'Ênfase (marca)' }[node.role ?? 'body']}
                onPick={async (choice) => {
                  if (choice.kind === 'role') {
                    patch({ role: choice.role, family: undefined } as Partial<UserNode>)
                  } else if (choice.kind === 'family') {
                    await ensureFamilyLoaded(choice.family) // registra métricas+FontFace
                    patch({ family: choice.family } as Partial<UserNode>)
                  }
                }}
              />
            </div>
          </div>
          <label className="flex items-center justify-between gap-2">
            <span className="text-xs">Alinhamento</span>
            <select value={node.align ?? 'left'} onChange={(e) => patch({ align: e.target.value as typeof node.align })} className="rounded-md border border-input bg-background px-2 py-1 text-sm">
              <option value="left">Esquerda</option>
              <option value="center">Centro</option>
              <option value="right">Direita</option>
            </select>
          </label>
        </>
      )}

      {(node.kind === 'rect' || node.kind === 'ellipse') && (
        <>
          {colorRow('Preenchimento', node.fill, (hex) => patch({ fill: hex }))}
          {colorRow('Borda', node.stroke, (hex) => patch({ stroke: hex, strokeWidth: node.strokeWidth ?? 2 }))}
          <label className="flex items-center justify-between gap-2">
            <span className="text-xs">Espessura da borda</span>
            <input type="number" min={0} max={40} value={node.strokeWidth ?? 0} onChange={(e) => patch({ strokeWidth: Number(e.target.value) || 0 })} className="w-20 rounded-md border border-input bg-background px-2 py-1 text-right text-sm" />
          </label>
          {node.kind === 'rect' && (
            <label className="flex items-center justify-between gap-2">
              <span className="text-xs">Cantos (raio)</span>
              <input type="number" min={0} max={200} value={node.radius ?? 0} onChange={(e) => patch({ radius: Number(e.target.value) || 0 })} className="w-20 rounded-md border border-input bg-background px-2 py-1 text-right text-sm" />
            </label>
          )}
        </>
      )}

      {node.kind === 'line' && (
        <>
          {colorRow('Cor', node.stroke, (hex) => patch({ stroke: hex }))}
          <label className="flex items-center justify-between gap-2">
            <span className="text-xs">Espessura</span>
            <input type="number" min={1} max={40} value={node.strokeWidth} onChange={(e) => patch({ strokeWidth: Math.max(1, Number(e.target.value) || 1) })} className="w-20 rounded-md border border-input bg-background px-2 py-1 text-right text-sm" />
          </label>
        </>
      )}

      {node.kind === 'image' && (
        <>
          <label className="flex items-center justify-between gap-2">
            <span className="text-xs">Encaixe</span>
            <select value={node.fit ?? 'cover'} onChange={(e) => patch({ fit: e.target.value as typeof node.fit })} className="rounded-md border border-input bg-background px-2 py-1 text-sm">
              <option value="cover">Preencher</option>
              <option value="contain">Conter</option>
            </select>
          </label>
          <label className="flex items-center justify-between gap-2">
            <span className="text-xs">Cantos (raio)</span>
            <input type="number" min={0} max={200} value={node.radius ?? 0} onChange={(e) => patch({ radius: Number(e.target.value) || 0 })} className="w-20 rounded-md border border-input bg-background px-2 py-1 text-right text-sm" />
          </label>
        </>
      )}

      {/* Opacidade — todos */}
      <label className="block">
        <span className="mb-1 flex justify-between text-xs">
          <span>Opacidade</span>
          <span className="text-muted-foreground">{Math.round((node.opacity ?? 1) * 100)}%</span>
        </span>
        <input type="range" min={5} max={100} value={Math.round((node.opacity ?? 1) * 100)} onChange={(e) => patch({ opacity: Number(e.target.value) / 100 })} className="w-full" />
      </label>

      {/* Rotação — exceto linha */}
      {node.kind !== 'line' && (
        <label className="flex items-center justify-between gap-2">
          <span className="text-xs">Rotação (°)</span>
          <input
            type="number"
            min={-180}
            max={180}
            step={1}
            value={Math.round(node.rotation ?? 0)}
            onChange={(e) => patch({ rotation: Number(e.target.value) || 0 })}
            className="w-20 rounded-md border border-input bg-background px-2 py-1 text-right text-sm"
          />
        </label>
      )}

      {/* Ordem + deletar */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={() => reorderNode(activeIndex, id, 'back')} title="Enviar para trás">
          <ArrowDown className="size-3.5" />
        </Button>
        <Button variant="outline" size="sm" className="flex-1" onClick={() => reorderNode(activeIndex, id, 'front')} title="Trazer para frente">
          <ArrowUp className="size-3.5" />
        </Button>
        <Button variant="outline" size="sm" className="flex-1 text-destructive" onClick={() => removeNode(activeIndex, id)} title="Deletar">
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}
