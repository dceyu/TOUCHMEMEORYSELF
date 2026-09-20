import * as THREE from 'three';
import type { MediaAsset } from '../shared/types';

type Slot = { assetId?: string; element?: HTMLVideoElement | HTMLImageElement; texture: THREE.Texture };
const placeholder = () => {
  const data = new Uint8Array([8, 9, 8, 255]);
  const texture = new THREE.DataTexture(data, 1, 1); texture.needsUpdate = true; texture.colorSpace = THREE.SRGBColorSpace; return texture;
};

export class MediaManager {
  slots: [Slot, Slot] = [{ texture: placeholder() }, { texture: placeholder() }];
  active = 0;
  transition = 1;
  transitioning = false;
  private transitionStarted = 0;
  private duration = 1800;
  private loadingAssetId?: string;

  get textureA() { return this.slots[this.active].texture; }
  get textureB() { return this.slots[1 - this.active].texture; }
  get hasMedia() { return Boolean(this.slots[0].assetId || this.slots[1].assetId); }
  get size(): [number,number] { const element=this.slots[this.active].element; if(element instanceof HTMLVideoElement)return [element.videoWidth||1,element.videoHeight||1]; if(element instanceof HTMLImageElement)return [element.naturalWidth||1,element.naturalHeight||1]; return [1,1]; }

  async select(asset: MediaAsset, instant = false) {
    if (this.slots[this.active].assetId === asset.id || this.loadingAssetId === asset.id) return;
    this.loadingAssetId=asset.id;
    const target = instant ? this.active : 1 - this.active;
    this.disposeSlot(target);
    try { this.slots[target] = await this.load(asset); } finally { this.loadingAssetId=undefined; }
    if (instant) { this.transition = 0; return; }
    this.transition = 0; this.transitioning = true; this.transitionStarted = performance.now();
  }

  update(now: number) {
    if (!this.transitioning) return false;
    this.transition = Math.min(1, (now - this.transitionStarted) / this.duration);
    if (this.transition >= 1) { this.transitioning = false; this.active = 1 - this.active; this.transition = 0; return true; }
    return false;
  }

  clear() { if(!this.hasMedia)return;this.disposeSlot(0);this.disposeSlot(1);this.slots=[{texture:placeholder()},{texture:placeholder()}];this.active=0;this.transition=0;this.transitioning=false; }

  dispose() { this.disposeSlot(0); this.disposeSlot(1); }
  private disposeSlot(index: number) { const slot=this.slots[index]; slot.texture.dispose(); if (slot.element instanceof HTMLVideoElement) { slot.element.pause(); slot.element.removeAttribute('src'); slot.element.load(); } }

  private async load(asset: MediaAsset): Promise<Slot> {
    const url = await window.centopia.media.toUrl(asset.path);
    if (asset.type === 'video') {
      const video=document.createElement('video'); video.src=url; video.loop=true; video.muted=true; video.playsInline=true; video.preload='auto';
      await new Promise<void>((resolve,reject)=>{ video.oncanplay=()=>resolve(); video.onerror=()=>reject(new Error(`无法解码 ${asset.name}`)); });
      await video.play(); const texture=new THREE.VideoTexture(video); texture.colorSpace=THREE.SRGBColorSpace; texture.minFilter=THREE.LinearFilter; return { assetId: asset.id, element: video, texture };
    }
    const image=await this.loadImage(url,asset.name); const texture=new THREE.Texture(image); texture.needsUpdate=true; texture.colorSpace=THREE.SRGBColorSpace; return { assetId: asset.id, element:image, texture };
  }

  private async loadImage(url: string, name: string) {
    const attempt = (source: string) => new Promise<HTMLImageElement>((resolve,reject) => {
      const image=new Image();
      image.onload=()=>resolve(image);
      image.onerror=()=>reject(new Error(`无法解码 ${name}`));
      image.src=source;
    });
    try { return await attempt(url); }
    catch { return attempt(`${url}?retry=${Date.now()}`); }
  }
}
