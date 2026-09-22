import * as THREE from 'three';
import type { EffectId, MappingQuad, OutputSnapshot } from '../shared/types';
import type { MediaManager } from './media-manager';

const particleVertexShader = /* glsl */`
  precision highp float;
  attribute vec2 aUv;
  attribute float aSeed;
  uniform sampler2D uMediaA;
  uniform sampler2D uMediaB;
  uniform float uTransition;
  uniform float uTime;
  uniform float uHasMedia;
  uniform float uBrightness;
  uniform float uBlackout;
  uniform vec2 uResolution;
  uniform vec2 uMediaSize;
  uniform float uFit;
  uniform float uRotation;
  uniform vec2 uMirror;
  uniform vec2 uTopLeft;
  uniform vec2 uTopRight;
  uniform vec2 uBottomRight;
  uniform vec2 uBottomLeft;
  uniform float uGridEnabled;
  uniform vec2 uGridSize;
  uniform vec2 uGridPoints[25];
  uniform float uDisperse;
  uniform float uBlocks;
  uniform float uWarp;
  uniform float uVortex;
  uniform float uLightPath;
  uniform float uTide;
  uniform float uAmbientEnabled;
  uniform float uAmbientAmplitude;
  uniform float uAmbientSpeed;
  uniform float uAmbientRandomness;
  uniform float uAmbientForce;
  uniform float uAmbientDirection;
  uniform float uAmbientRange;
  uniform float uPointSize;
  uniform float uBaseBrightness;
  uniform float uEventEdgeFeather;
  uniform float uEventRadius;
  uniform float uEventSpread;
  uniform float uEventBrightness;
  uniform float uEventOpacity;
  uniform float uEventVisibility;
  uniform float uEventRadialForce;uniform float uEventSwirl;uniform float uEventCenterHole;uniform float uEventRandomForce;uniform float uEventVerticalFall;uniform float uEventGlow;uniform float uEventFlicker;uniform float uEventOriginReturn;uniform float uEventAmbientInfluence;
  uniform vec4 uSourceFrame;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vSpark;

  float hash21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
  float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x),mix(hash21(i+vec2(0,1)),hash21(i+vec2(1,1)),f.x),f.y);}
  vec2 rotateUv(vec2 uv,float turns){float a=turns*1.5707963;vec2 p=uv-.5;return mat2(cos(a),-sin(a),sin(a),cos(a))*p+.5;}
  vec4 media(vec2 uv){vec4 a=texture2D(uMediaA,uv),b=texture2D(uMediaB,uv);float n=noise(uv*6.0+uTime*.08);float d=smoothstep(n-.14,n+.14,uTransition);return mix(a,b,d);}
  vec2 quad(vec2 uv){vec2 bottom=mix(uBottomLeft,uBottomRight,uv.x);vec2 top=mix(uTopLeft,uTopRight,uv.x);return mix(bottom,top,uv.y);}
  vec2 mappedUv(vec2 uv){
    if(uGridEnabled<.5)return quad(uv);
    vec2 size=max(vec2(2.0),uGridSize),g=vec2(clamp(uv.x,0.0,1.0),clamp(1.0-uv.y,0.0,1.0));
    vec2 scaled=g*(size-1.0);int column=int(min(floor(scaled.x),size.x-2.0)),row=int(min(floor(scaled.y),size.y-2.0)),columns=int(size.x);vec2 f=fract(scaled);
    int i00=row*columns+column,i10=i00+1,i01=i00+columns,i11=i01+1;
    vec2 top=mix(uGridPoints[i00],uGridPoints[i10],f.x),bottom=mix(uGridPoints[i01],uGridPoints[i11],f.x);return mix(top,bottom,f.y);
  }

  void main(){
    float screenAspect=uResolution.x/max(1.0,uResolution.y),mediaAspect=uMediaSize.x/max(1.0,uMediaSize.y);
    vec2 sampleUv=uSourceFrame.xy+aUv*uSourceFrame.zw;
    vec2 posUv=aUv;
    if(uFit<.5){if(screenAspect>mediaAspect)sampleUv.y=(sampleUv.y-.5)*(mediaAspect/screenAspect)+.5;else sampleUv.x=(sampleUv.x-.5)*(screenAspect/mediaAspect)+.5;}
    else if(uFit<1.5){if(screenAspect>mediaAspect)posUv.x=(posUv.x-.5)*(mediaAspect/screenAspect)+.5;else posUv.y=(posUv.y-.5)*(screenAspect/mediaAspect)+.5;}
    sampleUv.x=mix(sampleUv.x,1.0-sampleUv.x,uMirror.x);sampleUv.y=mix(sampleUv.y,1.0-sampleUv.y,uMirror.y);sampleUv=rotateUv(sampleUv,uRotation);
    vec4 source=media(clamp(sampleUv,0.0,1.0));
    float luma=dot(source.rgb,vec3(.2126,.7152,.0722));

    // Every particle is managed by the same coherent ambient force field.
    vec2 originalP=posUv-.5;originalP.x*=screenAspect;vec2 p=originalP;
    float edgeDistance=min(min(aUv.x,1.0-aUv.x),min(aUv.y,1.0-aUv.y));
    float eventWeight=smoothstep(0.0,max(.02,uEventEdgeFeather),edgeDistance);
    float weightedAmbientInfluence=mix(1.0,uEventAmbientInfluence,eventWeight);
    float ambientTime=uTime*max(.001,uAmbientSpeed);
    float globalNoise=noise(vec2(ambientTime*.12,4.17));
    float randomAngle=(globalNoise-.5)*6.283185*uAmbientRandomness;
    float randomMagnitude=mix(1.0,.35+1.3*noise(vec2(8.2,ambientTime*.09)),uAmbientRandomness);
    vec2 forceDirection=vec2(cos(uAmbientDirection+randomAngle),sin(uAmbientDirection+randomAngle));
    float phase=ambientTime;
    vec2 ambientField=vec2(sin(p.y*7.0+phase)+.45*sin((p.x+p.y)*12.0-phase*.63),-cos(p.x*6.0-phase)-.45*cos((p.y-p.x)*11.0+phase*.51));
    p+=ambientField*.075*uAmbientAmplitude*uAmbientRange*uAmbientEnabled*weightedAmbientInfluence;
    p+=forceDirection*sin(ambientTime*.72)*.22*uAmbientForce*randomMagnitude*uAmbientRange*uAmbientEnabled*weightedAmbientInfluence;
    vec2 field=vec2(sin(p.y*19.0+phase)+.55*sin((p.x+p.y)*31.0-phase*.7),-cos(p.x*17.0-phase)-.55*cos((p.y-p.x)*29.0+phase*.6));
    field*=.018*uWarp*(.35+luma);
    p+=field;

    float r=max(.001,length(p));
    float vortexAngle=uVortex*(1.15-r)*(.55+.45*sin(uTime*.31+aSeed*2.0));
    p=mat2(cos(vortexAngle),-sin(vortexAngle),sin(vortexAngle),cos(vortexAngle))*p;
    float eventR=max(.001,length(p));vec2 eventDir=p/eventR;
    p+=eventDir*uEventRadialForce*(.12+.12*(1.0-clamp(eventR,0.0,1.0)))*eventWeight;
    float eventSpin=uEventSwirl*(1.15-clamp(eventR,0.0,1.0))*(.7+.3*sin(uTime*.45))*eventWeight;p=mat2(cos(eventSpin),-sin(eventSpin),sin(eventSpin),cos(eventSpin))*p;
    float holePush=smoothstep(0.0,max(.001,uEventCenterHole),uEventCenterHole-eventR)*uEventCenterHole;p+=eventDir*holePush*eventWeight;
    vec2 eventNoise=vec2(noise(aUv*17.0+uTime*.7+aSeed),noise(aUv.yx*19.0-uTime*.61+aSeed))-.5;
    p+=eventNoise*.28*max(0.0,uEventRandomForce)*eventWeight;p=mix(p,originalP,max(0.0,uEventOriginReturn)*.88*eventWeight);p.y-=uEventVerticalFall*(.18+.42*aSeed)*eventWeight;
    p.y+=sin(p.x*16.0-uTime*.8+aSeed*3.0)*.045*uTide;
    p.x+=sin(p.y*21.0+uTime*.55)*.018*uTide;

    vec2 burst=vec2(hash21(aUv*997.0+aSeed),hash21(aUv.yx*733.0-aSeed))-.5;
    float bands=.35+.65*sin(aUv.y*85.0+aSeed*4.0+uTime*.25);
    p+=burst*uDisperse*(.12+.22*bands);
    p=p*mix(1.0,uEventRadius,eventWeight)+burst*uEventSpread*eventWeight;
    p.x/=screenAspect;posUv=p+.5;
    float blockGrid=mix(96.0,18.0,uBlocks);
    vec2 blockUv=(floor(posUv*blockGrid)+.5)/blockGrid;
    posUv=mix(posUv,blockUv,uBlocks*.82);

    vec2 mapped=mappedUv(posUv);
    vec2 ndc=vec2(mapped.x*2.0-1.0,mapped.y*2.0-1.0);
    gl_Position=vec4(ndc,0.0,1.0);
    float pointScale=clamp(uResolution.y/1080.0,.8,2.0);
    float sparkle=pow(luma,2.0)*uLightPath;
    gl_PointSize=(1.1+1.15*luma+1.8*sparkle+uBlocks*1.4)*pointScale*uPointSize;
    // Media remains visible as the ambient appearance. Cue values only deform
    // the field. With no media loaded, the same moving point grid stays black.
    float spatialGlow=uEventGlow*(.4+.6*(1.0-clamp(length(p)*1.3,0.0,1.0)));float flicker=1.0+uEventFlicker*(.38*sin(uTime*5.2)+.22*sin(uTime*11.7+aSeed*9.0));
    float combinedBrightness=max(0.0,uBaseBrightness+(uEventBrightness-1.0));
    vColor=mix(vec3(0.0),source.rgb,uHasMedia)*uBrightness*combinedBrightness*flicker*(1.0+spatialGlow)*(1.0-uBlackout);
    float retained=1.0-smoothstep(uEventVisibility-.015,uEventVisibility+.015,aSeed*.97+.015);
    if(uEventVisibility>=.999)retained=1.0;
    if(uEventVisibility<=.001)retained=0.0;
    vAlpha=mix(.65,.12+.72*luma,uHasMedia)*uEventOpacity*retained*(1.0-uBlackout);
    vSpark=sparkle;
  }
`;

