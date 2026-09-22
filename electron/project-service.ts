import { app, dialog } from 'electron';
import { readFile, writeFile, mkdtemp, mkdir, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, extname, isAbsolute, relative, resolve, join } from 'node:path';
import type { MediaAsset, StudioProject } from '../src/shared/types';
import { firmwareSource, defaultArduino } from '../src/shared/arduino';
import { validateProject } from '../src/shared/validate-project';
import { createDefaultProject, defaultCues } from '../src/shared/defaults';

const supported = new Map([
  ['.jpg', 'image'], ['.jpeg', 'image'], ['.png', 'image'], ['.webp', 'image'],
  ['.mp4', 'video'], ['.webm', 'video']
] as const);

export class ProjectService {
  currentPath?: string;

  async open(): Promise<{ path: string; project: StudioProject } | null> {
    const result = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'CENTOPIA Mapping', extensions: ['centopia-map','centopia-settings'] }] });
    if (result.canceled || !result.filePaths[0]) return null;
    const path = result.filePaths[0];
    const loaded = JSON.parse(await readFile(path, 'utf8')) as Partial<StudioProject>;
    validateProject(loaded);
    const defaults=createDefaultProject();
    const loadedMapping=loaded.mapping as Partial<StudioProject['mapping']>|undefined;
    const loadedPlaylist=loaded.playlist as Partial<StudioProject['playlist']>|undefined;
    const loadedUi=loaded.ui as Partial<StudioProject['ui']>|undefined;
    const touchDefaults=defaultArduino().touch;
    const project={...defaults,...loaded,arduino:{...defaultArduino(),...loaded.arduino,touch:{...touchDefaults,...loaded.arduino?.touch,measurement:{...touchDefaults.measurement,...loaded.arduino?.touch?.measurement}}},cues:loaded.cues??defaults.cues,ambient:{...defaults.ambient,...loaded.ambient},quantum:{...defaults.quantum,...loaded.quantum},ui:{...defaults.ui,...loadedUi,layout:{...defaults.ui.layout,...loadedUi?.layout}},emotionSequence:{...defaults.emotionSequence,...loaded.emotionSequence,steps:loaded.emotionSequence?.steps??defaults.emotionSequence.steps},routing:{...defaults.routing,...loaded.routing},playlist:{...defaults.playlist,...loadedPlaylist,items:loadedPlaylist?.items??defaults.playlist.items},mapping:{...defaults.mapping,...loadedMapping,sourceFrame:{...defaults.mapping.sourceFrame,...loadedMapping?.sourceFrame},grid:{...defaults.mapping.grid,...loadedMapping?.grid}},serial:{...defaults.serial,...loaded.serial}} as StudioProject;
    // Migrate former eight-effect projects to seven events and a fixed CH8 end.
    project.cues=defaultCues().map((cue,i)=>({...cue,durationMs:loaded.cues?.[i]?.durationMs??cue.durationMs,transitionMs:loaded.cues?.[i]?.transitionMs??cue.transitionMs,intensity:Math.min(1,loaded.cues?.[i]?.intensity??1)}));
    project.serial.finalSource=7;
    project.routing.enabled=false;
    if (project.formatVersion !== 1) throw new Error('不支持的项目文件版本');
    project.assets = project.assets.map(asset => { const assetPath=isAbsolute(asset.path)?asset.path:resolve(dirname(path),asset.path); return {...asset,path:assetPath,missing:!existsSync(assetPath)}; });
    this.currentPath = extname(path)==='.centopia-settings'?undefined:path;
    return { path, project };
  }

  async save(project: StudioProject, forceDialog = false): Promise<string | null> {
    let path = this.currentPath;
    if (!path || forceDialog) {
      const result = await dialog.showSaveDialog({ defaultPath: `${project.name || 'Untitled'}.centopia-map`, filters: [{ name: 'CENTOPIA Mapping', extensions: ['centopia-map'] }] });
      if (result.canceled || !result.filePath) return null;
      path = result.filePath;
    }
    validateProject(project);
    const portable = { ...project, firmware:{version:3,source:firmwareSource(project.arduino.wiring,project.arduino.touch)}, assets: project.assets.map(asset => ({ ...asset, path: relative(dirname(path!), asset.path) })) };
    await writeFile(path, JSON.stringify(portable, null, 2), 'utf8');
    this.currentPath = path;
    return path;
  }

  async exportPortable(project:StudioProject):Promise<string|null>{
    validateProject(project);
    for(const asset of project.assets)if(!existsSync(asset.path))throw new Error('Missing media / 请先重新定位缺失素材: '+asset.name);
    const result=await dialog.showOpenDialog({title:'Export settings and media / 导出设置与素材',properties:['openDirectory','createDirectory']});
    if(result.canceled||!result.filePaths[0])return null;
    // A fresh folder prevents overwriting unrelated projects or media.
    const folder=await mkdtemp(join(result.filePaths[0],'CENTOPIA-'));
    await mkdir(join(folder,'media'));
    const assets:MediaAsset[]=[];
    for(const [i,asset] of project.assets.entries()){
      if(!existsSync(asset.path))throw new Error('Missing media / 素材缺失: '+asset.name);
      const path='media/'+i+extname(asset.path).toLowerCase();
      await copyFile(asset.path,join(folder,path));
      assets.push({...asset,path,missing:false});
    }
    const portable={...project,serial:{...project.serial,path:undefined},mapping:{...project.mapping,displayId:undefined},assets,firmware:{version:3,source:firmwareSource(project.arduino.wiring,project.arduino.touch)}};
    const path=join(folder,'settings.centopia-settings');
    await writeFile(join(folder,'centopia.ino'),portable.firmware.source,'utf8');
    if(project.arduino.wiring==='capacitive')await copyFile(join(app.getAppPath(),'firmware/professor-original/professor-original.ino'),join(folder,'professor-original.ino'));
    await writeFile(path,JSON.stringify(portable,null,2),'utf8');
    return path;
  }

  async importMedia(): Promise<{ accepted: MediaAsset[]; rejected: string[] }> {
    const result = await dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'], filters: [
      { name: 'Supported media', extensions: ['jpg', 'jpeg', 'png', 'webp', 'mp4', 'webm'] },
      { name: 'All files', extensions: ['*'] }
    ] });
    if (result.canceled) return { accepted: [], rejected: [] };
    const accepted: MediaAsset[] = [];
    const rejected: string[] = [];
    for (const path of result.filePaths) {
      const type = supported.get(extname(path).toLowerCase() as '.jpg');
      if (!type) rejected.push(path);
      else accepted.push({ id: `media-${Date.now()}-${accepted.length}`, name: path.split(/[\\/]/).pop()!, path, type });
    }
    return { accepted, rejected };
  }

  async locateMedia(asset: MediaAsset): Promise<string | null> {
    const result=await dialog.showOpenDialog({properties:['openFile'],filters:[{name:'Supported media',extensions:['jpg','jpeg','png','webp','mp4','webm']}]});
    return result.canceled?null:result.filePaths[0]??null;
  }
}
