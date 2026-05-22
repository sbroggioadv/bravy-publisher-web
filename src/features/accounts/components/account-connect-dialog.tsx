'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import type { Platform } from '@/types/social-account'
import { cn } from '@/lib/utils'
import { Plus, Camera, Briefcase, Music, AtSign, ExternalLink, Loader2, type LucideIcon } from 'lucide-react'
import { startOAuth } from '../api/accounts-api'

const PLATFORMS: {
  value: Platform
  label: string
  icon: LucideIcon
  bgColor: string
  textColor: string
  enabled: boolean
}[] = [
  {
    value: 'INSTAGRAM',
    label: 'Instagram',
    icon: Camera,
    bgColor: 'bg-pink-100 dark:bg-pink-950',
    textColor: 'text-pink-500',
    enabled: true,
  },
  {
    value: 'LINKEDIN',
    label: 'LinkedIn',
    icon: Briefcase,
    bgColor: 'bg-blue-100 dark:bg-blue-950',
    textColor: 'text-blue-600',
    enabled: false,
  },
  {
    value: 'TIKTOK',
    label: 'TikTok',
    icon: Music,
    bgColor: 'bg-zinc-100 dark:bg-zinc-800',
    textColor: 'text-zinc-900 dark:text-zinc-100',
    enabled: false,
  },
  {
    value: 'TWITTER',
    label: 'Twitter',
    icon: AtSign,
    bgColor: 'bg-sky-100 dark:bg-sky-950',
    textColor: 'text-sky-500',
    enabled: false,
  },
]

export function AccountConnectDialog() {
  const [selected, setSelected] = useState<Platform | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleConnect() {
    if (!selected) return
    const platform = PLATFORMS.find((p) => p.value === selected)
    if (!platform?.enabled) {
      toast.error(`${platform?.label ?? selected} ainda nao disponivel`)
      return
    }
    setLoading(true)
    try {
      const { authUrl } = await startOAuth(selected)
      window.location.href = authUrl
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao iniciar OAuth'
      toast.error(message)
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="mr-1 h-4 w-4" />
        Conectar conta
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Conectar nova conta</DialogTitle>
          <DialogDescription>
            Selecione a plataforma para conectar via OAuth.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 py-2">
          {PLATFORMS.map((platform) => {
            const Icon = platform.icon
            const isSelected = selected === platform.value
            const isDisabled = !platform.enabled

            return (
              <button
                key={platform.value}
                type="button"
                disabled={isDisabled}
                onClick={() => setSelected(platform.value)}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-xl border p-4 transition-all',
                  isDisabled && 'cursor-not-allowed opacity-50',
                  !isDisabled && isSelected
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : !isDisabled && 'border-border hover:bg-muted',
                )}
              >
                <div
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-lg',
                    platform.bgColor,
                  )}
                >
                  <Icon className={cn('h-5 w-5', platform.textColor)} />
                </div>
                <span className="text-sm font-medium">{platform.label}</span>
                {isDisabled && (
                  <span className="text-[10px] text-muted-foreground">em breve</span>
                )}
              </button>
            )
          })}
        </div>

        {selected && (
          <div className="rounded-lg border border-dashed bg-muted/50 p-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ExternalLink className="h-4 w-4 shrink-0" />
              <span>
                Voce sera redirecionado para autorizar o acesso via OAuth.
              </span>
            </div>
          </div>
        )}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancelar
          </DialogClose>
          <Button
            disabled={!selected || loading || !PLATFORMS.find((p) => p.value === selected)?.enabled}
            onClick={handleConnect}
          >
            {loading && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            Conectar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
