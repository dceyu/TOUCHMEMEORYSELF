// Professor's supplied prototype, archived with message formatting removed.
// Original protocol: 9600 baud, SENSOR_n_ON only. Not the CENTOPIA touch protocol.
class CapacitiveTouch {
  private:
    int _sendPin;
    int _receivePin;
  public:
    CapacitiveTouch(int sendPin,int receivePin){_sendPin=sendPin;_receivePin=receivePin;}
    long read(int samples=3){
      long total=0;
      for(int i=0;i<samples;i++){
        pinMode(_sendPin,OUTPUT);pinMode(_receivePin,INPUT);
        digitalWrite(_sendPin,LOW);delayMicroseconds(5);
        digitalWrite(_sendPin,HIGH);long cycles=0;
        while(!digitalRead(_receivePin)&&cycles<100){cycles++;}
        digitalWrite(_sendPin,LOW);pinMode(_receivePin,OUTPUT);digitalWrite(_receivePin,LOW);
        total+=cycles;
      }
      return total/samples;
    }
};
CapacitiveTouch sensor1(2,3),sensor2(4,5),sensor3(6,7),sensor4(8,9),sensor5(10,11),sensor6(A0,A1),sensor7(A2,A3);
CapacitiveTouch* sensors[7]={&sensor1,&sensor2,&sensor3,&sensor4,&sensor5,&sensor6,&sensor7};
const int THRESHOLD=5;
bool isOn[7]={false,false,false,false,false,false,false};
void setup(){Serial.begin(9600);}
void loop(){
  for(int i=0;i<7;i++){
    long val=sensors[i]->read();
    if(val>=THRESHOLD){if(!isOn[i]){Serial.print("SENSOR_");Serial.print(i+1);Serial.println("_ON");isOn[i]=true;}}
    else{isOn[i]=false;}
  }
  delay(20);
}
