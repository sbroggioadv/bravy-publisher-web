'use client'

/**
 * Estado do estúdio. Quatro fontes de mudança, todas no undo unificado
 * (snapshot {overrides, draft, added, groups}, 1 commit por gesto):
 *  - overrides: deltas sobre nós do TEMPLATE
 *  - draft: texto do conteúdo (CarouselInput cru)
 *  - added: elementos LIVRES por slide (ordem = z)
 *  - groups: agrupamentos persistentes (groupId → ids; clicar num membro
 *    seleciona o grupo inteiro; mover/alinhar/deletar operam no conjunto)
 * applyMoves aplica um LOTE de mudanças (drag de grupo, alinhar, distribuir)
 * num único snapshot. Multi-seleção via shift+click.
 */
import { create } from 'zustand'
import type { NodeOverride, OverrideMap, UserNode } from '@publisher/scene-engine'
import { setByPath } from './lib/text-fields'
import { newUserNodeId, type GroupMap } from './lib/scene-payload'
import type { RawCarousel } from './lib/content-to-doc'
import type { StyleData } from './lib/style-presets'

export type OverridesByIndex = Record<number, OverrideMap>
export type AddedByIndex = Record<number, UserNode[]>
export type GroupsByIndex = Record<number, GroupMap>

export type BatchMove =
  | { type: 'user'; id: string; patch: Partial<UserNode> }
  | { type: 'override'; id: string; patch: NodeOverride }

interface Snapshot {
  overrides: OverridesByIndex
  draft: RawCarousel | null
  added: AddedByIndex
  groups: GroupsByIndex
  style: StyleData | null
}

interface StudioState {
  activeIndex: number
  selectedIds: string[]
  overrides: OverridesByIndex
  draft: RawCarousel | null
  added: AddedByIndex
  groups: GroupsByIndex
  past: Snapshot[]
  future: Snapshot[]
  dirty: boolean
  textDirty: boolean
  /** estilo aplicado ao POST (preset/custom); null = kit default do tenant. */
  style: StyleData | null
  styleDirty: boolean

  init: (overrides: OverridesByIndex, draft: RawCarousel, added: AddedByIndex, groups: GroupsByIndex, style?: StyleData | null) => void
  /** aplica um estilo ao post inteiro (tipografia/paleta/template). */
  setStyle: (style: StyleData | null) => void
  markStyleClean: () => void
  setActive: (index: number) => void
  select: (id: string | null, additive?: boolean) => void
  /** seleção em lote (marquee): cada id expande pro grupo a que pertence. */
  selectMany: (ids: string[]) => void
  setOverride: (index: number, id: string, patch: NodeOverride | null, commit?: boolean) => void
  setText: (path: string, value: string, commit?: boolean) => void
  addNode: (index: number, node: UserNode) => void
  updateNode: (index: number, id: string, patch: Partial<UserNode>, commit?: boolean) => void
  removeNode: (index: number, id: string) => void
  reorderNode: (index: number, id: string, dir: 'front' | 'back') => void
  /** move um slide de corpo (índices de cena; capa=0 e CTA=último são fixos). */
  reorderSlides: (from: number, to: number) => void
  /** lote num único snapshot (drag de grupo, alinhar, distribuir). */
  applyMoves: (index: number, moves: BatchMove[]) => void
  groupSelection: (index: number) => void
  ungroupSelection: (index: number) => void
  undo: () => void
  redo: () => void
  markClean: () => void
  markTextClean: () => void
}

const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o))
const snap = (s: Pick<StudioState, 'overrides' | 'draft' | 'added' | 'groups' | 'style'>): Snapshot => ({
  overrides: clone(s.overrides),
  draft: clone(s.draft),
  added: clone(s.added),
  groups: clone(s.groups),
  style: clone(s.style),
})

/** expande um id pro conjunto do grupo a que pertence (se houver). */
export function expandToGroup(id: string, groups: GroupMap | undefined): string[] {
  if (!groups) return [id]
  for (const members of Object.values(groups)) {
    if (members.includes(id)) return members
  }
  return [id]
}

