import { z } from 'zod';

const count = z.number().int().min(0).max(4095);
export const touchConfigSchema = z.object({
  finalMode: z.enum(['button', 'touch']),
  measurement:z.object({preset:z.enum(['1M','4.7M','10M','custom']),samples:z.number().int().min(1).max(12),limit:z.number().int().min(50).max(4095)}),
  channels: z.array(z.object({
    baseline: count, on: z.number().int().min(1).max(4095), off: count,
    pressMs: z.number().int().min(20).max(2000), releaseMs: z.number().int().min(20).max(2000)
  }).refine(c => c.off < c.on && c.baseline + c.on <= 4095, 'Release < trigger; baseline + trigger <= 4095')).length(8)
});
export type TouchConfig = z.infer<typeof touchConfigSchema>;
export const defaultTouch = (): TouchConfig => ({finalMode:'button',measurement:{preset:'1M',samples:3,limit:300},channels:Array.from({length:8},()=>({baseline:0,on:5,off:3,pressMs:60,releaseMs:100}))});
export type TouchTelemetry = { firmware:'touch-1'; configId:number; calibrating:boolean; raw:number[]; counts:number[]; synced?:boolean };
export const touchTelemetrySchema = z.object({firmware:z.literal('touch-1'),configId:z.number().int().min(0).max(65535),calibrating:z.boolean(),raw:z.array(count).length(8),counts:z.array(z.number().int().min(0).max(4294967295)).length(8)});
export function touchCommand(config:TouchConfig,id:number):string {
  const c=touchConfigSchema.parse(config);
  return `CFG ${id} ${c.finalMode==='touch'?1:0} ${c.measurement.samples} ${c.measurement.limit} ${c.channels.flatMap(v=>[v.baseline,v.on,v.off,v.pressMs,v.releaseMs]).join(' ')}\n`;
}
export function calibratedConfig(config:TouchConfig,baseline:number[]):TouchConfig {
  if(baseline.length!==8)throw new Error('Invalid calibration');
  if(baseline.some((value,index)=>index!==7||config.finalMode==='touch'?value>=config.measurement.limit:false))throw new Error('Calibration saturated');
  return touchConfigSchema.parse({...config,channels:config.channels.map((c,i)=>({...c,baseline:i===7&&config.finalMode==='button'?0:baseline[i]}))});
}
export const touchPins=['D2 → D3','D4 → D5','D6 → D7','D8 → D9','D10 → D11','A0 → A1','A2 → A3','A4 → A5'];
