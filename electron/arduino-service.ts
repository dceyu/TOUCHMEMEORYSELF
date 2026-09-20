import { app, dialog } from 'electron';
import { execFile } from 'node:child_process';
import { mkdir, writeFile, cp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { firmwareSource, type ArduinoConfig } from '../src/shared/arduino';
import type { SerialService } from './serial-service';
import type { TouchConfig } from '../src/shared/touch';

export class ArduinoService {
  busy=false;
  constructor(private serial:SerialService){}
  private root(){return app.isPackaged?join(process.resourcesPath,'arduino'):join(app.getAppPath(),'resources/arduino');}
  async run(wiring:ArduinoConfig['wiring'],port?:string,touch?:TouchConfig):Promise<string>{
    if(this.busy)throw new Error('Arduino task already running');
    this.busy=true;
    try{
    const source=firmwareSource(wiring,touch);
    if(port && !(await this.serial.list()).some(p=>p.path===port))throw new Error('Select an available USB port');
    if(port){const answer=await dialog.showMessageBox({type:'warning',message:`Upload CENTOPIA firmware to ${port}? / 写入 Arduino 程序？`,detail:'Arduino Uno only. This replaces the program currently on this board. / 仅适用于 Uno，将替换此板上的原程序。',buttons:['Upload / 写入','Cancel / 取消'],defaultId:1,cancelId:1});if(answer.response!==0)return 'Cancelled / 已取消';}
      const root=this.root(),work=join(app.getPath('userData'),'arduino');
      await mkdir(work,{recursive:true});
      const data=join(work,'data');
      if(!existsSync(join(data,'.centopia-ready'))){await cp(join(root,'data'),data,{recursive:true});await writeFile(join(data,'.centopia-ready'),'2');}
      const config=join(work,'arduino-cli.yaml');
      await writeFile(config,JSON.stringify({directories:{data,downloads:join(work,'downloads'),user:join(work,'libraries')}}));
      const sketch=join(work,'centopia');await mkdir(sketch,{recursive:true});
      await writeFile(join(sketch,'centopia.ino'),source);
      const execute=(args:string[])=>new Promise<string>((resolve,reject)=>execFile(join(root,'cli','arduino-cli.exe'),[...args,'--config-file',config],{windowsHide:true,timeout:180000,maxBuffer:4*1024*1024},(error,stdout,stderr)=>error?reject(new Error(`${stdout}\n${stderr}\n${error.message}`)):resolve(stdout+'\n'+stderr)));
      let log=await execute(['compile','--fqbn','arduino:avr:uno',sketch]);
      if(port){
        await this.serial.disconnect();
        try{log+=await execute(['upload','--fqbn','arduino:avr:uno','--port',port,sketch]);}
        catch(error){throw new Error(`Upload failed; reconnect manually. / 写入失败，请手动重连。\n${error}`);}
        await this.serial.connect(port);log+='\nUploaded and connected / 已写入并连接';
      }
      return log;
    }finally{this.busy=false;}
  }
}
