import { describe, expect, it } from 'vitest';
import { defaultEnvelope } from '../shared/defaults';
import { EnvelopeProcessor } from './envelope';
describe('input envelope',()=>{
  it('uses threshold, hysteresis and gradual release',()=>{const p=new EnvelopeProcessor();const c={...defaultEnvelope(),smoothingMs:0,attackMs:0,releaseMs:1000};expect(p.update(.7,c,16).triggered).toBe(true);const released=p.update(.4,c,100);expect(released.triggered).toBe(false);expect(released.envelope).toBeGreaterThan(0);});
  it('calibrates and inverts values',()=>{const p=new EnvelopeProcessor();const c={...defaultEnvelope(),calibrationMin:.2,calibrationMax:.8,invert:true,smoothingMs:0};expect(p.update(.2,c,16).normalized).toBe(1);});
});
