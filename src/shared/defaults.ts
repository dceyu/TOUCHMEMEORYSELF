import { defaultArduino } from './arduino';
import type { CueConfig, EffectId, InputEnvelope, StudioProject } from './types';
export const defaultEnvelope = (): InputEnvelope => ({ threshold: 0.55, hysteresis: 0.08, smoothingMs: 120, attackMs: 180, releaseMs: 4000, invert: false, calibrationMin: 0, calibrationMax: 1 });
const effectIds: EffectId[] = ['disperse', 'blocks', 'warp', 'vortex', 'lightPath', 'tide'];
export const defaultGrid = (size:3|5=3) => ({columns:size,rows:size,points:Array.from({length:size*size},(_,index)=>[(index%size)/(size-1),Math.floor(index/size)/(size-1)] as [number,number])});
export const defaultCues = (): CueConfig[] => [
  { kind:'doubt',label:'怀疑',durationMs:2800,transitionMs:2000,intensity:1 },
  { kind:'explore',label:'探索',durationMs:5200,transitionMs:2000,intensity:1 },
  { kind:'desire',label:'欲望',durationMs:8500,transitionMs:2400,intensity:1 },
  { kind:'confidence',label:'自信',durationMs:5200,transitionMs:2000,intensity:1 },
  { kind:'conflict',label:'冲突',durationMs:2600,transitionMs:1600,intensity:1 },
  { kind:'void',label:'虚无',durationMs:6500,transitionMs:2200,intensity:1 },
  { kind:'acceptance',label:'接纳',durationMs:7500,transitionMs:2200,intensity:1 },
  { kind:'finalDissolve',label:'结束 · 光芒消散',durationMs:5000,transitionMs:2000,intensity:1 }
];
export function createDefaultProject(): StudioProject {
  const cues=defaultCues();
  const sensorNodes = Array.from({ length: 8 }, (_, index) => ({ id: `sensor-${index}`, kind: 'sensor' as const, label: `CH ${index + 1} · ${cues[index].label}`, position: { x: 40, y: 45 + index * 92 }, channel: index, envelope: defaultEnvelope() }));
  const effectNodes = effectIds.map((effectId, index) => ({ id: `effect-${effectId}`, kind: 'effect' as const, label: effectId.toUpperCase(), position: { x: 430, y: 45 + index * 112 }, effectId }));
  return {
    formatVersion: 1, name: 'Untitled Mapping',
    nodes: [...sensorNodes, { id: 'media', kind: 'media', label: 'MEDIA CROSSFADER', position: { x: 250, y: 760 } }, ...effectNodes, { id: 'final', kind: 'final', label: 'GLOBAL FINAL', position: { x: 40, y: 800 }, channel: 'final' }, { id: 'uv', kind: 'uv', label: 'UV MAPPING', position: { x: 700, y: 245 } }, { id: 'output', kind: 'output', label: 'PROJECTOR OUT', position: { x: 900, y: 245 } }],
    edges: [],
    assets: [],
    effects: Object.fromEntries(effectIds.map(id => [id, { enabled: true, intensity: 0.7, attackMs: 180, releaseMs: 4000, blendMode: id === 'lightPath' ? 'add' : 'normal' }])) as StudioProject['effects'],
    cues,
    ambient: { enabled:true,amplitude:.32,speed:.34,randomness:.18,force:.22,direction:0,movementRange:.65,trail:.86 },
    arduino: defaultArduino(),
    quantum: { pointSize:1.15,brightness:1,edgeFeather:.2 },
    ui: { language:'zh',layout:{leftWidth:260,rightWidth:270,previewHeight:42} },
    emotionSequence:{autoPlay:true,globalDelayMs:15000,steps:Array.from({length:7},(_,i)=>({useGlobal:true,delayMs:15000,next:Math.min(6,i+1)}))},
    routing: { enabled:false },
    playlist: { enabled:false,loop:true,mode:'timed',advanceChannel:'manual',items:[] },
    mapping: { quad: { topLeft: [0, 0], topRight: [1, 0], bottomRight: [1, 1], bottomLeft: [0, 1] }, controlMode:'basic',editorLayer:'uv',grid:defaultGrid(3),sourceFrame:{x:0,y:0,width:1,height:1},previewMode:'eco',previewScale:.25,fit: 'fill', rotation: 0, mirrorX: false, mirrorY: false, brightness: 1, blackout: false, locked: false },
    serial: { baudRate: 115200, channels: Array.from({ length: 8 }, defaultEnvelope), finalSource: 7, finalReleaseMs: 8000 }
  };
}
