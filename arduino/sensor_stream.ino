// CENTOPIA Mapping Studio v1
// Arduino Uno + CD74HC4067, 8 analog channels + one digital Final input.
// Wiring: 4067 SIG -> A0, S0..S3 -> D4..D7, sensors -> C0..C7.
// Final button/sensor -> D2 to GND (INPUT_PULLUP). USB serial: 115200 baud.

const uint8_t MUX_SIG = A0;
const uint8_t MUX_SELECT[4] = {4, 5, 6, 7};
const uint8_t FINAL_PIN = 2;
const uint8_t CHANNEL_COUNT = 8;
uint32_t sequenceNumber = 0;

void selectMuxChannel(uint8_t channel) {
  for (uint8_t bit = 0; bit < 4; bit++) digitalWrite(MUX_SELECT[bit], (channel >> bit) & 1);
  delayMicroseconds(80);
}

float readNormalized(uint8_t channel) {
  selectMuxChannel(channel);
  analogRead(MUX_SIG);
  return constrain(analogRead(MUX_SIG) / 1023.0f, 0.0f, 1.0f);
}

void setup() {
  Serial.begin(115200);
  for (uint8_t pin : MUX_SELECT) { pinMode(pin, OUTPUT); digitalWrite(pin, LOW); }
  pinMode(FINAL_PIN, INPUT_PULLUP);
}

void loop() {
  Serial.print(F("{\"version\":1,\"seq\":"));
  Serial.print(sequenceNumber++);
  Serial.print(F(",\"channels\":["));
  for (uint8_t channel = 0; channel < CHANNEL_COUNT; channel++) {
    if (channel) Serial.print(',');
    Serial.print(readNormalized(channel), 3);
  }
  Serial.print(F("],\"final\":"));
  Serial.print(digitalRead(FINAL_PIN) == LOW ? 1 : 0);
  Serial.println('}');
  delay(25);
}
