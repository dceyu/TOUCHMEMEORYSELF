// CENTOPIA capacitive touch v1 / Uno R3 ATmega328P / 115200 baud
// Professor pin pairs: 2->3,4->5,6->7,8->9,10->11,A0->A1,A2->A3.
// Each pair: send -- high-value resistor -- receive -- touch electrode.
// CH8: D12 to GND button (default), OR A4->A5 + 1M resistor.
// Outputs are disarmed until desktop configuration is acknowledged and released.
#include <stdlib.h>
#include <string.h>
const byte sendPins[8]={2,4,6,8,10,A0,A2,A4};
const byte receivePins[8]={3,5,7,9,11,A1,A3,A5};
struct Setting {unsigned int baseline,on,off,pressMs,releaseMs;};
Setting settings[8]={{0,5,3,60,100},{0,5,3,60,100},{0,5,3,60,100},{0,5,3,60,100},{0,5,3,60,100},{0,5,3,60,100},{0,5,3,60,100},{0,5,3,60,100}};
bool finalTouch=false;
bool state[8]={},candidate[8]={},armed[8]={};
unsigned long since[8]={},counts[8]={},seq=0,lastFrame=0,lastHost=0;
unsigned int raw[8]={},baselineMax[8]={};
byte measurementSamples=3;unsigned int measurementLimit=300;
unsigned int configId=0,calId=0;
unsigned long calStart=0;
bool calibrating=false;
char command[384]; unsigned int commandLength=0; bool overflow=false;

unsigned int readTouch(byte i){
  unsigned long total=0;
  for(byte sample=0;sample<measurementSamples;sample++){
    // Explicitly discharge before every measurement; no internal pullup.
    digitalWrite(sendPins[i],LOW);pinMode(sendPins[i],OUTPUT);
    digitalWrite(receivePins[i],LOW);pinMode(receivePins[i],OUTPUT);
    delayMicroseconds(5);pinMode(receivePins[i],INPUT);
    digitalWrite(sendPins[i],HIGH);
    unsigned int cycles=0;while(!digitalRead(receivePins[i])&&cycles<measurementLimit)cycles++;
    digitalWrite(sendPins[i],LOW);pinMode(receivePins[i],OUTPUT);digitalWrite(receivePins[i],LOW);
    total+=cycles;
  }
  return total/measurementSamples;
}
void disarm(){for(byte i=0;i<8;i++){state[i]=false;candidate[i]=true;armed[i]=false;since[i]=millis();}}
bool number(char* s,long &n){if(!s||!*s)return false;char* end;n=strtol(s,&end,10);return *end==0&&n>=0;}
void handleCommand(){
  char* kind=strtok(command," "); if(!kind)return;
  long id;if(!number(strtok(NULL," "),id)||id<1||id>65535)return;
  if(strcmp(kind,"PING")==0){if(id==configId)lastHost=millis();return;}
  if(strcmp(kind,"CAL")==0){
    if(!configId||calibrating)return;
    calId=id;calibrating=true;calStart=millis();memset(baselineMax,0,sizeof baselineMax);disarm();return;
  }
  if(strcmp(kind,"CFG")!=0||calibrating)return;
  long mode,samples,limit;if(!number(strtok(NULL," "),mode)||mode>1||!number(strtok(NULL," "),samples)||samples<1||samples>12||!number(strtok(NULL," "),limit)||limit<50||limit>4095)return;
  Setting next[8];
  for(byte i=0;i<8;i++){
    long v[5];for(byte j=0;j<5;j++)if(!number(strtok(NULL," "),v[j]))return;
    if(v[0]>4095||v[1]<1||v[1]>4095||v[2]>=v[1]||v[0]+v[1]>4095||v[3]<20||v[3]>2000||v[4]<20||v[4]>2000)return;
    next[i]={(unsigned int)v[0],(unsigned int)v[1],(unsigned int)v[2],(unsigned int)v[3],(unsigned int)v[4]};
  }
  if(strtok(NULL," "))return;
  if(configId!=(unsigned int)id||finalTouch!=(bool)mode||measurementSamples!=(byte)samples||measurementLimit!=(unsigned int)limit||memcmp(settings,next,sizeof settings)!=0){memcpy(settings,next,sizeof settings);finalTouch=mode;measurementSamples=samples;measurementLimit=limit;configId=id;disarm();}
  lastHost=millis();
}
void setup(){Serial.begin(115200);pinMode(12,INPUT_PULLUP);disarm();}
void loop(){
  // Bound command processing to one fixed buffer; reject overlong lines.
  byte budget=64;
  while(Serial.available()&&budget--){char ch=Serial.read();if(ch=='\n'){
    if(!overflow){command[commandLength]=0;handleCommand();}commandLength=0;overflow=false;
  }else if(ch!='\r'){if(commandLength<sizeof(command)-1)command[commandLength++]=ch;else overflow=true;}}
  unsigned long now=millis();
  if(configId&&!calibrating&&now-lastHost>2000){configId=0;disarm();}
  if(now-lastFrame<25)return;lastFrame=now;
  for(byte i=0;i<8;i++){
    raw[i]=(i==7&&!finalTouch)?(digitalRead(12)==LOW?1:0):readTouch(i);
    if(calibrating){if(raw[i]>baselineMax[i])baselineMax[i]=raw[i];continue;}
    if(!configId)continue;
    Setting s=settings[i];
    bool wanted=(i==7&&!finalTouch)?raw[i]!=0:(state[i]?raw[i]>s.baseline+s.off:raw[i]>=s.baseline+s.on);
    // Rearm only after a confirmed release, including startup/config changes.
    if(!armed[i])wanted=(i==7&&!finalTouch)?raw[i]!=0:raw[i]>s.baseline+s.off;
    if(wanted!=candidate[i]){candidate[i]=wanted;since[i]=now;}
    if(now-since[i]>=(wanted?s.pressMs:s.releaseMs)){
      if(!wanted){armed[i]=true;state[i]=false;}
      else if(armed[i]&&!state[i]){state[i]=true;counts[i]++;}
    }
  }
  if(calibrating&&now-calStart>=2000){
    calibrating=false;configId=0;disarm();
    Serial.print(F("{\"calibrated\":"));Serial.print(calId);Serial.print(F(",\"baseline\":["));
    for(byte i=0;i<8;i++){if(i)Serial.print(',');Serial.print(i==7&&!finalTouch?0:baselineMax[i]);}Serial.println(F("]}"));
  }
  Serial.print(F("{\"version\":1,\"seq\":"));Serial.print(seq++);Serial.print(F(",\"channels\":["));
  for(byte i=0;i<8;i++){if(i)Serial.print(',');Serial.print(configId&&!calibrating&&state[i]?1:0);}
  Serial.print(F("],\"final\":0,\"touch\":{\"firmware\":\"touch-1\",\"configId\":"));Serial.print(configId);
  Serial.print(F(",\"calibrating\":"));Serial.print(calibrating?F("true"):F("false"));Serial.print(F(",\"raw\":["));
  for(byte i=0;i<8;i++){if(i)Serial.print(',');Serial.print(raw[i]);}Serial.print(F("],\"counts\":["));
  for(byte i=0;i<8;i++){if(i)Serial.print(',');Serial.print(counts[i]);}Serial.println(F("]}}"));
}
