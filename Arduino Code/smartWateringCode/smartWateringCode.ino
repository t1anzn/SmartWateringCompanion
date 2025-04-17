// Pin definitions
const int moistureSensorPin = A0;
const int trigPin = 8;            // Ultrasonic sensor TRIG (connected to D8)
const int echoPin = 9;            // Ultrasonic sensor ECHO (connected to D9)
const int ledPin = 10;            // LED for status indication (connected to D10)

// Variables for sensor readings
int moistureLevel;
long duration;
long distance;

void setup() {
  // Start serial communication
  Serial.begin(9600); 
  // Initialize the sensors
  pinMode(ledPin, OUTPUT);  // LED Pin acting as the water pump
  pinMode(trigPin, OUTPUT); // Ultrasonic sensor TRIG pin 
  pinMode(echoPin, INPUT); // Ultrasonic sensor ECHO pin
  
  

  
}

void loop() {

  // Flashing LED Test
  // digitalWrite(ledPin, HIGH);  // Turn the LED ON
  // delay(1000);                  // Wait for 1 second
  // digitalWrite(ledPin, LOW);   // Turn the LED OFF
  // delay(1000);                  // Wait for 1 second
  
  // -----

  // Read soil moisture sensor
  moistureLevel = analogRead(moistureSensorPin); // Read the sensor value
  Serial.print("Soil Moisture Level: ");
  Serial.println(moistureLevel); // Print the moisture level to the Serial Monitor

  if (moistureLevel < 400) {
    // Soil is dry
    digitalWrite(ledPin, HIGH); // Turn on LED (simulate water pump)
    Serial.println("Soil is dry - Pump ON");

  } else {
    // Soil is wet
    digitalWrite(ledPin, LOW); // Turn off LED
    Serial.println("Soil is wet - Pump OFF");
  }

  delay(2000); //Wait 2 seconds before reading again
}
