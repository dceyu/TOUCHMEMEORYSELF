import { useRef, useState } from 'react';
import { TouchControls } from './TouchControls';
import { touchPins, type TouchTelemetry } from '../shared/touch';
import type { StudioProject, SerialPortInfo, CueKind } from '../shared/types';
import { firmwareSource } from '../shared/arduino';
import { cueLabel, text } from '../i18n';

export function ArduinoTerminal({project,channels,connected,ports,touchTelemetry,activeEmotion,emotionRemaining,onProject,onRefresh,onConnect,onTrigger,onExport,onImport}:{project:StudioProject;channels:number[];connected:boolean;ports:SerialPortInfo[];touchTelemetry?:TouchTelemetry;activeEmotion?:number;emotionRemaining:number;onProject:(p:StudioProject)=>void;onRefresh:()=>void;onConnect:(port:string)=>void;onTrigger:(i:number)=>void;onExport:()=>void;onImport:()=>void}){
  const [port,setPort]=useState(project.serial.path??'');
  const [busy,setBusy]=useState(false),[log,setLog]=useState(''),[showCode,setShowCode]=useState(false);
  const a=project.arduino,t=(zh:string,en:string)=>text(project.ui.language,zh,en);
  const latest=useRef(project);latest.current=project;
  async function calibrate(){if(!window.confirm(t('请移开所有触摸区域上的手和物体。开始 2 秒校准？','Remove hands and objects from all electrodes. Start 2-second calibration?')))return;setBusy(true);try{const touch=await window.centopia.arduino.calibrateTouch();const p=latest.current;onProject({...p,arduino:{...p.arduino,touch}});setLog(t('校准完成。请保存项目或导出设置。','Calibration complete. Save the project or export settings.'));}catch(error){setLog(String(error));}finally{setBusy(false);}}
  const kinds:CueKind[]=['doubt','explore','desire','confidence','conflict','void','acceptance','finalDissolve'];
  const patch=(value:Partial<typeof a>)=>onProject({...project,arduino:{...a,...value}});
  async function run(upload:boolean){setBusy(true);setLog(t('正在编译，请稍候…','Compiling…'));try{setLog(await window.centopia.arduino.run(a.wiring,upload?port:undefined,a.touch));}catch(error){setLog(String(error));}finally{setBusy(false);onRefresh();}}
  return <div className="mapping-tools" style={{overflow:'auto'}}>
    <h2>{t('Arduino 可视化终端','ARDUINO VISUAL TERMINAL')}</h2>
    <p>{t('CH1–CH7：触发对应情绪状态并保持；倒计时结束后可自动进入下一状态。CH8：光芒消散后保持暗场；点击顶部「恢复播放」重新开始。长按不重复触发。','CH1–CH7: trigger and hold an emotion state; the sequence can advance after its countdown. CH8 dissolves light and holds dark; use Resume to restart. Held signals do not repeat.')}</p>
    <fieldset className="emotion-sequence"><legend>{t('情绪序列','EMOTION SEQUENCE')}</legend><div className="output-controls"><label><input type="checkbox" checked={project.emotionSequence.autoPlay} onChange={e=>onProject({...project,emotionSequence:{...project.emotionSequence,autoPlay:e.target.checked}})}/>{t('自动播放下一个','AUTO ADVANCE')}</label><label>{t('全局延迟 秒','GLOBAL DELAY SEC')} <input type="number" min="1" max="300" step="1" value={project.emotionSequence.globalDelayMs/1000} onChange={e=>onProject({...project,emotionSequence:{...project.emotionSequence,globalDelayMs:Math.max(1000,Math.min(300000,+e.target.value*1000))}})}/></label><strong>{activeEmotion===undefined?t('常态','AMBIENT'):`CH${activeEmotion+1} · ${cueLabel(project.cues[activeEmotion].kind,project.ui.language)}`}</strong><output>{activeEmotion===undefined?'—':`${(emotionRemaining/1000).toFixed(1)}s`}</output></div>
    <div className="sequence-grid">{project.emotionSequence.steps.map((step,i)=><div key={i}><b>CH{i+1} · {cueLabel(project.cues[i].kind,project.ui.language)}</b><label><input type="checkbox" checked={step.useGlobal} onChange={e=>onProject({...project,emotionSequence:{...project.emotionSequence,steps:project.emotionSequence.steps.map((s,j)=>j===i?{...s,useGlobal:e.target.checked}:s)}})}/>{t('使用全局','GLOBAL')}</label><input type="number" disabled={step.useGlobal} min="1" max="300" value={step.delayMs/1000} onChange={e=>onProject({...project,emotionSequence:{...project.emotionSequence,steps:project.emotionSequence.steps.map((s,j)=>j===i?{...s,delayMs:Math.max(1000,Math.min(300000,+e.target.value*1000))}:s)}})}/><span>→ {i===6?t('常态','AMBIENT'):`CH${step.next+1}`}</span></div>)}</div></fieldset>
    <div className="output-controls">
      <button onClick={onImport}>{t('导入设置 / 项目','IMPORT SETTINGS / PROJECT')}</button><button onClick={onExport}>{t('导出设置与素材','EXPORT SETTINGS + MEDIA')}</button>
      <select value={port} onChange={e=>setPort(e.target.value)}><option value="">USB PORT</option>{ports.map(p=><option key={p.path} value={p.path}>{p.path} {p.manufacturer}</option>)}</select>
      <button onClick={onRefresh}>{t('刷新端口','REFRESH PORTS')}</button><button disabled={!port||busy} onClick={()=>onConnect(port)}>{connected?t('断开','DISCONNECT'):t('连接接管','CONNECT')}</button>
      <button disabled={busy} onClick={()=>run(false)}>{t('验证程序','VERIFY FIRMWARE')}</button><button disabled={busy||!port} onClick={()=>run(true)}>{t('写入 Uno 并连接','UPLOAD TO UNO + CONNECT')}</button>
    </div>
    <p>{t('首次使用先写入程序，之后连接即可接管。写入会替换板上原程序；选择端口后会再次确认。','Upload firmware on first use; then connect to control effects. Upload replaces the board program and asks for confirmation for the selected port.')}</p>
    <div className="output-controls">
      <label>{t('接线方式','WIRING')} <select disabled={busy} value={a.wiring} onChange={e=>patch({wiring:e.target.value as typeof a.wiring})}><option value="mux">Uno + 4067 · C0–C7</option><option value="digital">Uno · D3–D10 · INPUT_PULLUP</option><option value="capacitive">{t('电容触摸 · 教授接线方案','Capacitive touch · professor pin pairs')}</option></select></label>
      <label><input type="checkbox" checked={a.takeover} onChange={e=>patch({takeover:e.target.checked})}/>{t('传感器接管','SENSOR CONTROL')}</label>
      {a.wiring!=='capacitive'&&<label>{t('防抖 ms','DEBOUNCE ms')} <input type="number" min="0" max="2000" value={a.debounceMs} onChange={e=>patch({debounceMs:Math.max(0,Math.min(2000,+e.target.value))})}/></label>}
    </div>
    <p>{a.wiring==='capacitive'?t('使用专用触摸固件，D2 已占用，不可连接旧版结束按钮。校准期间不触发效果。','Use touch firmware. D2 is occupied: do not attach the legacy Final button. Calibration suppresses triggers.'):(a.wiring==='mux'?'SIG → A0 · S0–S3 → D4–D7 · CH1–8 → C0–C7':'CH1–8 → D3–D10 · Switch to GND')+' · Final → D2 / GND.'} {t('切换固件类型后需确认接线并重新写入；触摸阈值和 CH8 选项可直接同步。','Check wiring and upload when switching firmware types; touch thresholds and CH8 selection synchronize without upload.')}</p>
    {a.wiring==='capacitive'&&<TouchControls config={a.touch} telemetry={touchTelemetry} connected={connected} busy={busy} language={project.ui.language} onChange={touch=>patch({touch})} onCalibrate={calibrate}/>}
    <div style={{display:'grid',gap:10}}>{a.channels.map((c,i)=>{
      const high=connected&&(a.wiring==='capacitive'?Boolean(touchTelemetry?.synced)&&channels[i]>=.5:(channels[i]>=c.threshold)!==c.activeLow);
      const change=(value:Partial<typeof c>)=>patch({channels:a.channels.map((old,j)=>j===i?{...old,...value}:old)});
      return <div key={i} style={{display:'grid',gridTemplateColumns:'1fr 24px 1fr 24px 1.4fr',alignItems:'center',gap:8,border:'1px solid #343d30',padding:12,borderRadius:8}}>
        <div><strong>CH {i+1} · {a.wiring==='capacitive'?(i===7&&a.touch.finalMode==='button'?'D12 / GND':touchPins[i]):a.wiring==='mux'?`C${i}`:`D${i+3}`}</strong><div style={{color:high?'#b7e774':'#858b85'}}>{high?t('● 有信号','● SIGNAL ON'):t('○ 无信号','○ SIGNAL OFF')}</div><label><input type="checkbox" checked={c.enabled} onChange={e=>change({enabled:e.target.checked})}/>{t('启用','ENABLED')}</label></div>
        <span>→</span><div>{a.wiring!=='capacitive'&&<label><input type="checkbox" checked={c.activeLow} onChange={e=>change({activeLow:e.target.checked})}/>{t('反向判断','INVERT')}</label>}{a.wiring==='mux'&&<label style={{display:'block'}}>{t('有信号阈值','SIGNAL THRESHOLD')}<input type="range" min=".05" max=".95" step=".01" value={c.threshold} onChange={e=>change({threshold:+e.target.value})}/>{c.threshold.toFixed(2)}</label>}<small>{a.wiring==='capacitive'?t('触摸确认 → 触发一次','Confirmed touch → one shot'):`${a.debounceMs} ms`}</small></div>
        <span>→</span><div><select disabled aria-label={`CH ${i+1} effect`} value={project.cues[i].kind} onChange={e=>onProject({...project,cues:project.cues.map((cue,j)=>j===i?{...cue,kind:e.target.value as CueKind,label:cueLabel(e.target.value as CueKind,project.ui.language)}:cue)})}>{kinds.map(kind=><option key={kind} value={kind}>{cueLabel(kind,project.ui.language)}</option>)}</select><button onClick={()=>onTrigger(i)}>{t('测试一次','TEST CUE')}</button><label>{t('时长 ms','DURATION ms')}<input type="number" min="300" max="10000" step="100" value={project.cues[i].durationMs} onChange={e=>onProject({...project,cues:project.cues.map((cue,j)=>j===i?{...cue,durationMs:Math.max(300,Math.min(10000,+e.target.value))}:cue)})}/></label><label>{t('缓进缓出 ms','CROSSFADE ms')}<input type="number" min="250" max="6000" step="100" value={project.cues[i].transitionMs} onChange={e=>onProject({...project,cues:project.cues.map((cue,j)=>j===i?{...cue,transitionMs:Math.max(250,Math.min(6000,+e.target.value))}:cue)})}/></label></div>
      </div>;
    })}</div>
    <button style={{marginTop:16}} onClick={()=>setShowCode(!showCode)}>{t('查看内置 Arduino 代码','VIEW EMBEDDED ARDUINO CODE')}</button>
    {showCode&&<pre style={{whiteSpace:'pre-wrap',maxHeight:320,overflow:'auto'}}>{firmwareSource(a.wiring,a.touch)}</pre>}
    {log&&<pre role="status" style={{whiteSpace:'pre-wrap',maxHeight:240,overflow:'auto'}}>{log}</pre>}
    <p>{t('导出会建立一个新文件夹，包含设置、Arduino 源码和素材。换电脑时复制整个文件夹，然后导入其中的 settings.centopia-settings；USB 端口和显示器需要重新选择。','Export creates a new folder with settings, Arduino source and media. Copy the entire folder to another computer and import settings.centopia-settings. Select the USB port and display again.')}</p>
  </div>;
}
