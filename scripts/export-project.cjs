// Usage with Electron:
// electron scripts/export-project.cjs <project.centopia-map> <export-parent> [replacement-media]
const {app,dialog}=require('electron');
const fs=require('node:fs/promises');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const source=path.resolve(process.argv[2]||'');
const destination=path.resolve(process.argv[3]||'');
const replacement=process.argv[4]?path.resolve(process.argv[4]):undefined;

if(!process.argv[2]||!process.argv[3])throw new Error('Project and export destination are required');
app.setAppPath(root);
dialog.showOpenDialog=async options=>({canceled:false,filePaths:[options.properties.includes('openDirectory')?destination:source]});

app.whenReady().then(async()=>{
  try{
    await fs.mkdir(destination,{recursive:true});
    const {ProjectService}=require('../dist-electron/electron/project-service.js');
    const service=new ProjectService();
    const opened=await service.open();
    if(!opened)throw new Error('Project was not opened');
    if(replacement&&opened.project.assets.length===1)opened.project.assets[0]={...opened.project.assets[0],path:replacement,missing:false};
    const settings=await service.exportPortable(opened.project);
    if(!settings)throw new Error('Export was cancelled');
    console.log(settings);
    app.exit(0);
  }catch(error){console.error(error);app.exit(1);}
});
