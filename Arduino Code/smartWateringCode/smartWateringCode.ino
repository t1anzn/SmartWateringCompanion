#include <WiFiS3.h>
#include <WiFiSSLClient.h>
#include "arduino_secrets.h"
#include <Firebase.h>
#include <ArduinoMqttClient.h>
#include <R4SwRTC.h>
#include <time.h>

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
const char* manualWateringStatusTopic = "plantSystem/manualWatering/status";

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
unsigned long lastLoopExecutionTime = 0; // Add tracking variable for loop execution timing
unsigned long wateringStartTime = 0; // Add actual start time tracking

// Add these variables to handle non-blocking operations
unsigned long lastSensorReadTime = 0;
unsigned long lastFirebaseSendTime = 0;
unsigned long lastMqttSendTime = 0;
unsigned long lastWateringCheckTime = 0;
unsigned long lastHistoryUpdate = 0; // New variable to track history updates

// Create our software RTC object
// Adjust frequency as needed for accuracy (default is 100.0)
r4SwRTC myRTC; 
#define TMR_FREQ_HZ 100.076 // Adjust this value based on your testing for accuracy

// Function to send history data to Firebase for the chart
void updatePlantHistory(bool wasWatered) {
  // Create a unique entry key using timestamp
  String entryKey = "entry_" + String(millis());
  
  // Get the current date and time from our Software RTC
  time_t currentUnixTime = myRTC.getUnixTime();
  struct tm *timeInfo = myRTC.getTmTime();
  
  // Create a properly formatted ISO timestamp string
  // Format: YYYY-MM-DDThh:mm:ss
  char isoTimestamp[30];
  snprintf(isoTimestamp, sizeof(isoTimestamp), "%04d-%02d-%02dT%02d:%02d:%02d",
          timeInfo->tm_year + 1900,  // tm_year is years since 1900
          timeInfo->tm_mon + 1,      // tm_mon is months since January (0-11)
          timeInfo->tm_mday,         // tm_mday is day of month (1-31)
          timeInfo->tm_hour,         // tm_hour is hours since midnight (0-23)
          timeInfo->tm_min,          // tm_min is minutes after the hour (0-59)
          timeInfo->tm_sec);         // tm_sec is seconds after the minute (0-59)
  
  // Convert to milliseconds for JavaScript
  unsigned long jsTimestamp = (unsigned long)currentUnixTime * 1000UL;
  
  // Ensure values are in valid ranges
  int adjustedMoistureLevel = max(0, moistureLevel);
  int adjustedWaterLevel = max(0, map(distance, 10, 2, 0, 100));
  
  // Create history data with required fields for the chart
  String historyData = "{";
  historyData += "\"timestamp\": " + String(jsTimestamp) + ","; // Real Unix timestamp in milliseconds
  historyData += "\"isoDate\": \"" + String(isoTimestamp) + "\","; // Add human-readable date
  historyData += "\"moistureLevel\": " + String(adjustedMoistureLevel) + ",";
  historyData += "\"waterLevel\": " + String(adjustedWaterLevel) + ",";
  historyData += "\"watered\": " + String(wasWatered ? "true" : "false");
  historyData += "}";
  
  // Send to Firebase at the correct path
  fb.setJson("plants/plant1/history/" + entryKey, historyData);
  Serial.println("Plant history updated in Firebase with timestamp: " + String(isoTimestamp));
}

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
        // SIMPLEST APPROACH: Just turn on, wait, turn off
        Serial.print("Manual Watering: ON for exactly ");
        Serial.print(duration);
        Serial.println(" milliseconds");
        
        // Turn on pump
        digitalWrite(ledPin, HIGH);
        
        // Wait for the exact duration
        delay(duration);
        
        // Turn off pump
        digitalWrite(ledPin, LOW);
        
        Serial.println("Watering completed");
        
        // Record this watering event in plant history
        updatePlantHistory(true);
        
        // Send completion message
        String completedPayload = "{\"status\":\"watering_completed\"}";
        mqttClient.beginMessage(manualWateringStatusTopic);
        mqttClient.print(completedPayload);
        mqttClient.endMessage();
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

  // Initialize the sensors
  pinMode(ledPin, OUTPUT);  // LED Pin acting as the water pump
  pinMode(trigPin, OUTPUT); // Ultrasonic sensor TRIG pin 
  pinMode(echoPin, INPUT); // Ultrasonic sensor ECHO pin

  // Initialize the Software RTC
  bool rtcStarted = myRTC.begin(TMR_FREQ_HZ);
  if (!rtcStarted) {
    Serial.println("Failed to start software RTC! Check if timer is available.");
  } else {
    Serial.println("Software RTC initialized successfully.");
    
    // Set initial time to April 19, 2025 at current time
    // You can adjust this to the actual time using NTP or manual setting
    struct tm timeInfo;
    timeInfo.tm_year = 2025 - 1900; // Years since 1900
    timeInfo.tm_mon = 4 - 1;        // Months since January (0-11)
    timeInfo.tm_mday = 19;          // Day of the month (1-31)
    timeInfo.tm_hour = 14;          // Hours (0-23)
    timeInfo.tm_min = 48;           // Minutes (0-59)
    timeInfo.tm_sec = 0;            // Seconds (0-59)
    timeInfo.tm_isdst = -1;         // Daylight Saving Time flag
    
    time_t setTime = mktime(&timeInfo);
    myRTC.setUnixTime(setTime);
    
    Serial.print("RTC time set to: ");
    Serial.println(asctime(myRTC.getTmTime()));
  }
}