const particleFragmentShader = /* glsl */`
  precision highp float;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vSpark;
  void main(){
    vec2 p=gl_PointCoord-.5;
    // Narrow luminous fibre with a softer halo.
    float core=1.0-smoothstep(.08,.24,abs(p.x));
    float lengthMask=1.0-smoothstep(.32,.5,abs(p.y));
    float halo=1.0-smoothstep(.18,.5,length(p));
    float alpha=(core*lengthMask+halo*(.14+.36*vSpark))*vAlpha;
    if(alpha<.012)discard;
    gl_FragColor=vec4(vColor*(1.15+vSpark*2.5),alpha);
  }
`;

export function createGridUniformPoints(points:[number,number][]) { return Array.from({length:25},(_,index)=>{const point=points[index];return new THREE.Vector2(point?.[0]??0,1-(point?.[1]??0));}); }

export class ParticleField {
  readonly points: THREE.Points;
  private geometry = new THREE.BufferGeometry();
  private material: THREE.ShaderMaterial;
  private gridSignature='';

  constructor(columns = 640, rows = 360) {
    const count=columns*rows;
    const positions=new Float32Array(count*3),uvs=new Float32Array(count*2),seeds=new Float32Array(count);
    for(let y=0,index=0;y<rows;y++)for(let x=0;x<columns;x++,index++){
      const jitterX=(Math.random()-.5)/columns*.75,jitterY=(Math.random()-.5)/rows*.75;
      uvs[index*2]=(x+.5)/columns+jitterX;uvs[index*2+1]=(y+.5)/rows+jitterY;seeds[index]=Math.random();
    }
    this.geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    this.geometry.setAttribute('aUv',new THREE.BufferAttribute(uvs,2));
    this.geometry.setAttribute('aSeed',new THREE.BufferAttribute(seeds,1));
    this.material=new THREE.ShaderMaterial({vertexShader:particleVertexShader,fragmentShader:particleFragmentShader,transparent:true,depthTest:false,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{
      uMediaA:{value:null},uMediaB:{value:null},uTransition:{value:0},uTime:{value:0},uHasMedia:{value:0},uBrightness:{value:1},uBlackout:{value:0},uResolution:{value:new THREE.Vector2(1,1)},uMediaSize:{value:new THREE.Vector2(1,1)},uFit:{value:0},uRotation:{value:0},uMirror:{value:new THREE.Vector2()},
      uTopLeft:{value:new THREE.Vector2(0,1)},uTopRight:{value:new THREE.Vector2(1,1)},uBottomRight:{value:new THREE.Vector2(1,0)},uBottomLeft:{value:new THREE.Vector2(0,0)},
      uGridEnabled:{value:0},uGridSize:{value:new THREE.Vector2(3,3)},uGridPoints:{value:Array.from({length:25},()=>new THREE.Vector2())},
      uAmbientEnabled:{value:1},uAmbientAmplitude:{value:.32},uAmbientSpeed:{value:.34},uAmbientRandomness:{value:.18},uAmbientForce:{value:.22},uAmbientDirection:{value:0},uAmbientRange:{value:.65},
      uPointSize:{value:1.15},uBaseBrightness:{value:1},uEventEdgeFeather:{value:.2},uSourceFrame:{value:new THREE.Vector4(0,0,1,1)},uEventRadius:{value:1},uEventSpread:{value:0},uEventBrightness:{value:1},uEventOpacity:{value:1},uEventVisibility:{value:1},uEventRadialForce:{value:0},uEventSwirl:{value:0},uEventCenterHole:{value:0},uEventRandomForce:{value:0},uEventVerticalFall:{value:0},uEventGlow:{value:0},uEventFlicker:{value:0},uEventOriginReturn:{value:0},uEventAmbientInfluence:{value:1},
      ...Object.fromEntries(['Disperse','Blocks','Warp','Vortex','LightPath','Tide'].map(id=>[`u${id}`,{value:0}]))
    }});
    this.points=new THREE.Points(this.geometry,this.material);this.points.frustumCulled=false;this.points.renderOrder=2;
  }

