// Native UI / portable project test. Simulated frames only; never opens a USB port.
const {app,dialog,BrowserWindow,ipcMain}=require('electron');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),work=path.join(root,'test-output/touch-ui');
app.setAppPath(root);app.setPath('userData',path.join(work,'profile'));
let openPath='';
dialog.showOpenDialog=async o=>({canceled:false,filePaths:[o.properties.includes('openDirectory')?work:openPath]});
dialog.showSaveDialog=async()=>({canceled:false,filePath:path.join(work,'saved.centopia-map')});
dialog.showMessageBoxSync=()=>0;
require('../dist-electron/electron/main.js');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
app.whenReady().then(async()=>{try{
  await fs.mkdir(work,{recursive:true});
  const {createDefaultProject}=require('../dist-electron/src/shared/defaults');
  const {ProjectService}=require('../dist-electron/electron/project-service');
  const p=createDefaultProject();p.arduino.wiring='capacitive';p.arduino.touch.channels[2].baseline=7;p.ambient.amplitude=.79;p.cues.forEach(c=>c.durationMs=900);
  p.assets=[{id:'fixture',name:'1.png',type:'image',path:path.resolve(root,'../1.png')}];p.activeMediaId=p.standbyMediaId='fixture';
  const projects=new ProjectService();await projects.save(p,true);openPath=path.join(work,'saved.centopia-map');
  assert.deepEqual((await projects.open()).project.arduino.touch,p.arduino.touch);
  const exported=await projects.exportPortable(p),relocated=path.join(work,'relocated-'+Date.now());await fs.cp(path.dirname(exported),relocated,{recursive:true});
  openPath=path.join(relocated,'settings.centopia-settings');const loaded=await projects.open();
  assert.deepEqual(loaded.project.arduino.touch,p.arduino.touch);assert.equal(loaded.project.ambient.amplitude,.79);assert.equal(loaded.project.assets[0].missing,false);
  assert((await fs.readFile(path.join(relocated,'centopia.ino'),'utf8')).includes('Serial.begin(115200)'));
  assert((await fs.readFile(path.join(relocated,'professor-original.ino'),'utf8')).includes('Serial.begin(9600)'));
  console.log('PASS portable settings, calibrated values, ambient, media and both source versions');
  const win=BrowserWindow.getAllWindows()[0],js=code=>win.webContents.executeJavaScript(code);
  for(let i=0;i<100;i++){if(await js("!!document.querySelector('button')"))break;await sleep(100);}
  await js("[...document.querySelectorAll('button')].find(b=>b.textContent==='打开').click()");await sleep(700);
  assert(await js("document.body.innerText.includes('电容触摸 · 教授接线方案')"));
  assert.equal(await js("document.querySelector('input[aria-label=\"CH3 baseline\"]').value"),'7');
  let snapshot;ipcMain.on('output:state',(_e,s)=>snapshot=s);
  let seq=0,high=0,end=0,synced=false;
  win.webContents.send('serial:status',{connected:true,path:'SIMULATED TOUCH'});
  const timer=setInterval(()=>win.webContents.send('serial:frame',{version:1,seq:seq++,channels:[high,0,0,0,0,0,0,end],final:0,touch:{firmware:'touch-1',configId:4,calibrating:false,synced,raw:[high?10:1,1,7,1,1,1,1,end],counts:[high,0,0,0,0,0,0,end]}}),25);
  try{
    high=1;await sleep(350);assert.equal(snapshot.particleEvent.glow,0,'unacknowledged inputs must not trigger');
    high=0;synced=true;await sleep(150);high=1;await sleep(400);assert(snapshot.particleEvent.glow>0);
    await sleep(1100);assert(snapshot.particleEvent.glow>0,'held emotion must remain active');
    high=0;await sleep(150);high=1;await sleep(400);assert(snapshot.particleEvent.glow>0,'release/re-touch re-arms');
    win.showInactive();await sleep(300);await fs.writeFile(path.join(work,'touch-zh.png'),(await win.webContents.capturePage()).toPNG());
    await js("[...document.querySelectorAll('button')].find(b=>b.textContent==='EN').click()");await sleep(150);
    assert(await js("document.body.innerText.includes('Configuration acknowledged')"));
    assert(await js("document.documentElement.scrollWidth<=window.innerWidth"),'page must not overflow horizontally');
    await js("document.querySelector('fieldset').scrollIntoView({block:'start'})");await sleep(150);
    await fs.writeFile(path.join(work,'touch-en.png'),(await win.webContents.capturePage()).toPNG());
    end=1;await sleep(1200);assert.equal(snapshot.particleEvent.opacity,0);
    console.log('PASS bilingual touch UI, config gating, emotion hold/release, CH8 dark hold');
  }finally{clearInterval(timer);win.webContents.send('serial:status',{connected:false});}
  console.log('ALL TOUCH INTEGRATION CHECKS PASSED');app.exit(0);
}catch(error){console.error(error);app.exit(1);}});
