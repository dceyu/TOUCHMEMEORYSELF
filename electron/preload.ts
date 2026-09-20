import { contextBridge, ipcRenderer } from 'electron';
import type { OutputSnapshot, PerformanceInfo, SensorFrame, StudioProject } from '../src/shared/types';

const on = <T>(channel: string, callback: (value: T) => void) => {
  const listener = (_event: Electron.IpcRendererEvent, value: T) => callback(value);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};

contextBridge.exposeInMainWorld('centopia', {
  arduino: { run: (wiring: 'mux'|'digital'|'capacitive', port?:string, touch?:import('../src/shared/touch').TouchConfig) => ipcRenderer.invoke('arduino:run',wiring,port,touch), configureTouch:(config:import('../src/shared/touch').TouchConfig|null)=>ipcRenderer.invoke('arduino:touch-config',config), calibrateTouch:()=>ipcRenderer.invoke('arduino:touch-calibrate') },
  serial: {
    list: () => ipcRenderer.invoke('serial:list'),
    connect: (path: string) => ipcRenderer.invoke('serial:connect', path),
    disconnect: () => ipcRenderer.invoke('serial:disconnect'),
    status: () => ipcRenderer.invoke('serial:status'),
    onFrame: (callback: (frame: SensorFrame) => void) => on('serial:frame', callback),
    onStatus: (callback: (status: unknown) => void) => on('serial:status', callback)
  },
  project: {
    exportPortable: (project:StudioProject) => ipcRenderer.invoke('project:export',project),
    open: () => ipcRenderer.invoke('project:open'),
    save: (project: StudioProject) => ipcRenderer.invoke('project:save', project),
    saveAs: (project: StudioProject) => ipcRenderer.invoke('project:save-as', project)
  },
  media: {
    import: () => ipcRenderer.invoke('media:import'),
    locate: (asset: import('../src/shared/types').MediaAsset) => ipcRenderer.invoke('media:locate', asset),
    toUrl: (path: string) => ipcRenderer.invoke('media:url', path)
  },
  output: {
    listDisplays: () => ipcRenderer.invoke('output:list-displays'),
    open: (displayId?: number) => ipcRenderer.invoke('output:open', displayId),
    close: () => ipcRenderer.invoke('output:close'),
    refresh: () => ipcRenderer.invoke('output:refresh'),
    blackout: (value: boolean) => ipcRenderer.invoke('output:blackout', value),
    publish: (snapshot: OutputSnapshot) => ipcRenderer.send('output:state', snapshot),
    onState: (callback: (snapshot: OutputSnapshot) => void) => on('output:state', callback),
    onStatus: (callback: (status: {open:boolean;displayId?:number}) => void) => on('output:status', callback)
  },
  runtime: {
    triggerFinal: () => ipcRenderer.send('runtime:final'),
    resetFinal: () => ipcRenderer.send('runtime:reset'),
    reportPerformance: (info: PerformanceInfo) => ipcRenderer.send('runtime:performance', info),
    getPerformance: () => ipcRenderer.invoke('runtime:get-performance'),
    onCommand: (callback: (command: 'final' | 'reset') => void) => on('runtime:command', callback)
  }
});
