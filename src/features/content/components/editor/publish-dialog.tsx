'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { getAccounts } from '@/features/accounts/api/accounts-api'
import { publishContent } from '../../api/publishing-api'

interface PublishDialogProps {
  contentId: string
  mode: 'now' | 'schedule'
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PublishDialog({ contentId, mode, open, onOpenChange }: PublishDialogProps) {
  const queryClient = useQueryClient()
  const [accountId, setAccountId] = useState<string>('')
  const [scheduledAt, setScheduledAt] = useState<string>('')

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['social-accounts'],
    queryFn: getAccounts,
    enabled: open,
  })

  useEffect(() => {
    if (!accountId && accounts.length > 0) {
      setAccountId(accounts[0].id)
    }
  }, [accounts, accountId])

  const publishMutation = useMutation({
    mutationFn: () =>
      publishContent(contentId, {
        socialAccountId: accountId,
        scheduledAt: mode === 'schedule' ? new Date(scheduledAt).toISOString() : undefined,
      }),
    onSuccess: () => {
      toast.success(
        mode === 'schedule' ? 'Publicacao agendada' : 'Publicacao enviada para a fila',
      )
      queryClient.invalidateQueries({ queryKey: ['content', contentId] })
      onOpenChange(false)
    },
    onError: (err: Error) => {
      toast.error(`Falha ao publicar: ${err.message}`)
    },
  })

  const disabled =
    !accountId || (mode === 'schedule' && !scheduledAt) || publishMutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === 'schedule' ? 'Agendar publicacao' : 'Publicar agora'}
          </DialogTitle>
          <DialogDescription>
            Selecione a conta de destino{mode === 'schedule' ? ' e quando publicar' : ''}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="account">Conta</Label>
            <Select
              value={accountId}
              onValueChange={(v) => setAccountId(v ?? '')}
              disabled={isLoading}
            >
              <SelectTrigger id="account">
                <SelectValue placeholder={isLoading ? 'Carregando...' : 'Selecione'} />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.accountName}  ({acc.platform})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!isLoading && accounts.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Nenhuma conta conectada. Conecte uma conta em Settings  Contas.
              </p>
            )}
          </div>

          {mode === 'schedule' && (
            <div className="space-y-1.5">
              <Label htmlFor="scheduledAt">Data e hora</Label>
              <Input
                id="scheduledAt"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
          <Button disabled={disabled} onClick={() => publishMutation.mutate()}>
            {publishMutation.isPending
              ? 'Enviando...'
              : mode === 'schedule'
                ? 'Agendar'
                : 'Publicar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