export const useStudioStore = create<StudioState>((set) => ({
  activeIndex: 0,
  selectedIds: [],
  overrides: {},
  draft: null,
  added: {},
  groups: {},
  past: [],
  future: [],
  dirty: false,
  textDirty: false,
  style: null,
  styleDirty: false,

  init: (overrides, draft, added, groups, style = null) =>
    set({
      overrides: clone(overrides),
      draft: clone(draft),
      added: clone(added),
      groups: clone(groups),
      style: clone(style),
      styleDirty: false,
      past: [],
      future: [],
      dirty: false,
      textDirty: false,
      selectedIds: [],
    }),
  setActive: (index) => set({ activeIndex: index, selectedIds: [] }),

  select: (id, additive = false) =>
    set((s) => {
      if (id === null) return { selectedIds: [] }
      const expanded = expandToGroup(id, s.groups[s.activeIndex])
      if (!additive) return { selectedIds: expanded }
      const has = expanded.every((x) => s.selectedIds.includes(x))
      return {
        selectedIds: has
          ? s.selectedIds.filter((x) => !expanded.includes(x))
          : [...s.selectedIds, ...expanded.filter((x) => !s.selectedIds.includes(x))],
      }
    }),

  selectMany: (ids) =>
    set((s) => {
      const out: string[] = []
      for (const id of ids) {
        for (const x of expandToGroup(id, s.groups[s.activeIndex])) {
          if (!out.includes(x)) out.push(x)
        }
      }
      return { selectedIds: out }
    }),

  setOverride: (index, id, patch, commit = true) =>
    set((s) => {
      const past = commit ? [...s.past, snap(s)] : s.past
      const map: OverrideMap = { ...(s.overrides[index] ?? {}) }
      if (patch === null) delete map[id]
      else map[id] = { ...(map[id] ?? {}), ...patch }
      return { overrides: { ...s.overrides, [index]: map }, past, future: [], dirty: true }
    }),

  setText: (path, value, commit = false) =>
    set((s) => {
      const past = commit ? [...s.past, snap(s)] : s.past
      const draft = setByPath(s.draft ?? ({} as RawCarousel), path, value)
      return { draft, past, future: commit ? [] : s.future, textDirty: true }
    }),

  addNode: (index, node) =>
    set((s) => ({
      added: { ...s.added, [index]: [...(s.added[index] ?? []), node] },
      past: [...s.past, snap(s)],
      future: [],
      dirty: true,
      selectedIds: [node.id],
    })),

  updateNode: (index, id, patch, commit = true) =>
    set((s) => ({
      added: { ...s.added, [index]: (s.added[index] ?? []).map((n) => (n.id === id ? ({ ...n, ...patch } as UserNode) : n)) },
      past: commit ? [...s.past, snap(s)] : s.past,
      future: commit ? [] : s.future,
      dirty: true,
    })),

  removeNode: (index, id) =>
    set((s) => ({
      added: { ...s.added, [index]: (s.added[index] ?? []).filter((n) => n.id !== id) },
      past: [...s.past, snap(s)],
      future: [],
      dirty: true,
      selectedIds: s.selectedIds.filter((x) => x !== id),
    })),

  reorderNode: (index, id, dir) =>
    set((s) => {
      // duas bandas de z (ver user-nodes.ts): behind=true pinta atrás do
      // template. Um passo além da borda da banda cruza pra outra banda,
      // preservando a invariante "nós behind vêm primeiro no array".
      const list = [...(s.added[index] ?? [])]
      const i = list.findIndex((n) => n.id === id)
      if (i < 0) return s
      const n = list[i]!
      const sameBand = (x: UserNode) => !!x.behind === !!n.behind
      const j = dir === 'front' ? list.findIndex((x, k) => k > i && sameBand(x)) : list.findLastIndex((x, k) => k < i && sameBand(x))
      if (j >= 0) {
        ;[list[i], list[j]] = [list[j]!, list[i]!]
      } else if (dir === 'back' && !n.behind) {
        list[i] = { ...n, behind: true } // fundo da banda de cima → atrás do template
      } else if (dir === 'front' && n.behind) {
        const rest = { ...n }
        delete rest.behind
        list[i] = rest // topo da banda de trás → acima do template
      } else {
        return s // já no extremo absoluto
      }
      return { added: { ...s.added, [index]: list }, past: [...s.past, snap(s)], future: [], dirty: true }
    }),

  reorderSlides: (from, to) =>
    set((s) => {
      // índice de cena i ↔ draft.slides[i-1] (capa=0, corpo i→i+1, CTA=N+1).
      // Os contadores (01/10 etc.) são recomputados pelo template ao re-resolver.
      const slides = s.draft?.slides
      if (!slides?.length) return s
      const n = slides.length
      if (from === to || from < 1 || from > n || to < 1 || to > n) return s
      const past = [...s.past, snap(s)]
      const list = [...slides]
      const [moved] = list.splice(from - 1, 1)
      list.splice(to - 1, 0, moved!)
      // payloads por índice de cena (overrides/added/groups) seguem o slide
      const mapIdx = (i: number) => {
        if (i === from) return to
        if (from < to && i > from && i <= to) return i - 1
        if (to < from && i >= to && i < from) return i + 1
        return i
      }
      const remap = <T,>(rec: Record<number, T>): Record<number, T> => {
        const out: Record<number, T> = {}
        for (const [k, v] of Object.entries(rec)) out[mapIdx(Number(k))] = v as T
        return out
      }
      return {
        draft: { ...s.draft!, slides: list },
        overrides: remap(s.overrides),
        added: remap(s.added),
        groups: remap(s.groups),
        activeIndex: mapIdx(s.activeIndex),
        selectedIds: [],
        past,
        future: [],
        dirty: true,
        textDirty: true,
      }
    }),

  applyMoves: (index, moves) =>
    set((s) => {
      if (!moves.length) return s
      const past = [...s.past, snap(s)]
      let list = s.added[index] ?? []
      const map: OverrideMap = { ...(s.overrides[index] ?? {}) }
      for (const mv of moves) {
        if (mv.type === 'user') {
          list = list.map((n) => (n.id === mv.id ? ({ ...n, ...mv.patch } as UserNode) : n))
        } else {
          map[mv.id] = { ...(map[mv.id] ?? {}), ...mv.patch }
        }
      }
      return {
        added: { ...s.added, [index]: list },
        overrides: { ...s.overrides, [index]: map },
        past,
        future: [],
        dirty: true,
      }
    }),

  groupSelection: (index) =>
    set((s) => {
      if (s.selectedIds.length < 2) return s
      const slideGroups: GroupMap = { ...(s.groups[index] ?? {}) }
      // remove membros de grupos antigos (um elemento pertence a 1 grupo)
      for (const gid of Object.keys(slideGroups)) {
        slideGroups[gid] = slideGroups[gid]!.filter((m) => !s.selectedIds.includes(m))
        if (slideGroups[gid]!.length < 2) delete slideGroups[gid]
      }
      slideGroups[`group/${newUserNodeId().slice(5)}`] = [...s.selectedIds]
      return { groups: { ...s.groups, [index]: slideGroups }, past: [...s.past, snap(s)], future: [], dirty: true }
    }),

  ungroupSelection: (index) =>
    set((s) => {
      const slideGroups: GroupMap = { ...(s.groups[index] ?? {}) }
      let changed = false
      for (const gid of Object.keys(slideGroups)) {
        if (slideGroups[gid]!.some((m) => s.selectedIds.includes(m))) {
          delete slideGroups[gid]
          changed = true
        }
      }
      if (!changed) return s
      return { groups: { ...s.groups, [index]: slideGroups }, past: [...s.past, snap(s)], future: [], dirty: true }
    }),

  undo: () =>
    set((s) => {
      if (!s.past.length) return s
      const prev = s.past[s.past.length - 1]!
      return { ...clone(prev), past: s.past.slice(0, -1), future: [snap(s), ...s.future], dirty: true, textDirty: true, styleDirty: true }
    }),

  redo: () =>
    set((s) => {
      if (!s.future.length) return s
      const next = s.future[0]!
      return { ...clone(next), future: s.future.slice(1), past: [...s.past, snap(s)], dirty: true, textDirty: true, styleDirty: true }
    }),

  markClean: () => set({ dirty: false }),
  setStyle: (style) =>
    set((s) => ({
      style: clone(style),
      // template do layout vive no draft (slidesData) → muda junto e persiste
      draft: s.draft && style ? { ...s.draft, template: style.template } : s.draft,
      past: [...s.past, snap(s)],
      future: [],
      styleDirty: true,
      textDirty: true,
    })),
  markStyleClean: () => set({ styleDirty: false }),
  markTextClean: () => set({ textDirty: false }),
}))
