'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

/**
 * Drop this on the page that hosts the accounts list. Reads `?status=success`
 * or `?status=error&reason=...` set by the OAuth callback redirect, shows the
 * appropriate toast, invalidates the accounts query so the new card appears,
 * then strips the query params from the URL.
 */
export function OAuthCallbackToast() {
  const params = useSearchParams()
  const router = useRouter()
  const queryClient = useQueryClient()

  useEffect(() => {
    const status = params.get('status')
    if (!status) return

    if (status === 'success') {
      const accountName = params.get('accountName')
      toast.success(
        accountName ? `Conta @${accountName} conectada` : 'Conta conectada',
      )
      queryClient.invalidateQueries({ queryKey: ['social-accounts'] })
    } else if (status === 'error') {
      const reason = params.get('reason') ?? 'Falha desconhecida'
      toast.error(`Erro ao conectar: ${reason}`)
    }

    // strip the query without reloading
    router.replace(window.location.pathname)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  return null
}
