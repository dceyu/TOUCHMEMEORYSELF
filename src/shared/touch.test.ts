import { describe,it,expect,vi } from 'vitest';
import { defaultTouch,touchConfigSchema,touchCommand,calibratedConfig } from './touch';
import { firmwareSource } from './arduino';
import { parseSensorFrame } from './protocol';
import { createDefaultProject } from './defaults';
import { validateProject } from './validate-project';
import { TouchSession } from '../../electron/touch-session';
import type { SensorFrame } from './types';

const frame=(id:number,high=0):SensorFrame=>({version:1,seq:1,channels:[high,0,0,0,0,0,0,0],final:0,touch:{firmware:'touch-1',configId:id,calibrating:false,raw:Array(8).fill(2),counts:Array(8).fill(0)}});
describe('capacitive touch',()=>{
  it('validates threshold hysteresis, finite bounded timings and all eight channels',()=>{
    const c=defaultTouch();expect(touchConfigSchema.parse(c)).toEqual(c);
    c.channels[0].off=5;expect(()=>touchConfigSchema.parse(c)).toThrow();
    c.channels[0].off=3;c.channels[0].baseline=4094;expect(()=>touchConfigSchema.parse(c)).toThrow();
    expect(()=>touchConfigSchema.parse({...defaultTouch(),channels:[]})).toThrow();
    expect(()=>touchConfigSchema.parse({...defaultTouch(),finalMode:'D2'})).toThrow();
  });
  it('produces bounded commands and calibrates baselines without changing thresholds',()=>{
    const c=defaultTouch(),out=calibratedConfig(c,[2,3,4,5,6,7,8,1]);
    expect(out.channels[0]).toEqual({...c.channels[0],baseline:2});expect(out.channels[7].baseline).toBe(0);
    expect(touchCommand(out,12)).toMatch(/^CFG 12 0 /);expect(touchCommand(out,12).length).toBeLessThan(256);
    expect(()=>calibratedConfig(c,Array(8).fill(300))).toThrow();
  });
  it('parses telemetry strictly and retains legacy protocol',()=>{
    expect(parseSensorFrame(JSON.stringify(frame(1)))?.touch?.raw).toEqual(Array(8).fill(2));
    const bad=frame(1);bad.touch!.raw=[200];expect(parseSensorFrame(JSON.stringify(bad))).toBeNull();
    expect(parseSensorFrame('SENSOR_1_ON')).toBeNull();
    expect(parseSensorFrame(JSON.stringify({...frame(1),touch:undefined}))?.channels).toHaveLength(8);
  });
  it('roundtrips touch settings in saved projects and accepts older projects',()=>{
    const p=createDefaultProject();p.arduino.wiring='capacitive';p.arduino.touch.finalMode='touch';p.arduino.touch.channels[2].baseline=12;
    const restored=JSON.parse(JSON.stringify(p));validateProject(restored);expect(restored.arduino.touch).toEqual(p.arduino.touch);
    delete restored.arduino.touch;restored.arduino.wiring='digital';expect(()=>validateProject(restored)).not.toThrow();
    restored.arduino.touch={finalMode:'touch',channels:[]};expect(()=>validateProject(restored)).toThrow();
  });
  it('generates both CH8 modes with correct pin pairs, bounded sensing and heartbeat',()=>{
    const c=defaultTouch();const source=firmwareSource('capacitive',c);
    expect(source).toContain('sendPins[8]={2,4,6,8,10,A0,A2,A4}');expect(source).toContain('pinMode(12,INPUT_PULLUP)');
    expect(source).toContain('cycles<measurementLimit');expect(source).toContain('Serial.begin(115200)');expect(source).toContain('bool finalTouch=false');
    c.finalMode='touch';expect(firmwareSource('capacitive',c)).toContain('bool finalTouch=true');
  });
});
describe('touch configuration session',()=>{
  it('requires a fresh revision even when the board reports a reused desktop id',()=>{
    const sent:string[]=[];const s=new TouchSession(line=>sent.push(line));s.configure(defaultTouch());
    expect(s.frame(frame(2,1)).touch?.synced).toBe(false);expect(sent[0]).toMatch(/^CFG 3 /);
    expect(s.frame(frame(2,1)).channels[0]).toBe(0);expect(s.frame(frame(3,1)).channels[0]).toBe(1);
  });
  it('fails closed rather than throwing from a receive callback when writing fails',()=>{
    const s=new TouchSession(()=>{throw new Error('closed');});s.configure(defaultTouch());
    expect(s.frame(frame(0,1)).channels[0]).toBe(0);
    expect(s.frame(frame(2,1)).touch?.synced).toBe(false);
  });
  it('only sends config after firmware identification, gates until ack and retries',()=>{
    let now=0;const sent:string[]=[];const s=new TouchSession(x=>sent.push(x),()=>now);s.configure(defaultTouch());expect(sent).toEqual([]);
    expect(s.frame(frame(0,1)).channels[0]).toBe(0);expect(sent[0]).toMatch(/^CFG 2 /);
    now=100;s.frame(frame(0));expect(sent).toHaveLength(1);now=600;s.frame(frame(0));expect(sent).toHaveLength(2);
    expect(s.frame(frame(2,1)).touch?.synced).toBe(true);expect(s.frame(frame(2,1)).channels[0]).toBe(1);
    now=1200;s.frame(frame(2));expect(sent.at(-1)).toBe('PING 2\n');
    s.disconnect();expect(s.frame(frame(2,1)).channels[0]).toBe(0);expect(sent.at(-1)).toMatch(/^CFG 3 /);
  });
  it('suppresses mismatched firmware and disarms when profile is disabled',()=>{
    const s=new TouchSession(()=>{});expect(s.frame(frame(0,1)).channels[0]).toBe(0);
    const legacy={...frame(0,1),touch:undefined};expect(s.frame(legacy).channels[0]).toBe(1);
    s.configure(defaultTouch());expect(s.frame(legacy).channels[0]).toBe(0);
  });
  it('calibrates with explicit acknowledgement and re-synchronizes',async()=>{
    const sent:string[]=[];const s=new TouchSession(x=>sent.push(x));s.configure(defaultTouch());s.frame(frame(0));s.frame(frame(2));
    const result=s.calibrate();expect(sent.at(-1)).toBe('CAL 2\n');expect(s.frame(frame(2,1)).channels[0]).toBe(0);
    s.response(JSON.stringify({calibrated:2,baseline:Array(8).fill(2)}));expect((await result).channels[0].baseline).toBe(2);
    s.frame(frame(0));expect(sent.at(-1)).toMatch(/^CFG 3 /);expect(s.frame(frame(3)).touch?.synced).toBe(true);
  });
  it('rejects calibration without sync, on disconnect, saturation or timeout',async()=>{
    vi.useFakeTimers();try{
      const s=new TouchSession(()=>{});await expect(s.calibrate()).rejects.toThrow();s.configure(defaultTouch());s.frame(frame(0));s.frame(frame(2));
      const disconnected=expect(s.calibrate()).rejects.toThrow('Disconnected');s.disconnect();await disconnected;
      s.frame(frame(0));s.frame(frame(3));const saturated=expect(s.calibrate()).rejects.toThrow('saturated');s.response(JSON.stringify({calibrated:3,baseline:Array(8).fill(300)}));await saturated;
      s.frame(frame(3));const timeout=expect(s.calibrate()).rejects.toThrow('timed out');await vi.advanceTimersByTimeAsync(6001);await timeout;
    }finally{vi.useRealTimers();}
  });
});
