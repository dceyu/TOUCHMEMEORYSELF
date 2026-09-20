import { EventEmitter } from 'node:events';
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import { parseSensorFrame } from '../src/shared/protocol';
import type { SensorFrame, SerialPortInfo } from '../src/shared/types';
import { TouchSession } from './touch-session';

export class SerialService extends EventEmitter {
  private touch = new TouchSession(line=>{
    if(!this.port?.isOpen)throw new Error('Serial port disconnected');
    this.sendCommand(line);
  });
  private commandTimer?:ReturnType<typeof setTimeout>;
  private commands:string[]=[];
  private sending=false;
  // Uno's receive buffer is only 64 bytes. Pace chunks while telemetry is sent.
  private sendCommand(line:string){
    if(this.commands.length>=4)throw new Error('Touch command queue busy');
    this.commands.push(line);if(this.sending)return;
    this.sending=true;const port=this.port;
    const pump=()=>{
      if(!port?.isOpen||port!==this.port){this.commands=[];this.sending=false;return;}
      const command=this.commands[0];if(!command){this.sending=false;return;}
      const chunk=command.slice(0,24);this.commands[0]=command.slice(24);
      port.write(chunk,error=>{if(port!==this.port)return;if(error){this.commands=[];this.sending=false;this.touch.disconnect();this.emit('status',{connected:false,error:error.message});return;}
        if(!this.commands[0])this.commands.shift();
        this.commandTimer=setTimeout(pump,40);
      });
    };pump();
  }
  configureTouch(value:unknown){this.touch.configure(value);}
  calibrateTouch(){return this.touch.calibrate();}
  private port?: SerialPort;
  private reconnectTimer?: NodeJS.Timeout;
  private reconnectPath?: string;
  private intentionalClose = false;
  private lastFrameAt = 0;

  async list(): Promise<SerialPortInfo[]> {
    return (await SerialPort.list()).map(port => ({ path: port.path, manufacturer: port.manufacturer, serialNumber: port.serialNumber }));
  }

  async connect(path: string): Promise<void> {
    await this.disconnect();
    this.intentionalClose = false;
    this.reconnectPath = path;
    await new Promise<void>((resolve, reject) => {
      const port = new SerialPort({ path, baudRate: 115200, autoOpen: false });
      this.port = port;
      port.open(error => error ? reject(error) : resolve());
      port.once('open', () => this.emit('status', { connected: true, path }));
      port.on('error', error => this.emit('status', { connected: false, path, error: error.message }));
      port.on('close', () => {
        this.touch.disconnect();
        this.emit('status', { connected: false, path });
        if (!this.intentionalClose) this.scheduleReconnect();
      });
      const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));
      parser.on('data', (line: string) => {
        if(this.touch.response(line.trim()))return;
        const frame = parseSensorFrame(line.trim());
        if (!frame) return this.emit('protocol-error', line.slice(0, 180));
        this.lastFrameAt = Date.now();
        this.emit('frame', this.touch.frame(frame) satisfies SensorFrame);
      });
    });
  }

  async disconnect(): Promise<void> {
    if(this.commandTimer)clearTimeout(this.commandTimer);this.commands=[];this.sending=false;
    this.touch.disconnect();
    this.intentionalClose = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    const port = this.port;
    this.port = undefined;
    if (port?.isOpen) await new Promise<void>(resolve => port.close(() => resolve()));
    this.emit('status', { connected: false });
  }

  getStatus() { return { connected: Boolean(this.port?.isOpen), path: this.reconnectPath, lastFrameAt: this.lastFrameAt }; }

  private scheduleReconnect() {
    if (!this.reconnectPath) return;
    this.reconnectTimer = setTimeout(() => this.connect(this.reconnectPath!).catch(() => this.scheduleReconnect()), 1500);
  }
}
