import { calibratedConfig, touchCommand, touchConfigSchema, type TouchConfig } from '../src/shared/touch';
import type { SensorFrame } from '../src/shared/types';

// Only sends typed configuration/calibration commands after seeing matching firmware.
export class TouchSession {
  private config:TouchConfig|null=null;
  private revision=1;
  private lastSent=-Infinity;
  private lastTouch=-Infinity;
  private acknowledged=false;
  private sentConfig=false;
  private pending?:{id:number;resolve:(c:TouchConfig)=>void;reject:(e:Error)=>void;timer:ReturnType<typeof setTimeout>};
  constructor(private write:(line:string)=>void,private now=()=>Date.now()){}
  configure(value:unknown){
    const next=value===null?null:touchConfigSchema.parse(value);
    if(JSON.stringify(next)===JSON.stringify(this.config))return;
    if(this.pending)throw new Error('Calibration in progress / 正在校准');
    this.config=next;this.revision=this.revision%65535+1;this.lastSent=-Infinity;this.acknowledged=false;this.sentConfig=false;
  }
  disconnect(){
    this.revision=this.revision%65535+1;
    this.lastTouch=-Infinity;this.lastSent=-Infinity;this.acknowledged=false;this.sentConfig=false;
    if(this.pending){clearTimeout(this.pending.timer);this.pending.reject(new Error('Disconnected / 连接已断开'));this.pending=undefined;}
  }
  frame(frame:SensorFrame):SensorFrame {
    const touch=frame.touch;
    if(touch){
      this.lastTouch=this.now();
      // A freshly started desktop can reuse a numeric revision; force a new ACK.
      if(this.config&&!this.sentConfig&&touch.configId===this.revision)this.revision=this.revision%65535+1;
      this.acknowledged=!!this.config&&this.sentConfig&&touch.configId===this.revision&&!touch.calibrating&&!this.pending;
      if(this.config&&!this.pending&&this.now()-this.lastSent>=500){
        try{this.write(this.acknowledged?`PING ${this.revision}\n`:touchCommand(this.config,this.revision));this.sentConfig=true;}
        catch{this.sentConfig=false;this.acknowledged=false;}
        this.lastSent=this.now();
      }
      return {...frame,touch:{...touch,synced:this.acknowledged},channels:this.acknowledged?frame.channels:[0,0,0,0,0,0,0,0],final:0};
    }
    // A selected touch profile must never interpret a different board's pin values.
    return this.config?{...frame,channels:[0,0,0,0,0,0,0,0],final:0}:frame;
  }
  calibrate():Promise<TouchConfig>{
    if(!this.config||!this.acknowledged||this.now()-this.lastTouch>500||this.pending) return Promise.reject(new Error('Connect and synchronize touch firmware first / 请先连接并同步触摸固件'));
    return new Promise((resolve,reject)=>{
      const id=this.revision;
      const timer=setTimeout(()=>{this.pending=undefined;this.acknowledged=false;this.lastSent=-Infinity;reject(new Error('Calibration timed out / 校准超时'));},6000);
      this.pending={id,resolve,reject,timer};this.acknowledged=false;
      try{this.write(`CAL ${id}\n`);}catch(error){clearTimeout(timer);this.pending=undefined;reject(error);}
    });
  }
  response(line:string):boolean {
    let value;try{value=JSON.parse(line);}catch{return false;}
    if(!value||typeof value!=='object'||!('calibrated' in value))return false;
    if(!this.pending||value.calibrated!==this.pending.id)return true;
    const pending=this.pending;clearTimeout(pending.timer);this.pending=undefined;
    try{
      const next=calibratedConfig(this.config!,value.baseline);
      // New revision is mandatory even when all baselines remain unchanged.
      this.config=next;this.revision=this.revision%65535+1;this.lastSent=-Infinity;this.sentConfig=false;
      pending.resolve(next);
    }catch{pending.reject(new Error('Calibration saturated or invalid; check electrodes/resistors and retry / 校准数值过高或无效，请检查接线后重试'));}
    return true;
  }
}
