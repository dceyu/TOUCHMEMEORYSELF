import { describe,it,expect } from 'vitest';
import { BinaryInputs,defaultArduino,firmwareSource } from './arduino';
import { createDefaultProject } from './defaults';
import { validateProject } from './validate-project';
describe('binary sensor control',()=>{
  it('filters bounce, fires once while held and rearms after a stable release',()=>{
    const r=new BinaryInputs(),c=defaultArduino(),on=[1,0,0,0,0,0,0,0],off=Array(8).fill(0);
    expect(r.update(on,c,0)[0]).toBe(false);
    expect(r.update(off,c,20)[0]).toBe(false);
    expect(r.update(on,c,30)[0]).toBe(false);
    expect(r.update(on,c,89)[0]).toBe(false);
    expect(r.update(on,c,90)[0]).toBe(true);
    expect(r.update(on,c,9000)[0]).toBe(false);
    r.update(off,c,9100);r.update(off,c,9200);r.update(on,c,9300);
    expect(r.update(on,c,9400)[0]).toBe(true);
  });
  it('supports inverted sensors and disabled takeover',()=>{
    const r=new BinaryInputs(),c=defaultArduino();c.channels[0].activeLow=true;c.channels[1].enabled=false;
    r.update([0,1],c,0);expect(r.update([0,1],c,100).slice(0,2)).toEqual([true,false]);
    r.reset();c.takeover=false;r.update([0,1],c,200);expect(r.update([0,1],c,300).some(Boolean)).toBe(false);
  });
  it('validates settings before applying and accepts legacy projects',()=>{
    const p=createDefaultProject();p.ambient.amplitude=.84;p.arduino.channels[3].activeLow=true;
    const restored=JSON.parse(JSON.stringify(p));expect(()=>validateProject(restored)).not.toThrow();
    expect(restored.ambient.amplitude).toBe(.84);expect(restored.arduino.channels[3].activeLow).toBe(true);
    delete restored.arduino;expect(()=>validateProject(restored)).not.toThrow();
    restored.serial.channels=[];expect(()=>validateProject(restored)).toThrow();
    expect(()=>validateProject({formatVersion:99})).toThrow();
  });
  it('generates only the two supported input-only Uno programs',()=>{
    expect(firmwareSource('digital')).toContain('INPUT_PULLUP');
    expect(firmwareSource('mux')).toContain('analogRead(A0)');
    expect(()=>firmwareSource('other' as 'mux')).toThrow();
  });
});
