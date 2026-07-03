'use client'

/**
 * Configurações GLOBAIS do post/carrossel — valem pra todos os slides e
 * persistem em styleData.settings (via setSettings → usePersistText).
 * Primeira opção: contador de páginas dos templates de sistema (1/6, 02/07).
 */
import { Switch } from '@/components/ui/switch'
import { useStudioStore } from './studio-store'

export function PostSettingsPanel() {
  const showCounter = useStudioStore((s) => s.style?.settings?.showCounter !== false)
  const setSettings = useStudioStore((s) => s.setSettings)
  const isCustom = useStudioStore((s) => s.draft?.template === 'custom')

  return (
    <div className="space-y-4 p-4">
      <div>
        <h3 className="text-sm font-semibold">Configurações do post</h3>
        <p className="mt-1 text-xs text-muted-foreground">Aplicadas a todos os slides.</p>
      </div>

      <label className="flex items-center justify-between gap-2">
        <span className="text-xs">Contador de páginas</span>
        <Switch checked={showCounter} onCheckedChange={(v) => setSettings({ showCounter: v })} />
      </label>
      {isCustom && (
        <p className="-mt-2 text-[11px] text-muted-foreground">
          Templates personalizados não têm contador — a opção só afeta os templates de sistema.
        </p>
      )}
    </div>
  )
}
