import type { EffectId, StudioEdge, StudioNode } from '../shared/types';

export function createsCycle(nodes: StudioNode[], edges: StudioEdge[], candidate: Pick<StudioEdge, 'source' | 'target'>): boolean {
  if (candidate.source === candidate.target) return true;
  const adjacency = new Map(nodes.map(node => [node.id, [] as string[]]));
  for (const edge of [...edges, { id: 'candidate', ...candidate } as StudioEdge]) adjacency.get(edge.source)?.push(edge.target);
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const next of adjacency.get(id) ?? []) if (visit(next)) return true;
    visiting.delete(id); visited.add(id); return false;
  };
  return nodes.some(node => visit(node.id));
}

export function resolveEffectValues(nodes: StudioNode[], edges: StudioEdge[], channelValues: number[], excludedChannel?: number): Record<EffectId, number> {
  const ids: EffectId[] = ['disperse', 'blocks', 'warp', 'vortex', 'lightPath', 'tide'];
  const values = Object.fromEntries(ids.map(id => [id, 0])) as Record<EffectId, number>;
  const byId = new Map(nodes.map(node => [node.id, node]));
  for (const effectId of ids) {
    const target = nodes.find(node => node.effectId === effectId);
    if (!target) continue;
    const incoming = edges.filter(edge => edge.enabled!==false&&edge.target === target.id).map(edge => ({ edge, node: byId.get(edge.source) })).filter(item => item.node?.kind === 'sensor');
    for (const { edge, node } of incoming) {
      const value = typeof node!.channel === 'number' && node!.channel !== excludedChannel ? channelValues[node!.channel] ?? 0 : 0;
      values[effectId] = edge.combine === 'sum' ? Math.min(1, values[effectId] + value) : Math.max(values[effectId], value);
    }
  }
  return values;
}