  apply(snapshot:OutputSnapshot,hasMedia:boolean){const e=snapshot.particleEvent!;for(const key of Object.keys(e) as (keyof typeof e)[])this.material.uniforms[`uEvent${key[0].toUpperCase()}${key.slice(1)}`].value=e[key];const p=snapshot.project,a=p.ambient,m=p.mapping,q=p.quantum;this.material.uniforms.uSourceFrame.value.set(m.sourceFrame.x,m.sourceFrame.y,m.sourceFrame.width,m.sourceFrame.height);this.material.uniforms.uHasMedia.value=hasMedia?1:0;this.material.uniforms.uBrightness.value=m.brightness;this.material.uniforms.uBlackout.value=m.blackout?1:0;this.material.uniforms.uFit.value=['fill','fit','stretch'].indexOf(m.fit);this.material.uniforms.uRotation.value=m.rotation/90;this.material.uniforms.uMirror.value.set(m.mirrorX?1:0,m.mirrorY?1:0);this.material.uniforms.uAmbientEnabled.value=a.enabled?1:0;this.material.uniforms.uAmbientAmplitude.value=a.amplitude;this.material.uniforms.uAmbientSpeed.value=a.speed;this.material.uniforms.uAmbientRandomness.value=a.randomness;this.material.uniforms.uAmbientForce.value=a.force;this.material.uniforms.uAmbientDirection.value=a.direction*Math.PI/180;this.material.uniforms.uAmbientRange.value=a.movementRange;this.material.uniforms.uPointSize.value=q.pointSize;this.material.uniforms.uBaseBrightness.value=q.brightness;this.material.uniforms.uEventEdgeFeather.value=q.edgeFeather;this.setQuad(m.quad);this.material.uniforms.uGridEnabled.value=m.controlMode==='grid'?1:0;const signature=`${m.grid.columns}:${m.grid.rows}:${m.grid.points.flat().join(',')}`;if(signature!==this.gridSignature){this.gridSignature=signature;this.material.uniforms.uGridSize.value.set(m.grid.columns,m.grid.rows);this.material.uniforms.uGridPoints.value=createGridUniformPoints(m.grid.points);}for(const [id,value]of Object.entries(snapshot.effectValues)as[EffectId,number][]){const applied=p.effects[id].enabled?value*p.effects[id].intensity:0;this.material.uniforms[`u${id[0].toUpperCase()}${id.slice(1)}`].value=applied;}}
  update(now:number,media:MediaManager,width:number,height:number){this.material.uniforms.uTime.value=now*.001;this.material.uniforms.uMediaA.value=media.textureA;this.material.uniforms.uMediaB.value=media.textureB;this.material.uniforms.uTransition.value=media.transition;this.material.uniforms.uMediaSize.value.set(...media.size);this.material.uniforms.uResolution.value.set(width,height);}
  dispose(){this.geometry.dispose();this.material.dispose();}
  private setQuad(q:MappingQuad){this.material.uniforms.uTopLeft.value.set(q.topLeft[0],1-q.topLeft[1]);this.material.uniforms.uTopRight.value.set(q.topRight[0],1-q.topRight[1]);this.material.uniforms.uBottomRight.value.set(q.bottomRight[0],1-q.bottomRight[1]);this.material.uniforms.uBottomLeft.value.set(q.bottomLeft[0],1-q.bottomLeft[1]);}
}
