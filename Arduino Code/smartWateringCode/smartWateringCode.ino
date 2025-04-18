#include <WiFiS3.h>
#include <WiFiSSLClient.h>
#include "arduino_secrets.h"
#include <Firebase.h>
#include <ArduinoMqttClient.h>

WiFiSSLClient sslClient;
MqttClient mqttClient(sslClient);

Firebase fb(REFERENCE_URL); // Test Mode
// Firebase fb(REFERENCE_URL, AUTH_TOKEN); //Locked Mode (With Authentication)

/* WiFi credentials and HiveMC credentials from arduino_secrets.h */
// const char* ssid
// const char* pass
// const char* mqtt_server
// const char* mqtt_username
// const char* mqtt_password
// const int mqtt_port

// Topic to publish to
const char* manualWateringTopic = "plantSystem/manualWatering";
const char* autoWateringTopic = "plantSystem/autoWatering";
const char* soilMoistureTopic = "plantSystem/soilMoisture"; 
const char* waterLevelTopic = "plantSystem/waterLevel";

int status = WL_IDLE_STATUS;     // the WiFi radio's status

// Pin definitions
const int moistureSensorPin = A0;
const int trigPin = 8;            // Ultrasonic sensor TRIG (connected to D8)
const int echoPin = 9;            // Ultrasonic sensor ECHO (connected to D9)
const int ledPin = 10;            // LED for status indication (connected to D10)

// Variables for sensor readings
int moistureLevel;
long duration;
long distance;
bool manualOverride = false; // Track manual watering state
bool isAutoWateringEnabled = true; // Track if auto-watering is enabled or disabled
const int MOISTURE_THRESHOLD = 100; // Match the threshold used in the app

unsigned long wateringEndTime = 0;
bool wateringTimerActive = false;

// Connecting to MQTT Broker - Loop until connected
void reconnect() {
  // Simplified reconnect function - fewer debug statements, similar to what worked before
  while (!mqttClient.connected()) {
    Serial.print("Attempting MQTT connection...");
    
    String clientId = "ArduinoClient-";
    clientId += String(random(0xffff), HEX); // Create random client ID
    mqttClient.setId(clientId.c_str());
    
    mqttClient.setUsernamePassword(mqtt_username, mqtt_password);
    if (mqttClient.connect(mqtt_server, mqtt_port)) {
      Serial.println("Connected to MQTT!");
      mqttClient.subscribe(manualWateringTopic);
      mqttClient.subscribe(autoWateringTopic);
      return;
    } else {
      Serial.print("Failed, code=");
      Serial.print(mqttClient.connectError());
      Serial.println(" — trying again in 5 seconds");
      delay(5000);
    }
  }
}

