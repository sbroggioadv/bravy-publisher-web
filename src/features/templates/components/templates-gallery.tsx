'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { Loader2, MoreVertical, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { SYSTEM_TEMPLATES } from '../lib/system-templates'
import { TemplateThumb } from './template-thumb'
import { SystemTemplateActions } from './system-template-actions'
import { LayoutPreview } from './layout-preview'
import { useCustomTemplates, useDeleteTemplate } from '../hooks/use-custom-templates'
import type { CustomTemplate } from '../api/templates-api'

/** grid denso: cards de ~220–300px em qualquer viewport (auto-fill, sem gigantes em ultrawide). */
const GRID = 'grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-x-4 gap-y-6'

export function TemplatesGallery() {
  const { data: customs, isLoading } = useCustomTemplates()
  const del = useDeleteTemplate()
  const [pendingDelete, setPendingDelete] = useState<CustomTemplate | null>(null)

  function confirmDelete() {
    if (!pendingDelete) return
    del.mutate(pendingDelete.id, {
      onSuccess: () => {
        toast.success('Template excluído.')
        setPendingDelete(null)
      },
      onError: () => toast.error('Falha ao excluir.'),
    })
  }

  return (
    <div className="flex flex-col gap-10">
      <GallerySection
        title="Templates do sistema"
        description="Prontos pra usar — duplique um pra customizar do seu jeito."
        count={SYSTEM_TEMPLATES.length}
      >
        {SYSTEM_TEMPLATES.map((t) => (
          <TemplateCard
            key={t.id}
            href="/content/new"
            linkLabel={`Usar template ${t.name}`}
            cta="Usar template"
            title={t.name}
            subtitle={t.description}
            menu={<SystemTemplateActions template={t} />}
            preview={<TemplateThumb template={t} size={512} />}
          />
        ))}
      </GallerySection>

      <GallerySection
        title="Seus templates"
        description="Layouts que você desenhou no designer."
        count={customs?.length}
      >
        <CreateTemplateTile />

        {isLoading
          ? Array.from({ length: 3 }, (_, i) => <TemplateCardSkeleton key={i} />)
          : (customs ?? []).map((t) => (
              <TemplateCard
                key={t.id}
                href={`/templates/${t.id}`}
                linkLabel={`Editar template ${t.name}`}
                cta="Editar template"
                title={t.name}
                subtitle={`Editado em ${new Date(t.updatedAt).toLocaleDateString('pt-BR')}`}
                badge={<Badge variant="outline">{t.kind === 'post' ? 'Post' : 'Carrossel'}</Badge>}
                menu={<CustomTemplateActions template={t} onDelete={() => setPendingDelete(t)} />}
                preview={<LayoutPreview spec={t.layout} styleData={t.styleData ?? null} size={512} />}
              />
            ))}
      </GallerySection>

      <Dialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir template</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir{' '}
              <span className="font-medium text-foreground">“{pendingDelete?.name}”</span>? Essa
              ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
            <Button variant="destructive" onClick={confirmDelete} disabled={del.isPending}>
              {del.isPending ? (
                <Loader2 className="animate-spin" data-icon="inline-start" />
              ) : (
                <Trash2 data-icon="inline-start" />
              )}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function GallerySection({
  title,
  description,
  count,
  children,
}: {
  title: string
  description: string
  count?: number
  children: ReactNode
}) {
  return (
    <section className="space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">{title}</h2>
          {count !== undefined && (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
              {count}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <div className={GRID}>{children}</div>
    </section>
  )
}

/**
 * Card padrão da galeria: preview quadrado clicável (link cobre o card inteiro),
 * CTA que aparece no hover/focus e menu de ações no canto. Meta compacta embaixo.
 */
function TemplateCard({
  preview,
  href,
  linkLabel,
  cta,
  title,
  subtitle,
  badge,
  menu,
}: {
  preview: ReactNode
  href: string
  linkLabel: string
  cta: string
  title: string
  subtitle: string
  badge?: ReactNode
  menu?: ReactNode
}) {
  return (
    <div className="group/card flex flex-col gap-2">
      <div className="relative aspect-square overflow-hidden rounded-xl bg-muted/40 ring-1 ring-foreground/10 transition-all group-hover/card:ring-foreground/25 group-hover/card:shadow-md">
        <div className="size-full transition-transform duration-300 ease-out group-hover/card:scale-[1.02]">
          {preview}
        </div>

        {/* véu + CTA no hover/focus (visual; o clique é do link esticado) */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-end bg-linear-to-t from-black/55 via-black/5 to-transparent p-3 opacity-0 transition-opacity duration-200 group-hover/card:opacity-100 group-focus-within/card:opacity-100"
        >
          <span
            className={cn(
              buttonVariants({ size: 'sm' }),
              'w-full translate-y-1 shadow-md transition-transform duration-200 group-hover/card:translate-y-0 group-focus-within/card:translate-y-0',
            )}
          >
            {cta}
          </span>
        </div>

        <Link href={href} className="absolute inset-0 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <span className="sr-only">{linkLabel}</span>
        </Link>

        {menu}
      </div>

      <div className="flex items-start justify-between gap-2 px-0.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{title}</p>
          <p className="truncate text-xs text-muted-foreground" title={subtitle}>
            {subtitle}
          </p>
        </div>
        {badge && <div className="shrink-0 pt-0.5">{badge}</div>}
      </div>
    </div>
  )
}

function CreateTemplateTile() {
  return (
    <Link
      href="/templates/new"
      className="flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-muted-foreground outline-none transition-colors hover:border-primary/50 hover:bg-muted/40 hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <div className="flex size-9 items-center justify-center rounded-full bg-muted">
        <Plus className="size-4" />
      </div>
      <span className="text-sm font-medium">Criar template</span>
      <span className="px-4 text-center text-xs">Headline, imagem, bullets e CTA onde você quiser</span>
    </Link>
  )
}

function CustomTemplateActions({
  template,
  onDelete,
}: {
  template: CustomTemplate
  onDelete: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="absolute right-2 top-2 z-10 bg-background/80 text-foreground/70 opacity-0 backdrop-blur transition-opacity hover:bg-background hover:text-foreground focus-visible:opacity-100 aria-expanded:opacity-100 group-hover/card:opacity-100"
          />
        }
      >
        <MoreVertical className="size-4" />
        <span className="sr-only">Ações do template {template.name}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem render={<Link href={`/templates/${template.id}`} />}>
          <Pencil className="mr-2 size-4" />
          Editar
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 className="mr-2 size-4" />
          Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function TemplateCardSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="aspect-square w-full rounded-xl" />
      <div className="space-y-1.5 px-0.5">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  )
}
