import { describe, expect, it } from 'vitest';
import { createDefaultProject } from '../shared/defaults';
import { createsCycle, resolveEffectValues } from './graph';
describe('node graph',()=>{
  it('rejects cycles',()=>{const p=createDefaultProject();expect(createsCycle(p.nodes,[{id:'a',source:'sensor-0',target:'effect-disperse'}],{source:'effect-disperse',target:'sensor-0'})).toBe(true);});
  it('routes explicitly connected channels to effects',()=>{const p=createDefaultProject();const edges=[{id:'test-route',source:'sensor-0',target:'effect-disperse',combine:'max' as const}];const values=resolveEffectValues(p.nodes,edges,[.75,0,0,0,0,0,0,0]);expect(values.disperse).toBe(.75);});
  it('ignores a connection switched off by the operator',()=>{const p=createDefaultProject();const edges=[{id:'off-route',source:'sensor-0',target:'effect-disperse',enabled:false}];const values=resolveEffectValues(p.nodes,edges,[1,0,0,0,0,0,0,0]);expect(values.disperse).toBe(0);});
});
