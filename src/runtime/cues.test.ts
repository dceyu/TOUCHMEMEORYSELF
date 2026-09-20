import {describe,it,expect} from 'vitest';
import {defaultCues} from '../shared/defaults';
import {CueRuntime,emotionTarget,neutralEvent} from './particle-events';
import {EmotionSequence} from './emotion-sequence';
describe('persistent emotion states',()=>{
  it('defines seven distinct transformations',()=>{const c=defaultCues();expect(emotionTarget(c[1].kind).centerHole).toBeGreaterThan(0);expect(emotionTarget(c[2].kind).swirl).toBeGreaterThan(0);expect(emotionTarget(c[3].kind).ambientInfluence).toBeLessThan(.2);expect(emotionTarget(c[4].kind).randomForce).toBeGreaterThan(1);expect(emotionTarget(c[5].kind).verticalFall).toBeGreaterThan(0);expect(emotionTarget(c[6].kind).originReturn).toBe(1);});
  it('enters and holds until replaced',()=>{const r=new CueRuntime(),c=defaultCues();r.trigger(1,0,c[1]);expect(r.resolve(c,2500).centerHole).toBeGreaterThan(0);const held=r.resolve(c,100000);expect(held.centerHole).toBeGreaterThan(0);r.trigger(3,100000,c[3]);expect(r.resolve(c,100000)).toEqual(held);expect(r.resolve(c,110000).ambientInfluence).toBeLessThan(.2);});
  it('returns to ambient explicitly and CH8 stays dark',()=>{const r=new CueRuntime(),c=defaultCues();r.trigger(5,0,c[5]);r.resolve(c,9000);r.deactivate(9000,1000);expect(r.resolve(c,10000)).toEqual(neutralEvent());r.trigger(1,11000,c[1]);r.resolve(c,12000);r.trigger(7,12000,c[7]);expect(r.resolve(c,20000).opacity).toBe(0);r.reset();expect(r.resolve(c,21000)).toEqual(neutralEvent());});
  it('advances, lets last touch win, and exits after acceptance',()=>{const s=new EmotionSequence(),cfg={autoPlay:true,globalDelayMs:15000,steps:Array.from({length:7},(_,i)=>({useGlobal:true,delayMs:5000,next:Math.min(6,i+1)}))};s.trigger(0,0);expect(s.update(cfg,14999)).toBeUndefined();expect(s.update(cfg,15000)).toBe(1);s.trigger(4,16000);expect(s.activeIndex).toBe(4);expect(s.update(cfg,31000)).toBe(5);s.trigger(6,32000);expect(s.update(cfg,47000)).toBe('ambient');expect(s.activeIndex).toBeUndefined();});
});