void loop() {
  // Focus only on timing - do this first
  if (wateringTimerActive) {
    unsigned long now = millis();
    if (now >= wateringEndTime) {
      // Time's up - stop watering immediately
      digitalWrite(ledPin, LOW);
      manualOverride = false;
      wateringTimerActive = false;
      
      unsigned long actualDuration = now - wateringStartTime;
      Serial.print("Watering ENDED after exactly ");
      Serial.print(actualDuration);
      Serial.println(" ms");
    }
  }
  
  // Do MQTT polling next
  mqttClient.poll();
  
  // Handle reconnection if needed
  if (!mqttClient.connected()) {
    static unsigned long lastReconnectAttempt = 0;
    unsigned long now = millis();
    
    // Only try reconnecting every 5 seconds
    if (now - lastReconnectAttempt > 5000) {
      lastReconnectAttempt = now;
      Serial.println("MQTT disconnected, attempting to reconnect");
      reconnect();
    }
  }

  // Handle sensors and data at lower priority
  static unsigned long lastSensorUpdate = 0;
  unsigned long now = millis();
  
  if (now - lastSensorUpdate >= 2000) {
    lastSensorUpdate = now;
    
    // Read sensors
    digitalWrite(trigPin, LOW);
    delayMicroseconds(2);
    digitalWrite(trigPin, HIGH);
    delayMicroseconds(10);
    digitalWrite(trigPin, LOW);
    duration = pulseIn(echoPin, HIGH);
    
    // Calculate the distance in cm
    distance = duration * 0.034 / 2;
    
    // Read soil moisture
    moistureLevel = analogRead(moistureSensorPin);
    
    // Maintain pump state
    if (!manualOverride) {
      digitalWrite(ledPin, LOW);
    }
    
    // Send data to MQTT and Firebase
    String soilMoisturePayload = "{\"value\": " + String(moistureLevel) + "}";
    mqttClient.beginMessage(soilMoistureTopic);
    mqttClient.print(soilMoisturePayload);
    mqttClient.endMessage();

    // Send water level data to MQTT
    String waterLevelPayload = "{\"value\": " + String(distance) + "}";
    mqttClient.beginMessage(waterLevelTopic);
    mqttClient.print(waterLevelPayload);
    mqttClient.endMessage();
    
    String payload = "{";
    payload += "\"moistureLevel\": " + String(moistureLevel) + ",";
    payload += "\"waterLevelCM\": " + String(distance);
    payload += "}";
    
    fb.setJson("sensorData", payload);
    
    // Update plant history more frequently (every 5 minutes = 300000ms)
    // This ensures more data points for your charts
    if (now - lastHistoryUpdate >= 300000) {
      lastHistoryUpdate = now;
      updatePlantHistory(false); // Regular update (not a watering event)
      Serial.println("Updating history data in Firebase");
      Serial.println("Moisture level: " + String(moistureLevel));
      Serial.println("Water level: " + String(map(distance, 10, 2, 0, 100)) + "%");
    }
    
    // Add debug prints for MQTT messages
    Serial.println("MQTT messages sent - Moisture: " + String(moistureLevel) + ", Water Level: " + String(distance) + "cm");
  }
  
  // Add current time display every 10 seconds
  static unsigned long lastTimeDisplay = 0;
  if (now - lastTimeDisplay >= 10000) {
    lastTimeDisplay = now;
    time_t currentTime = myRTC.getUnixTime();
    Serial.print("Current time: ");
    Serial.println(asctime(myRTC.getTmTime()));
  }
  
  // Keep system responsive
  delay(10);
}
