import { z } from 'zod';
import { touchConfigSchema } from './touch';
const finite=z.number().finite();
const unit=finite.min(0).max(1);
const point=z.tuple([finite,finite]);
const envelope=z.object({threshold:unit,hysteresis:unit,smoothingMs:finite.min(0),attackMs:finite.min(0),releaseMs:finite.min(0),invert:z.boolean(),calibrationMin:finite,calibrationMax:finite});
const schema=z.object({
  formatVersion:z.literal(1),name:z.string(),
  assets:z.array(z.object({id:z.string(),name:z.string(),path:z.string(),type:z.enum(['image','video'])})),
  nodes:z.array(z.object({id:z.string(),kind:z.enum(['sensor','constant','time','mapping','media','effect','uv','output','final']),label:z.string(),position:z.object({x:finite,y:finite}),channel:z.union([z.number().int().min(0).max(7),z.literal('final')]).optional(),envelope:envelope.optional()})),
  edges:z.array(z.object({id:z.string(),source:z.string(),target:z.string()})),
  cues:z.array(z.object({kind:z.string(),label:z.string(),durationMs:finite.min(100).max(30000),transitionMs:finite.min(100).max(10000).optional(),intensity:finite.min(0).max(2)})).length(8).optional(),
  arduino:z.object({wiring:z.enum(['mux','digital','capacitive']),touch:touchConfigSchema.extend({measurement:touchConfigSchema.shape.measurement.optional()}).optional(),takeover:z.boolean(),debounceMs:finite.min(0).max(2000),channels:z.array(z.object({enabled:z.boolean(),activeLow:z.boolean(),threshold:unit})).length(8)}).optional(),
  ambient:z.object({enabled:z.boolean(),amplitude:finite,speed:finite,randomness:unit,force:finite,direction:finite,movementRange:finite,trail:unit}).optional(),
  quantum:z.object({pointSize:finite.min(.1).max(10),brightness:finite.min(0).max(3).optional(),edgeFeather:finite.min(.02).max(.5).optional()}).optional(),
  mapping:z.object({quad:z.object({topLeft:point,topRight:point,bottomLeft:point,bottomRight:point}),brightness:unit,blackout:z.boolean(),sourceFrame:z.object({x:unit,y:unit,width:finite.min(.05).max(1),height:finite.min(.05).max(1)}).optional(),previewMode:z.enum(['eco','standard','high','1080p','auto']).optional(),grid:z.object({columns:z.union([z.literal(3),z.literal(5)]),rows:z.union([z.literal(3),z.literal(5)]),points:z.array(point)}).refine(g=>g.points.length===g.columns*g.rows).optional()}).passthrough(),
  emotionSequence:z.object({autoPlay:z.boolean(),globalDelayMs:finite.min(1000).max(300000),steps:z.array(z.object({useGlobal:z.boolean(),delayMs:finite.min(1000).max(300000),next:z.number().int().min(0).max(6)})).length(7)}).optional(),
  serial:z.object({channels:z.array(envelope).length(8),finalSource:z.union([z.literal('final'),z.number().int().min(0).max(7)]),finalReleaseMs:finite.min(0)}).passthrough(),
  effects:z.object(Object.fromEntries(['disperse','blocks','warp','vortex','lightPath','tide'].map(id=>[id,z.object({enabled:z.boolean(),intensity:finite.min(0).max(2)})]))),
});
export function validateProject(value:unknown){const result=schema.safeParse(value);if(!result.success)throw new Error('Invalid settings / 设置文件无效: '+result.error.issues.map(i=>i.path.join('.')+': '+i.message).join('; '));}
