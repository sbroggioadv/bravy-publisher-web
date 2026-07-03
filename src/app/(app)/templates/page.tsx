'use client'

import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/page-header'
import { TemplatesGallery } from '@/features/templates/components/templates-gallery'

export default function TemplatesPage() {
  return (
    <div>
      <PageHeader
        title="Templates"
        description="Galeria de templates visuais para carrosséis e posts."
        action={
          <Button nativeButton={false} render={<Link href="/templates/new" />}>
            <Plus data-icon="inline-start" />
            Criar template
          </Button>
        }
      />
      <TemplatesGallery />
    </div>
  )
}
