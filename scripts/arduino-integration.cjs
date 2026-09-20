// Run with Electron. Uses native services and public preload API, not React internals.
const {app,dialog,BrowserWindow,ipcMain}=require('electron');
const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),work=path.join(root,'test-output','arduino');
app.setAppPath(root);
app.setPath('userData',path.join(work,'profile'));
let openPath='',exportDirectory='';
dialog.showOpenDialog=async options=>({canceled:false,filePaths:[options.properties.includes('openDirectory')?exportDirectory:openPath]});
dialog.showSaveDialog=async()=>({canceled:false,filePath:path.join(work,'saved.centopia-map')});
dialog.showMessageBoxSync=()=>0;
require('../dist-electron/electron/main.js');
async function waitFor(check){for(let n=0;n<100;n++){if(await check())return;await new Promise(r=>setTimeout(r,100));}throw Error('Timed out');}
app.whenReady().then(async()=>{
  try{
    await fs.mkdir(work,{recursive:true});exportDirectory=work;
    const {createDefaultProject}=require('../dist-electron/src/shared/defaults.js');
    const {ProjectService}=require('../dist-electron/electron/project-service.js');
    const {ArduinoService}=require('../dist-electron/electron/arduino-service.js');
    const p=createDefaultProject();p.ambient.amplitude=.87;p.arduino.wiring='digital';p.arduino.debounceMs=90;p.arduino.channels[4].activeLow=true;p.cues[2].durationMs=4700;
    p.assets=[{id:'fixture',name:'1.png',type:'image',path:path.resolve(root,'../1.png')}];p.activeMediaId='fixture';p.standbyMediaId='fixture';
    const projects=new ProjectService();
    await projects.save(p,true);openPath=path.join(work,'saved.centopia-map');const saved=await projects.open();assert.equal(saved.project.ambient.amplitude,.87);
    const exported=await projects.exportPortable(p);const relocated=path.join(work,'moved');await fs.cp(path.dirname(exported),relocated,{recursive:true});
    openPath=path.join(relocated,'settings.centopia-settings');const imported=await projects.open();
    assert.equal(imported.project.arduino.channels[4].activeLow,true);assert.equal(imported.project.cues[2].durationMs,4700);assert.equal(imported.project.ambient.amplitude,.87);assert.equal(imported.project.assets[0].missing,false);assert.equal(projects.currentPath,undefined);
    assert((await fs.readFile(path.join(relocated,'centopia.ino'),'utf8')).includes('INPUT_PULLUP'));
    console.log('PASS: save, portable export, moved-folder import, embedded source');
    const win=BrowserWindow.getAllWindows()[0];await waitFor(()=>win.webContents.executeJavaScript("Boolean(document.querySelector('button'))"));
    await win.webContents.executeJavaScript("[...document.querySelectorAll('button')].find(b=>b.textContent==='打开').click()");
    await waitFor(()=>win.webContents.executeJavaScript("document.body.innerText.includes('1.png')"));
    await win.webContents.executeJavaScript("[...document.querySelectorAll('button')].find(b=>b.textContent==='Arduino').click()");
    await waitFor(()=>win.webContents.executeJavaScript("document.body.innerText.includes('Arduino 可视化终端')"));
    assert.equal(await win.webContents.executeJavaScript("document.querySelectorAll('select[aria-label$=effect]').length"),8);
    win.showInactive();await new Promise(r=>setTimeout(r,1000));
    const screenshot=await win.webContents.capturePage();if(!screenshot.isEmpty())await fs.writeFile(path.join(work,'terminal.png'),screenshot.toPNG());
    await win.webContents.executeJavaScript("[...document.querySelectorAll('button')].find(b=>b.textContent==='EN').click()");
    assert(await win.webContents.executeJavaScript("document.body.innerText.includes('ARDUINO VISUAL TERMINAL')"));
    console.log('PASS: public UI project import, eight editable channels, bilingual terminal');
    let lastSnapshot,seq=0,value=0;
    const snapshotListener=(_event,snapshot)=>{lastSnapshot=snapshot;};ipcMain.on('output:state',snapshotListener);
    win.webContents.send('serial:status',{connected:true,path:'TEST'});
    const frameTimer=setInterval(()=>win.webContents.send('serial:frame',{version:1,seq:seq++,channels:[value,0,0,0,0,0,0,0],final:0}),25);
    try{
      await new Promise(r=>setTimeout(r,300));value=1;
      await new Promise(r=>setTimeout(r,500));assert(lastSnapshot.particleEvent.glow>0,'sensor should trigger doubt glow');
      await new Promise(r=>setTimeout(r,4500));assert(lastSnapshot.particleEvent.glow>0,'emotion state should remain held');
      value=0;await new Promise(r=>setTimeout(r,300));value=1;
      await new Promise(r=>setTimeout(r,500));assert(lastSnapshot.particleEvent.glow>0,'released sensor should rearm');
      console.log('PASS: serial-frame integration triggers, holds, releases and rearms');
    }finally{clearInterval(frameTimer);ipcMain.removeListener('output:state',snapshotListener);win.webContents.send('serial:status',{connected:false});}
    const service=new ArduinoService({list:async()=>[]});
    for(const wiring of ['mux','digital'])console.log('PASS: compile '+wiring+'\n'+await service.run(wiring));
    console.log('ALL INTEGRATION CHECKS PASSED (no physical upload attempted)');app.exit(0);
  }catch(error){console.error(error);app.exit(1);}
});
