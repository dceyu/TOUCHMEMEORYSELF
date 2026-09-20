import { useEffect, useState } from 'react';
import { touchPins, type TouchConfig, type TouchTelemetry } from '../shared/touch';
import type { Language } from '../i18n';

export function TouchControls({config,telemetry,connected,busy,language,onChange,onCalibrate}:{config:TouchConfig;telemetry?:TouchTelemetry;connected:boolean;busy:boolean;language:Language;onChange:(c:TouchConfig)=>void;onCalibrate:()=>void}){
  const t=(zh:string,en:string)=>language==='zh'?zh:en;
  const [received,setReceived]=useState(0),[now,setNow]=useState(Date.now());
  useEffect(()=>{setReceived(Date.now());},[telemetry]);
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),250);return()=>clearInterval(timer);},[]);
  const fresh=connected&&!!telemetry&&now-received<750;
  return <fieldset disabled={busy} style={{border:'1px solid #63704e',padding:12,marginBottom:12}}>
    <legend>{t('电容触摸 · 教授接线方案','CAPACITIVE TOUCH · PROFESSOR PIN PAIRS')}</legend>
    <p role="status">{!connected?t('未连接','Disconnected'):!fresh?t('等待触摸固件数据；请确认已写入对应程序','Waiting for touch firmware; verify the installed sketch'):telemetry?.calibrating?t('校准中：请勿触摸任何区域','Calibrating: keep all electrodes untouched'):telemetry?.synced?t('配置已确认 · 输入就绪','Configuration acknowledged · inputs ready'):t('正在同步配置 · 暂停触发','Synchronizing configuration · triggers paused')}</p>
    <label>CH8 <select value={config.finalMode} onChange={e=>onChange({...config,finalMode:e.target.value as TouchConfig['finalMode']})}><option value="button">{t('实体结束按钮 · D12 ↔ GND','End button · D12 ↔ GND')}</option><option value="touch">{t('印刷触摸 · A4 → A5','Touch electrode · A4 → A5')}</option></select></label>
    <label>{t('电阻档位','RESISTOR PROFILE')} <select value={config.measurement.preset} onChange={e=>{const preset=e.target.value as TouchConfig['measurement']['preset'];const defaults={"1M":300,"4.7M":800,"10M":1600,custom:config.measurement.limit};onChange({...config,measurement:{...config.measurement,preset,limit:defaults[preset]}})}}><option value="1M">1 MΩ</option><option value="4.7M">4.7 MΩ</option><option value="10M">10 MΩ</option><option value="custom">{t('自定义','CUSTOM')}</option></select></label><label>{t('测量样本','SAMPLES')} <input type="number" min="1" max="12" value={config.measurement.samples} onChange={e=>onChange({...config,measurement:{...config.measurement,samples:Math.max(1,Math.min(12,+e.target.value))}})}/></label><label>{t('测量上限','MEASURE LIMIT')} <input type="number" min="50" max="4095" value={config.measurement.limit} onChange={e=>onChange({...config,measurement:{...config.measurement,preset:'custom',limit:Math.max(50,Math.min(4095,+e.target.value))}})}/></label>
    <button disabled={!fresh||!telemetry?.synced} onClick={onCalibrate}>{t('无人触摸校准 · 2 秒','CALIBRATE UNTOUCHED · 2 SEC')}</button>
    <p>{t('每组发送端与接收端之间接 1 MΩ 电阻，触摸电极接箭头右侧引脚。阈值是高于基准的计数差，不是电压。触发 ≥ 基准 + 触发差；释放 ≤ 基准 + 释放差。','Connect 1 MΩ between each pair; electrode connects to the right-hand pin. Thresholds are counts above baseline, not volts. Touch ≥ baseline + ON; release ≤ baseline + OFF.')}</p>
    <div style={{overflowX:'auto'}}><table style={{width:'100%',fontSize:12}}><thead><tr>{['CH / PINS',t('读数','RAW'),t('次数¹','COUNT¹'),t('基准','BASE'),t('触发差','ON Δ'),t('释放差','OFF Δ'),t('按下 ms','PRESS ms'),t('松手 ms','RELEASE ms')].map(label=><th key={label}>{label}</th>)}</tr></thead><tbody>
      {config.channels.map((c,i)=>{
        const button=i===7&&config.finalMode==='button';
        const change=(key:keyof typeof c,value:number)=>{
          if(!Number.isFinite(value))return;
          const next={...c,[key]:Math.round(value)};
          next.baseline=Math.max(0,Math.min(4094,next.baseline));next.on=Math.max(1,Math.min(4095-next.baseline,next.on));next.off=Math.max(0,Math.min(next.on-1,next.off));
          next.pressMs=Math.max(20,Math.min(2000,next.pressMs));next.releaseMs=Math.max(20,Math.min(2000,next.releaseMs));
          onChange({...config,channels:config.channels.map((v,j)=>i===j?next:v)});
        };
        return <tr key={i}><td>CH{i+1} · {button?'D12 / GND':touchPins[i]}</td><td style={{color:(telemetry?.raw[i]??0)>=config.measurement.limit?'#ff9955':undefined}}>{fresh?telemetry?.raw[i]:'—'}</td><td>{fresh?telemetry?.counts[i]:'—'}</td>{(['baseline','on','off','pressMs','releaseMs'] as const).map(key=><td key={key}><input aria-label={`CH${i+1} ${key}`} style={{width:60}} disabled={button&&['baseline','on','off'].includes(key)} type="number" min={key.endsWith('Ms')?20:0} max={key.endsWith('Ms')?2000:4095} value={c[key]} onChange={e=>change(key,+e.target.value)}/></td>)}</tr>;
      })}
    </tbody></table></div>
    <small>{t('¹ 开发板检测到的触摸次数，重启归零。读数达到当前测量上限表示饱和/断路。1 kΩ 无法通过软件灵敏度补偿。校准、修改设置及重连后，请松手再触摸。','¹ Board-detected touches since boot. Reaching the measurement limit means saturation/open circuit. Software cannot compensate for 1 kΩ. Release after calibration, configuration or reconnect.')}</small>
  </fieldset>;
}
