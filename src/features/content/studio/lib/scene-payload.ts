/**
 * Payload persistido em Slide.sceneOverrides. v1 = OverrideMap puro (legado);
 * v2 = { __v:2, overrides, added } — inclui os elementos adicionados pelo
 * usuário. Parser retrocompat: docs antigos abrem sem perda.
 */
import type { OverrideMap, UserNode } from '@publisher/scene-engine'

/** grupos persistentes: groupId → ids dos membros (template e/ou livres). */
export type GroupMap = Record<string, string[]>

export interface ScenePayload {
  overrides: OverrideMap
  added: UserNode[]
  groups: GroupMap
}

export function parseScenePayload(raw: unknown): ScenePayload {
  if (!raw || typeof raw !== 'object') return { overrides: {}, added: [], groups: {} }
  const obj = raw as Record<string, unknown>
  if (obj.__v === 2) {
    return {
      overrides: (obj.overrides as OverrideMap) ?? {},
      added: Array.isArray(obj.added) ? (obj.added as UserNode[]) : [],
      groups: (obj.groups as GroupMap) ?? {},
    }
  }
  // v1: o objeto inteiro é o OverrideMap
  return { overrides: raw as OverrideMap, added: [], groups: {} }
}

export function buildScenePayload(overrides: OverrideMap, added: UserNode[], groups: GroupMap = {}): Record<string, unknown> {
  return { __v: 2, overrides, added, groups }
}

let seq = 0
/** id único de user node (timestamp+seq — sem dependência externa). */
export function newUserNodeId(): string {
  seq = (seq + 1) % 1000
  return `user/${Date.now().toString(36)}${seq.toString(36)}`
}
