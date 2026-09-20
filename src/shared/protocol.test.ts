import { describe, expect, it } from 'vitest';
import { parseSensorFrame } from './protocol';
describe('sensor protocol',()=>{
  it('accepts and clamps a valid frame',()=>{const frame=parseSensorFrame('{"version":1,"seq":8,"channels":[-1,0,0.2,0.4,0.6,0.8,1,2],"final":1}');expect(frame?.channels).toEqual([0,0,.2,.4,.6,.8,1,1]);expect(frame?.final).toBe(1);});
  it('rejects malformed or incomplete input',()=>{expect(parseSensorFrame('{}')).toBeNull();expect(parseSensorFrame('{broken')).toBeNull();expect(parseSensorFrame('{"version":1,"seq":1,"channels":[1]}')).toBeNull();});
});
