#include <WiFiS3.h>
#include "arduino_secrets.h"
#include <Firebase.h>

/* Test Mode */
Firebase fb(REFERENCE_URL);


int status = WL_IDLE_STATUS;     // the WiFi radio's status

/* Locked Mode (With Authentication)*/
// Firebase fb(REFERENCE_URL, AUTH_TOKEN);

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
  Serial.begin(115200);
  while (!Serial) {
    ; // wait for serial to be ready (for boards with native USB)
  } 

  String fv = WiFi.firmwareVersion();
  if (fv < WIFI_FIRMWARE_LATEST_VERSION) {
    Serial.println("Please upgrade the firmware");
  }

   // attempt to connect to WiFi network:
  while (status != WL_CONNECTED) {
    Serial.print("Attempting to connect to WPA SSID: ");
    Serial.println(ssid);
    // Connect to WPA/WPA2 network:
    status = WiFi.begin(ssid, pass);

    // wait 10 seconds for connection:
    delay(10000);
  }

  // you're connected now, so print out the data:
  Serial.println("You're connected to the network");
  // Serial.println(ssid);
  // Serial.println(pass);
  IPAddress ip = WiFi.localIP();
  Serial.println("IP Address: ");
  Serial.println(ip);


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

  // ----- Ultrasonic Sensor Logic (Water Level Measurement)

  // Clear trigPin
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);

  // Send ultrasonic pulse
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10); // Sensor needs t his timing to trigger a proper sound pulse
  digitalWrite(trigPin, LOW);

  // Measure the echo duration
  duration = pulseIn(echoPin, HIGH);

  // Calculate the distance in cm
  // 0.034 = speed of sound in cm per microsecond at room temperature
  // Divided by 2 because the duration measured is for the round-trip, so half would be the one-way distance
  // distance = time * speed
  distance = duration * 0.034 / 2;

   //Serial.print("Water Level Distance: ");
   //Serial.print(distance);
   //Serial.println(" cm");

  
  // ----- Soil moisture sensor logic

  // Read soil moisture sensor
  moistureLevel = analogRead(moistureSensorPin); // Read the sensor value
   //Serial.print("Soil Moisture Level: ");
   //Serial.println(moistureLevel); // Print the moisture level to the Serial Monitor

  if (moistureLevel < 400) {
    // Soil is dry
    digitalWrite(ledPin, HIGH); // Turn on LED (simulate water pump)
     //Serial.println("Soil is dry - Pump ON");

  } else {
    // Soil is wet
    digitalWrite(ledPin, LOW); // Turn off LED
     //Serial.println("Soil is wet - Pump OFF");
  }

   //Serial.println("------");
   

  delay(2000); //Wait 2 seconds before reading again
}
