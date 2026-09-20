import { describe, expect, it } from 'vitest';
import { GlobalStateMachine } from './global-state';
describe('global final',()=>{
  it('releases effects and returns to standby after signal is low',()=>{const s=new GlobalStateMachine();s.activate();s.trigger(0);expect(s.update(true,1000,500)).toBeGreaterThan(0);expect(s.update(false,1000,1000)).toBe(0);s.update(false,1000,1501);expect(s.state).toBe('standby');});
});
