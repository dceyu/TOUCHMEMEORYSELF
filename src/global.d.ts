import type { DisplayInfo, OutputSnapshot, PerformanceInfo, SensorFrame, SerialPortInfo, StudioProject } from './shared/types';
declare global {
  interface Window {
    centopia: {
      arduino: { run(wiring:'mux'|'digital'|'capacitive',port?:string,touch?:import('./shared/touch').TouchConfig):Promise<string>;configureTouch(config:import('./shared/touch').TouchConfig|null):Promise<void>;calibrateTouch():Promise<import('./shared/touch').TouchConfig> };
      serial: { list(): Promise<SerialPortInfo[]>; connect(path: string): Promise<void>; disconnect(): Promise<void>; status(): Promise<{ connected: boolean }>; onFrame(callback: (frame: SensorFrame) => void): () => void; onStatus(callback: (status: { connected?: boolean; path?: string; error?: string }) => void): () => void };
      project: { exportPortable(project:StudioProject):Promise<string|null>; open(): Promise<{ path: string; project: StudioProject } | null>; save(project: StudioProject): Promise<string | null>; saveAs(project: StudioProject): Promise<string | null> };
      media: { import(): Promise<{ accepted: import('./shared/types').MediaAsset[]; rejected: string[] }>; locate(asset: import('./shared/types').MediaAsset): Promise<string|null>; toUrl(path: string): Promise<string> };
      output: { listDisplays(): Promise<DisplayInfo[]>; open(displayId?: number): Promise<void>; close(): Promise<void>; refresh(): Promise<boolean>; blackout(value: boolean): Promise<void>; publish(snapshot: OutputSnapshot): void; onState(callback: (snapshot: OutputSnapshot) => void): () => void; onStatus(callback:(status:{open:boolean;displayId?:number})=>void):()=>void };
      runtime: { triggerFinal(): void; resetFinal(): void; reportPerformance(info: PerformanceInfo): void; getPerformance(): Promise<PerformanceInfo>; onCommand(callback: (command: 'final' | 'reset') => void): () => void };
    };
  }
}
export {};