void handleIncomingMessage(int messageSize) {
  String topic = mqttClient.messageTopic();
  String message = "";
  while (mqttClient.available()) {
    char c = (char)mqttClient.read();
    message += c;
  }

  Serial.print("Received MQTT message on topic: ");
  Serial.print(topic);
  Serial.print(" - ");
  Serial.println(message);

  // Handle messages for manual watering topic
  if(topic.equals(manualWateringTopic)) {
    // Check if the message is the new JSON format with duration
    if(message.indexOf("{") >= 0) {
      // Try to parse as JSON
      int actionStart = message.indexOf("\"action\":\"") + 10;
      int actionEnd = message.indexOf("\"", actionStart);
      String action = message.substring(actionStart, actionEnd);
      
      // Extract duration if available
      unsigned long duration = 5000; // Default 5 seconds
      if(message.indexOf("\"duration\":") >= 0) {
        int durationStart = message.indexOf("\"duration\":") + 11;
        int durationEnd = message.indexOf("}", durationStart);
        if(durationEnd < 0) durationEnd = message.indexOf(",", durationStart);
        String durationStr = message.substring(durationStart, durationEnd);
        duration = durationStr.toInt();
      }
      
      if(action == "ON") {
        manualOverride = true;
        digitalWrite(ledPin, HIGH); // Turn on pump
        Serial.print("Manual Watering: ON for ");
        Serial.print(duration);
        Serial.println(" milliseconds");
        
        // Set watering end time for automatic shutoff
        wateringEndTime = millis() + duration;
        wateringTimerActive = true;
      }
    }
    // Handle legacy ON/OFF messages for backward compatibility
    else if(message == "ON") {
      manualOverride = true;
      digitalWrite(ledPin, HIGH); // Turn on pump
      Serial.println("Manual Watering: ON (legacy command)");
    } 
    else if(message == "OFF") {
      manualOverride = false;
      digitalWrite(ledPin, LOW); // Turn off pump
      wateringTimerActive = false; // Cancel any active timer
      Serial.println("Manual watering: OFF");
    }
  }
  
  // Handle messages for automatic watering topic
  if(topic.equals(autoWateringTopic) && message == "ON") {
    digitalWrite(ledPin, HIGH); // Turn on pump
    Serial.println("Auto Watering: ON");
  } else if(topic.equals(autoWateringTopic) && message == "OFF") {
    digitalWrite(ledPin, LOW); // Turn off pump
    Serial.println("Auto watering: OFF");
    // Don't change manualOverride as auto watering is a temporary state
  }
}


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

  Serial.print("Connecting to MQTT broker...");
  Serial.println("Using HiveMQ Cloud broker");
  mqttClient.setUsernamePassword(mqtt_username, mqtt_password);
  
  reconnect();
  mqttClient.onMessage(handleIncomingMessage);

   // Publish test message
  //  mqttClient.beginMessage(manualWateringTopic);
  //  mqttClient.print("Hello from Arduino Uno R4 WiFi!");
  //  mqttClient.endMessage();
  //  Serial.println("Test message sent!");


  // Initialize the sensors
  pinMode(ledPin, OUTPUT);  // LED Pin acting as the water pump
  pinMode(trigPin, OUTPUT); // Ultrasonic sensor TRIG pin 
  pinMode(echoPin, INPUT); // Ultrasonic sensor ECHO pin
}

void loop() {
  // Check if we're connected to MQTT, if not, try to reconnect
  if (!mqttClient.connected()) {
    Serial.println("MQTT connection lost, attempting to reconnect...");
    reconnect();
  }
  
  mqttClient.poll(); // This checks for new messages from the broker

  // Check if watering timer is active and needs to be turned off
  if (wateringTimerActive && millis() >= wateringEndTime) {
    manualOverride = false;
    digitalWrite(ledPin, LOW); // Turn off pump
    wateringTimerActive = false;
    Serial.println("Watering timer completed, pump turned OFF");
  }

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
  
  // Only apply manual override if it's active
  if (!manualOverride) {
    // Don't automatically water based on moisture
    // Just keep the pump off unless we get a command
    digitalWrite(ledPin, LOW); // Turn off LED (pump)
  }

   //Serial.println("------");

  Serial.print("Sending data at: ");
  Serial.println(millis());

  // Send to Firebase
  String payload = "{";
  payload += "\"moistureLevel\": " + String(moistureLevel) + ",";
  payload += "\"waterLevelCM\": " + String(distance);
  payload += "}";

  fb.setJson("sensorData", payload);
  
  // Send soil moisture data to MQTT
  String soilMoisturePayload = "{\"value\": " + String(moistureLevel) + "}";
  mqttClient.beginMessage(soilMoistureTopic);
  mqttClient.print(soilMoisturePayload);
  mqttClient.endMessage();

  // Send water level data to MQTT
  String waterLevelPayload = "{\"value\": " + String(distance) + "}";
  mqttClient.beginMessage(waterLevelTopic);
  mqttClient.print(waterLevelPayload);
  mqttClient.endMessage();

  Serial.print("Done sending at: ");
  Serial.println(millis());

  delay(2000); //Wait 2 seconds before reading again
}
