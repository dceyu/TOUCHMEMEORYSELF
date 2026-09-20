export const vertexShader = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

export const fragmentShader = /* glsl */`
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uMediaA;
  uniform sampler2D uMediaB;
  uniform float uHasMedia;
  uniform float uTransition;
  uniform float uTime;
  uniform float uBrightness;
  uniform float uBlackout;
  uniform vec2 uResolution;
  uniform vec2 uMediaSize;
  uniform float uFit;
  uniform float uRotation;
  uniform vec2 uMirror;
  uniform float uDisperse;
  uniform float uBlocks;
  uniform float uWarp;
  uniform float uVortex;
  uniform float uLightPath;
  uniform float uTide;

  float hash21(vec2 p) { p = fract(p * vec2(123.34, 345.45)); p += dot(p, p + 34.345); return fract(p.x * p.y); }
  float noise(vec2 p) {
    vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
    return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x),mix(hash21(i+vec2(0,1)),hash21(i+vec2(1,1)),f.x),f.y);
  }
  vec2 rotateUv(vec2 uv, float turns) {
    float a = turns * 1.5707963; vec2 p=uv-.5;
    return mat2(cos(a),-sin(a),sin(a),cos(a))*p+.5;
  }
  vec4 media(vec2 uv) {
    vec4 a=texture2D(uMediaA,uv), b=texture2D(uMediaB,uv);
    float dissolve=smoothstep(noise(uv*6.0+uTime*.08)-.14,noise(uv*6.0+uTime*.08)+.14,uTransition);
    return mix(a,b,clamp(dissolve,0.0,1.0));
  }
  void main() {
    vec2 uv=vUv;
    float screenAspect=uResolution.x/max(1.0,uResolution.y), mediaAspect=uMediaSize.x/max(1.0,uMediaSize.y);
    if(uFit<.5){if(screenAspect>mediaAspect)uv.y=(uv.y-.5)*(mediaAspect/screenAspect)+.5;else uv.x=(uv.x-.5)*(screenAspect/mediaAspect)+.5;}
    else if(uFit<1.5){if(screenAspect>mediaAspect)uv.x=(uv.x-.5)*(screenAspect/mediaAspect)+.5;else uv.y=(uv.y-.5)*(mediaAspect/screenAspect)+.5;if(any(lessThan(uv,vec2(0.0)))||any(greaterThan(uv,vec2(1.0)))){gl_FragColor=vec4(0,0,0,1);return;}}
    uv.x = mix(uv.x, 1.0-uv.x, uMirror.x); uv.y = mix(uv.y, 1.0-uv.y, uMirror.y);
    uv=rotateUv(uv,uRotation);
    vec2 p=uv-.5;
    float aspect=screenAspect;
    p.x*=aspect;
    float radius=max(.001,length(p));
    float angle=atan(p.y,p.x)+uVortex*(1.4-radius)*sin(uTime*.25);
    p=vec2(cos(angle),sin(angle))*radius;
    p.x/=aspect; uv=p+.5;
    float tide=sin(uv.y*15.0-uTime*1.4)+sin(uv.x*7.0+uTime*.72);
    uv.x += tide*.012*uTide; uv.y += sin(uv.x*11.0+uTime)*.008*uTide;
    vec2 flow=vec2(noise(uv*4.5+uTime*.1),noise(uv*4.5-uTime*.08+.7))-.5;
    uv += flow*.09*uWarp;
    float cells=mix(80.0,18.0,uBlocks);
    vec2 cell=floor(uv*cells)/cells;
    uv=mix(uv,cell+.5/cells,uBlocks*.8);
    vec2 particleCell=floor(uv*160.0);
    float particle=step(hash21(particleCell),1.0-uDisperse*.72);
    vec2 scatter=(vec2(hash21(particleCell),hash21(particleCell+9.1))-.5)*uDisperse*.18;
    vec4 color=media(uv+scatter);
    float line=pow(max(0.0,sin((uv.x+noise(uv*3.0))*42.0-uTime*2.0)),18.0);
    line+=pow(max(0.0,sin((uv.y-noise(uv*4.0))*31.0+uTime*1.3)),24.0);
    color.rgb += color.rgb*line*uLightPath*2.5;
    color.rgb *= mix(particle,1.0,1.0-uDisperse*.65);
    color.rgb=vec3(0.0);
    gl_FragColor=vec4(color.rgb,1.0);
  }
`;
