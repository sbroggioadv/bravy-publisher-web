import { Suspense } from 'react'
import { AccountConnectDialog } from '@/features/accounts/components/account-connect-dialog'
import { AccountsList } from '@/features/accounts/components/accounts-list'
import { OAuthCallbackToast } from '@/features/accounts/components/oauth-callback-toast'

export default function CanaisSettingsPage() {
  return (
    <div className="space-y-4">
      <Suspense fallback={null}>
        <OAuthCallbackToast />
      </Suspense>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Conecte as redes sociais que serão usadas para publicar conteúdos.
        </p>
        <AccountConnectDialog />
      </div>
      <AccountsList />
    </div>
  )
}
