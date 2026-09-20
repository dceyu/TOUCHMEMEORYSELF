import * as THREE from 'three';
import type { EffectId, MappingQuad, OutputSnapshot, PerformanceInfo, StudioProject } from '../shared/types';
import { MediaManager } from './media-manager';
import { fragmentShader, vertexShader } from './shaders';
import { ParticleField } from './particle-field';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { AfterimagePass } from 'three/addons/postprocessing/AfterimagePass.js';

export class VisualEngine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-1,1,1,-1,0,2);
  private geometry = new THREE.BufferGeometry();
  private material: THREE.ShaderMaterial;
  private mesh: THREE.Mesh;
  private particles: ParticleField;
  private composer: EffectComposer;
  private afterimage: AfterimagePass;
  private media = new MediaManager();
  private frameCount = 0; private fpsStarted = performance.now(); private last = performance.now(); private raf = 0;
  private snapshot?: OutputSnapshot;
  private qualityScale=1; private lowFpsSamples=0; private highFpsSamples=0;
  private lastWidth=0; private lastHeight=0;
  private renderFailed=false;
  private failedMediaId?:string;
  private onWindowResize=()=>this.resize();
  onPerformance?: (value: PerformanceInfo) => void;
  onError?: (error: Error) => void;

  constructor(private canvas: HTMLCanvasElement, private projector = false) {
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(1);if(!projector)this.qualityScale=.25;
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.material=new THREE.ShaderMaterial({vertexShader,fragmentShader,uniforms:{
      uMediaA:{value:this.media.textureA},uMediaB:{value:this.media.textureB},uHasMedia:{value:0},uTransition:{value:1},uTime:{value:0},uBrightness:{value:1},uBlackout:{value:0},uResolution:{value:new THREE.Vector2(1,1)},uMediaSize:{value:new THREE.Vector2(1,1)},uFit:{value:0},uRotation:{value:0},uMirror:{value:new THREE.Vector2(0,0)},
      ...Object.fromEntries(['Disperse','Blocks','Warp','Vortex','LightPath','Tide'].map(id=>[`u${id}`,{value:0}]))
    }});
    this.mesh=new THREE.Mesh(this.geometry,this.material);this.mesh.renderOrder=0;this.particles=new ParticleField(projector?640:320,projector?360:180);this.scene.add(this.mesh,this.particles.points); this.camera.position.z=1;
    this.composer=new EffectComposer(this.renderer);this.composer.addPass(new RenderPass(this.scene,this.camera));this.afterimage=new AfterimagePass(.86);this.composer.addPass(this.afterimage);
    this.setQuad({topLeft:[0,0],topRight:[1,0],bottomRight:[1,1],bottomLeft:[0,1]});
    this.resize();window.addEventListener('resize',this.onWindowResize); this.loop=this.loop.bind(this); this.raf=requestAnimationFrame(this.loop);
  }

  async apply(snapshot: OutputSnapshot) {
    this.snapshot=snapshot; const p=snapshot.project; const selected=p.assets.find(a=>a.id===p.activeMediaId);
    if(selected) try { await this.media.select(selected, !this.material.uniforms.uHasMedia.value); this.material.uniforms.uHasMedia.value=1;this.failedMediaId=undefined; } catch(error){if(this.failedMediaId!==selected.id){this.failedMediaId=selected.id;this.onError?.(error instanceof Error?error:new Error(String(error)));} }
    else { this.media.clear(); this.material.uniforms.uHasMedia.value=0; }
    const desired=p.mapping.previewMode==='eco'?.25:p.mapping.previewMode==='standard'?.5:p.mapping.previewMode==='high'?.75:p.mapping.previewMode==='1080p'?1:p.mapping.previewScale;if(!this.projector&&this.qualityScale!==desired){this.qualityScale=desired;this.resize();}this.setMapping(p.mapping); this.material.uniforms.uBrightness.value=p.mapping.brightness; this.material.uniforms.uBlackout.value=p.mapping.blackout?1:0;
    this.material.uniforms.uFit.value=['fill','fit','stretch'].indexOf(p.mapping.fit); this.material.uniforms.uRotation.value=p.mapping.rotation/90;
    this.material.uniforms.uMirror.value.set(p.mapping.mirrorX?1:0,p.mapping.mirrorY?1:0);
    for(const [id,value] of Object.entries(snapshot.effectValues) as [EffectId,number][]) this.material.uniforms[`u${id[0].toUpperCase()}${id.slice(1)}`].value=p.effects[id].enabled?value*p.effects[id].intensity:0;
    this.particles.apply(snapshot,this.media.hasMedia);
    this.afterimage.uniforms['damp'].value=snapshot.particleEvent?.opacity===0?0:Math.min(p.ambient.trail,snapshot.particleEvent&&snapshot.particleEvent.opacity<.9?.7:.97);
  }

  dispose(){cancelAnimationFrame(this.raf);window.removeEventListener('resize',this.onWindowResize);this.media.dispose();this.particles.dispose();this.geometry.dispose();this.material.dispose();this.composer.dispose();this.renderer.dispose();}
  private resize(){const target=this.canvas.parentElement??this.canvas;const w=target.clientWidth||window.innerWidth,h=target.clientHeight||window.innerHeight;this.lastWidth=w;this.lastHeight=h;const fixed1080=!this.projector&&this.snapshot?.project.mapping.previewMode==='1080p';const rw=fixed1080?1920:Math.round(w*this.qualityScale),rh=fixed1080?1080:Math.round(h*this.qualityScale);this.renderer.setSize(rw,rh,false);this.composer?.setSize(rw,rh);this.canvas.style.width=fixed1080?'auto':'100%';this.canvas.style.height='100%';this.canvas.style.maxWidth='100%';this.canvas.style.margin='auto';this.material.uniforms.uResolution.value.set(rw,rh);}
  private setQuad(q:MappingQuad){const pt=(p:[number,number])=>[p[0]*2-1,1-p[1]*2,0];const positions=[...pt(q.bottomLeft),...pt(q.bottomRight),...pt(q.topRight),...pt(q.topLeft)];this.geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));this.geometry.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,1,1,0,1],2));this.geometry.setIndex([0,1,2,0,2,3]);}
  private setMapping(mapping:StudioProject['mapping']){if(mapping.controlMode==='basic'){this.setQuad(mapping.quad);return;}const {columns,rows,points}=mapping.grid;if(points.length!==columns*rows){this.setQuad(mapping.quad);return;}const positions:number[]=[],uvs:number[]=[],indices:number[]=[];for(let row=0;row<rows;row++)for(let column=0;column<columns;column++){const point=points[row*columns+column];positions.push(point[0]*2-1,1-point[1]*2,0);uvs.push(column/(columns-1),1-row/(rows-1));}for(let row=0;row<rows-1;row++)for(let column=0;column<columns-1;column++){const top=row*columns+column,bottom=top+columns;indices.push(top,bottom,bottom+1,top,bottom+1,top+1);}this.geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));this.geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));this.geometry.setIndex(indices);}
  private loop(now:number){this.raf=requestAnimationFrame(this.loop);if(this.renderFailed)return;try{const host=this.canvas.parentElement??this.canvas;if(host.clientWidth!==this.lastWidth||host.clientHeight!==this.lastHeight)this.resize();this.media.update(now);this.material.uniforms.uMediaA.value=this.media.textureA;this.material.uniforms.uMediaB.value=this.media.textureB;this.material.uniforms.uTransition.value=this.media.transition;this.material.uniforms.uMediaSize.value.set(...this.media.size);this.material.uniforms.uTime.value=now*.001;const renderSize=this.renderer.getDrawingBufferSize(new THREE.Vector2());this.particles.update(now,this.media,renderSize.x,renderSize.y);this.composer.render();this.frameCount++;if(now-this.fpsStarted>=1000){const fps=this.frameCount*1000/(now-this.fpsStarted);const frameMs=(now-this.last)/Math.max(1,this.frameCount);if(this.projector){this.lowFpsSamples=fps<26?this.lowFpsSamples+1:0;this.highFpsSamples=fps>29?this.highFpsSamples+1:0;if(this.lowFpsSamples>=3&&this.qualityScale>.5){this.qualityScale=this.qualityScale===1?.75:.5;this.lowFpsSamples=0;this.resize();}else if(this.highFpsSamples>=10&&this.qualityScale<1){this.qualityScale=this.qualityScale===.5?.75:1;this.highFpsSamples=0;this.resize();}}const quality=this.qualityScale===1?'high':this.qualityScale===.75?'medium':'low';this.onPerformance?.({fps,frameMs,quality,serialConnected:false,globalState:'running'});this.frameCount=0;this.fpsStarted=now;this.last=now;}}catch(error){this.renderFailed=true;this.onError?.(error instanceof Error?error:new Error(String(error)));}}
}
