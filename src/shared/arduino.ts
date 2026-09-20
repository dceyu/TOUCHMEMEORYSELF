import { defaultTouch, type TouchConfig } from './touch';
import { touchFirmware } from './touch-firmware';
export type ArduinoConfig = {
  wiring: 'mux' | 'digital' | 'capacitive';
  touch: TouchConfig;
  takeover: boolean;
  debounceMs: number;
  channels: { enabled: boolean; activeLow: boolean; threshold: number }[];
};
export const defaultArduino = (): ArduinoConfig => ({
  wiring: 'mux', touch: defaultTouch(), takeover: true, debounceMs: 60,
  channels: Array.from({length:8},()=>({enabled:true,activeLow:false,threshold:.55}))
});

// The source is part of the application and travels with exported settings.
export function firmwareSource(wiring: ArduinoConfig['wiring'], touch?:TouchConfig): string {
  if(wiring==='capacitive')return touchFirmware(touch);
  if(wiring!=='mux' && wiring!=='digital')throw new Error('Unsupported wiring');
  return `// CENTOPIA Uno firmware v2 — 115200 baud, 40 Hz
// ${wiring==='mux'?'4067: SIG=A0; S0..S3=D4..D7; CH1..8=C0..C7':'Switches: CH1..8=D3..D10; each switch connects its pin to GND'}
// Final: D2 to GND. Inputs only. Never connect external voltage above 5V.
const byte pins[8]={3,4,5,6,7,8,9,10};
unsigned long seq=0;
void setup(){
  Serial.begin(115200);
  pinMode(2,INPUT_PULLUP);
  ${wiring==='mux'?'for(byte p=4;p<=7;p++){pinMode(p,OUTPUT);digitalWrite(p,LOW);}':'for(byte i=0;i<8;i++)pinMode(pins[i],INPUT_PULLUP);'}
}
void loop(){
  Serial.print(F("{\\"version\\":1,\\"seq\\":"));Serial.print(seq++);
  Serial.print(F(",\\"channels\\":["));
  for(byte i=0;i<8;i++){
    if(i)Serial.print(',');
    ${wiring==='mux'?'for(byte b=0;b<4;b++)digitalWrite(4+b,(i>>b)&1);delayMicroseconds(80);analogRead(A0);Serial.print(analogRead(A0)/1023.0,3);':'Serial.print(digitalRead(pins[i])==LOW?1:0);'}
  }
  Serial.print(F("],\\"final\\":"));Serial.print(digitalRead(2)==LOW?1:0);Serial.println('}');
  delay(25);
}
`;
}

export class BinaryInputs {
  private stable = Array(8).fill(false) as boolean[];
  private candidate = Array(8).fill(false) as boolean[];
  private since = Array(8).fill(0) as number[];
  reset(){this.stable.fill(false);this.candidate.fill(false);this.since.fill(0);}
  update(values:number[],config:ArduinoConfig,now:number):boolean[]{
    return config.channels.map((channel,i)=>{
      let high=(values[i]??0)>=channel.threshold;
      if(channel.activeLow)high=!high;
      high=high&&channel.enabled&&config.takeover;
      if(high!==this.candidate[i]){this.candidate[i]=high;this.since[i]=now;}
      const previous=this.stable[i];
      if(now-this.since[i]>=config.debounceMs)this.stable[i]=high;
      return !previous&&this.stable[i];
    });
  }
}
