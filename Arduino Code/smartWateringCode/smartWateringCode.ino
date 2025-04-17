// Pin definitions
const int moistureSensorPin = 7;  // Soil moisture sensor (connected to D7)
const int trigPin = 8;            // Ultrasonic sensor TRIG (connected to D8)
const int echoPin = 9;            // Ultrasonic sensor ECHO (connected to D9)
const int pumpPin = 10;           // Water pump control (connected to D10)
const int ledPin = 11;            // LED for status indication (connected to D11)

// Variables for sensor readings
int moistureLevel;
long duration;
long distance;

void setup() {
  pinMode(ledPin, OUTPUT);  // Set D10 as output pin
}

void loop() {
  digitalWrite(ledPin, HIGH);  // Turn the LED ON
  delay(1000);                  // Wait for 1 second
  digitalWrite(ledPin, LOW);   // Turn the LED OFF
  delay(1000);                  // Wait for 1 second
}
