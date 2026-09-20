import { describe,expect,it } from 'vitest';
import { defaultGrid } from '../shared/defaults';
import { createGridUniformPoints } from './particle-field';

describe('particle grid uniforms',()=>{
  it('always fills all 25 GPU uniform slots for a 3x3 grid',()=>{const values=createGridUniformPoints(defaultGrid(3).points);expect(values).toHaveLength(25);expect(values.every(Boolean)).toBe(true);expect(values[0].toArray()).toEqual([0,1]);expect(values[8].toArray()).toEqual([1,0]);});
});
