const {app,dialog,BrowserWindow,ipcMain}=require('electron');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),work=path.join(root,'test-output/events');
app.setAppPath(root);app.setPath('userData',path.join(work,'profile'));
dialog.showOpenDialog=async()=>({canceled:false,filePaths:[path.join(work,'events.centopia-map')]});
dialog.showMessageBoxSync=()=>0;
require('../dist-electron/electron/main.js');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
app.whenReady().then(async()=>{let frames;try{
  await fs.mkdir(work,{recursive:true});
  const {createDefaultProject}=require('../dist-electron/src/shared/defaults.js');
  const p=createDefaultProject();p.cues.forEach(c=>c.durationMs=350);p.emotionSequence.autoAdvance=false;
  p.assets=[{id:'fixture',name:'1.png',path:path.resolve(root,'../1.png'),type:'image'}];p.activeMediaId='fixture';p.standbyMediaId='fixture';
  await fs.writeFile(path.join(work,'events.centopia-map'),JSON.stringify(p));
  const win=BrowserWindow.getAllWindows()[0];win.showInactive();await sleep(1800);
  const js=code=>win.webContents.executeJavaScript(code);
  await js("[...document.querySelectorAll('button')].find(b=>b.textContent==='打开').click()");await sleep(1200);
  let snapshot;ipcMain.on('output:state',(_e,s)=>snapshot=s);
  await sleep(100);
  const capture=async name=>{const image=await win.webContents.capturePage();if(!image.isEmpty())await fs.writeFile(path.join(work,name+'.png'),image.toPNG());};
  await capture('ambient');
  for(let i=0;i<7;i++){
    await js(`[...document.querySelectorAll('button')].filter(b=>b.textContent==='TRIGGER')[${i}].click()`);
    await sleep(600);assert(snapshot.particleEvent,'event snapshot missing');
    assert.notDeepEqual(snapshot.particleEvent,{radius:1,spread:0,brightness:1,opacity:1,visibility:1,radialForce:0,swirl:0,centerHole:0,randomForce:0,verticalFall:0,glow:0,flicker:0,originReturn:0,ambientInfluence:1});
    assert(Object.values(snapshot.effectValues).every(v=>v===0),'legacy effects must stay disabled');
    await capture('event-'+(i+1));await sleep(500);
    assert.notDeepEqual(snapshot.particleEvent,{radius:1,spread:0,brightness:1,opacity:1,visibility:1,radialForce:0,swirl:0,centerHole:0,randomForce:0,verticalFall:0,glow:0,flicker:0,originReturn:0,ambientInfluence:1});
    console.log('PASS: CH'+(i+1)+' transitions and holds its emotion state');
  }
  // Exercise the actual eighth input, not just the screen button.
  win.webContents.send('serial:status',{connected:true,path:'TEST'});let seq=0;
  frames=setInterval(()=>{if(!win.isDestroyed()&&!win.webContents.isDestroyed())win.webContents.send('serial:frame',{version:1,seq:seq++,channels:[0,0,0,0,0,0,0,1],final:0});},25);
  await sleep(700);assert.equal(snapshot.particleEvent.opacity,0);await capture('ch8-dark');
  await js("[...document.querySelectorAll('button')].filter(b=>b.textContent==='TRIGGER')[0].click()");await sleep(200);assert.equal(snapshot.particleEvent.opacity,0);
  clearInterval(frames);frames=undefined;win.webContents.send('serial:status',{connected:false});
  await js("[...document.querySelectorAll('button')].find(b=>b.textContent==='恢复播放').click()");await sleep(300);assert.equal(snapshot.particleEvent.opacity,1);
  console.log('PASS: CH8 serial end, dark hold, explicit resume');
  assert(!await js("document.body.innerText.includes('GPU 渲染错误')"));
  app.exit(0);
}catch(e){console.error(e);app.exit(1);}finally{if(frames)clearInterval(frames);}});
