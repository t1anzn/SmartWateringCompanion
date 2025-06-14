#include <WiFiS3.h>
#include <WiFiSSLClient.h>
#include "arduino_secrets.h"
#include <Firebase.h>
#include <ArduinoMqttClient.h>
#include <R4SwRTC.h>
#include <time.h>
#include <WiFiUdp.h>

// Define all constants for connection timeouts and retries
#define WIFI_TIMEOUT 20000       // Timeout for WiFi connection in milliseconds
#define WIFI_MAX_RETRIES 3       // Maximum number of WiFi connection retry attempts
#define MQTT_TIMEOUT 10000       // Timeout for MQTT connection in milliseconds
#define MQTT_MAX_RETRIES 3       // Maximum number of MQTT connection retry attempts
#define MQTT_KEEPALIVE 60        // Keepalive interval for MQTT in seconds

// Topic definitions
const char* manualWateringTopic = "plantSystem/manualWatering";
const char* autoWateringTopic = "plantSystem/autoWatering";
const char* soilMoistureTopic = "plantSystem/soilMoisture"; 
const char* waterLevelTopic = "plantSystem/waterLevel";
const char* manualWateringStatusTopic = "plantSystem/manualWatering/status";

// Connection state tracking variables
bool wifiConnected = false;
bool mqttConnected = false;
unsigned long lastWifiRetry = 0;
unsigned long lastMqttRetry = 0;
int wifiRetryCount = 0;
int mqttRetryCount = 0;
int status = WL_IDLE_STATUS;     // the WiFi radio's status

WiFiSSLClient sslClient;
MqttClient mqttClient(sslClient);

Firebase fb(REFERENCE_URL); // Test Mode
// Firebase fb(REFERENCE_URL, AUTH_TOKEN); //Locked Mode (With Authentication)

// Connection status constants
#define WIFI_CONNECTING 0
#define WIFI_CONNECTED 1
#define WIFI_CONNECTION_FAILED 2
#define MQTT_CONNECTING 3
#define MQTT_CONNECTED 4
#define MQTT_CONNECTION_FAILED 5

// Maximum connection retries before waiting longer
#define MAX_WIFI_QUICK_RETRIES 3
#define MAX_MQTT_QUICK_RETRIES 3
#define QUICK_RETRY_INTERVAL 5000    // 5 seconds between quick retries
#define LONG_RETRY_INTERVAL 60000    // 1 minute for longer wait after failures

// Pin definitions
const int moistureSensorPin = A1;
const int trigPin = 8;            // Ultrasonic sensor TRIG (connected to D8)
const int echoPin = 9;            // Ultrasonic sensor ECHO (connected to D9)
const int ledPin = 10;            // LED for status indication (connected to D10)


// Variables for sensor readings
int moistureLevel;
long duration;
long distance;
bool manualOverride = false; // Track manual watering state
bool isAutoWateringEnabled = true; // Track if auto-watering is enabled or disabled
const int MOISTURE_THRESHOLD = 400; // Match the threshold used in the app

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

// Add NTP variables
WiFiUDP ntpUDP;
const char* ntpServer = "pool.ntp.org";
const long gmtOffset_sec = 0;        // GMT offset in seconds (adjust for your timezone)
const int daylightOffset_sec = 3600; // Daylight saving time offset in seconds

// Function to print human-readable WiFi status
void printWifiStatus(int status) {
  switch (status) {
    case WL_CONNECTED:
      Serial.println("Connected to WiFi network");
      break;
    case WL_NO_SHIELD:
      Serial.println("WiFi shield not present");
      break;
    case WL_IDLE_STATUS:
      Serial.println("WiFi status: Idle");
      break;
    case WL_NO_SSID_AVAIL:
      Serial.println("No SSID available/SSID not found");
      break;
    case WL_SCAN_COMPLETED:
      Serial.println("WiFi scan completed");
      break;
    case WL_CONNECT_FAILED:
      Serial.println("WiFi connection failed");
      break;
    case WL_CONNECTION_LOST:
      Serial.println("WiFi connection lost");
      break;
    case WL_DISCONNECTED:
      Serial.println("WiFi disconnected");
      break;
    default:
      Serial.print("Unknown WiFi status: ");
      Serial.println(status);
  }
}

// Add this function at the beginning of your code, before setup()
void listAvailableNetworks() {
  Serial.println("Scanning for available WiFi networks...");
  
  // Scan for networks
  int numNetworks = WiFi.scanNetworks();
  
  if (numNetworks == 0) {
    Serial.println("No networks found");
  } else {
    Serial.print("Found ");
    Serial.print(numNetworks);
    Serial.println(" networks:");
    
    for (int i = 0; i < numNetworks; i++) {
      // Print detailed information about each network
      Serial.print(i + 1);
      Serial.print(") Name: '");
      Serial.print(WiFi.SSID(i));
      Serial.print("' | Signal: ");
      Serial.print(WiFi.RSSI(i));
      Serial.print(" dBm | Encryption: ");
      Serial.println(WiFi.encryptionType(i));
    }
  }
  
  Serial.println("Target SSID from config: '");
  Serial.print(ssid);
  Serial.println("'");
  Serial.println("-----------------------------");
}

// Function to connect to WiFi with better error handling
bool connectToWifi() {
  if (WiFi.status() == WL_CONNECTED) {
    return true;
  }
  
  Serial.print("Attempting to connect to WPA SSID: ");
  Serial.println(ssid);
  
  // Start connection attempt with timeout
  unsigned long startAttempt = millis();
  status = WiFi.begin(ssid, pass);
  Serial.print("Initial WiFi status: ");
  printWifiStatus(status);
  
  // Wait for connection with timeout
  while (status != WL_CONNECTED && millis() - startAttempt < WIFI_TIMEOUT) {
    delay(500);
    Serial.print(".");
    status = WiFi.status();
  }
  
  Serial.println();
  printWifiStatus(status);
  
  if (status == WL_CONNECTED) {
    IPAddress ip = WiFi.localIP();
    Serial.print("IP Address: ");
    Serial.println(ip);
    Serial.print("Signal strength (RSSI): ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
    wifiConnected = true;
    wifiRetryCount = 0;
    return true;
  } else {
    wifiConnected = false;
    wifiRetryCount++;
    Serial.print("WiFi connection failed. Retry count: ");
    Serial.println(wifiRetryCount);
    return false;
  }
}

// Improved MQTT connection function with debugging
bool connectToMqtt() {
  if (mqttClient.connected()) {
    return true;
  }
  
  if (!wifiConnected) {
    Serial.println("Cannot connect to MQTT: WiFi not connected");
    return false;
  }
  
  Serial.print("Attempting MQTT connection to ");
  Serial.print(mqtt_server);
  Serial.print(":");
  Serial.println(mqtt_port);
  
  // Generate a random client ID
  String clientId = "ArduinoClient-";
  clientId += String(random(0xffff), HEX);
  mqttClient.setId(clientId.c_str());
  
  // Set credentials
  mqttClient.setUsernamePassword(mqtt_username, mqtt_password);
  
  // Set connection parameters
  mqttClient.setKeepAliveInterval(MQTT_KEEPALIVE);
  mqttClient.setConnectionTimeout(MQTT_TIMEOUT);
  
  // Connect with SSL
  bool success = mqttClient.connect(mqtt_server, mqtt_port);
  
  if (success) {
    Serial.println("Connected to MQTT broker!");
    mqttClient.subscribe(manualWateringTopic);
    mqttClient.subscribe(autoWateringTopic);
    mqttConnected = true;
    mqttRetryCount = 0;
    return true;
  } else {
    Serial.print("MQTT connection failed, error code: ");
    Serial.println(mqttClient.connectError());
    mqttConnected = false;
    mqttRetryCount++;
    return false;
  }
}

// Connecting to MQTT Broker - Loop until connected
void reconnect() {
  unsigned long retryInterval = (mqttRetryCount > MAX_MQTT_QUICK_RETRIES) ? 
                                LONG_RETRY_INTERVAL : QUICK_RETRY_INTERVAL;
                                
  if (!wifiConnected) {
    if (millis() - lastWifiRetry > retryInterval) {
      lastWifiRetry = millis();
      connectToWifi();
    }
  }
  
  if (wifiConnected && !mqttClient.connected()) {
    if (millis() - lastMqttRetry > retryInterval) {
      lastMqttRetry = millis();
      connectToMqtt();
    }
  }
}

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

void handleIncomingMessage(int messageSize) {
  String topic = mqttClient.messageTopic();
  String message = "";
  while (mqttClient.available()) { // Read message one character at a time and append to string
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
        digitalWrite(3, HIGH); // Turn on relay for pump
        
        // Wait for the exact duration
        delay(duration);
        
        // Turn off pump
        digitalWrite(ledPin, LOW);
        digitalWrite(3, LOW); // Turn off relay for pump
        
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
      digitalWrite(3, HIGH); // Turn on relay for pump
      Serial.println("Manual Watering: ON (legacy command)");
    } 
    else if(message == "OFF") {
      manualOverride = false;
      digitalWrite(ledPin, LOW); // Turn off led pump indicator
      digitalWrite(3, LOW); // Turn off relay for pump
      wateringTimerActive = false; // Cancel any active timer
      Serial.println("Manual watering: OFF");
    }
  }
  
  // Handle messages for automatic watering topic
  if(topic.equals(autoWateringTopic)) {
    // Check if the message is the JSON format with duration
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
        Serial.print("Auto Watering: ON for exactly ");
        Serial.print(duration);
        Serial.println(" milliseconds");
        
        // Turn on pump
        digitalWrite(ledPin, HIGH);
        digitalWrite(3, HIGH); // Turn on relay for pump
        
        // Wait for the exact duration
        delay(duration);
        
        // Turn off pump
        digitalWrite(ledPin, LOW);
        digitalWrite(3, LOW); // Turn off relay for pump
        
        Serial.println("Auto watering completed");
        
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
      digitalWrite(ledPin, HIGH); // Turn on led pump indicator
      digitalWrite(3, HIGH); // Turn on relay for pump
      Serial.println("Auto Watering: ON (legacy command)");
    } else if(message == "OFF") {
      digitalWrite(ledPin, LOW); // Turn off led pump indicator
      digitalWrite(3, LOW); // Turn off relay for pump
      Serial.println("Auto watering: OFF");
      // Don't change manualOverride as auto watering is a temporary state
    }
  }
}

// Function to get time from NTP server
bool syncTimeFromNTP() {
  Serial.println("Syncing time from NTP server...");
  
  // Send NTP request
  byte packetBuffer[48];
  memset(packetBuffer, 0, 48);
  
  // Initialize values needed to form NTP request
  packetBuffer[0] = 0b11100011;   // LI, Version, Mode
  packetBuffer[1] = 0;            // Stratum, or type of clock
  packetBuffer[2] = 6;            // Polling Interval
  packetBuffer[3] = 0xEC;         // Peer Clock Precision
  
  // 8 bytes of zero for Root Delay & Root Dispersion
  packetBuffer[12] = 49;
  packetBuffer[13] = 0x4E;
  packetBuffer[14] = 49;
  packetBuffer[15] = 52;
  
  // Send packet to NTP server
  ntpUDP.begin(123);
  ntpUDP.beginPacket(ntpServer, 123);
  ntpUDP.write(packetBuffer, 48);
  ntpUDP.endPacket();
  
  // Wait for response
  delay(1000);
  
  if (ntpUDP.parsePacket()) {
    ntpUDP.read(packetBuffer, 48);
    
    // Extract timestamp from response
    unsigned long highWord = word(packetBuffer[40], packetBuffer[41]);
    unsigned long lowWord = word(packetBuffer[42], packetBuffer[43]);
    unsigned long secsSince1900 = highWord << 16 | lowWord;
    
    // Convert to Unix timestamp (seconds since Jan 1, 1970)
    const unsigned long seventyYears = 2208988800UL;
    unsigned long epoch = secsSince1900 - seventyYears;
    
    // Adjust for timezone and daylight saving
    epoch += gmtOffset_sec + daylightOffset_sec;
    
    // Set the RTC time
    myRTC.setUnixTime(epoch);
    
    Serial.print("NTP time synchronized: ");
    Serial.println(asctime(myRTC.getTmTime()));
    
    ntpUDP.stop();
    return true;
  } else {
    Serial.println("Failed to get NTP response");
    ntpUDP.stop();
    return false;
  }
}

void setup() {
  // Start serial communication
  Serial.begin(115200);
  while (!Serial) {
    ; // wait for serial to be ready (for boards with native USB)
  } 

  // List available networks for debugging
  listAvailableNetworks();
  
  String fv = WiFi.firmwareVersion();
  if (fv < WIFI_FIRMWARE_LATEST_VERSION) {
    Serial.println("Please upgrade the firmware");
  }

  // Connect to WiFi with better error handling
  lastWifiRetry = millis();
  while (!connectToWifi() && wifiRetryCount < WIFI_MAX_RETRIES) {
    delay(QUICK_RETRY_INTERVAL);
    lastWifiRetry = millis();
  }

  if (!wifiConnected) {
    Serial.println("Failed to connect to WiFi after multiple attempts.");
    Serial.println("Will continue trying in the main loop...");
  }

  // Connect to MQTT with better error handling
  lastMqttRetry = millis();
  if (wifiConnected) {
    while (!connectToMqtt() && mqttRetryCount < MQTT_MAX_RETRIES) {
      delay(QUICK_RETRY_INTERVAL);
      lastMqttRetry = millis();
    }
    
    if (!mqttConnected) {
      Serial.println("Failed to connect to MQTT after multiple attempts.");
      Serial.println("Will continue trying in the main loop...");
    } else {
      mqttClient.onMessage(handleIncomingMessage);
    }
  }

  // Initialize the sensors
  pinMode(ledPin, OUTPUT);  // LED Pin acting as the water pump
  pinMode(trigPin, OUTPUT); // Ultrasonic sensor TRIG pin 
  pinMode(echoPin, INPUT); // Ultrasonic sensor ECHO pin
  pinMode(3, OUTPUT); //output pin for relay board, send signal

  // Initialize the Software RTC
  bool rtcStarted = myRTC.begin(TMR_FREQ_HZ);
  if (!rtcStarted) {
    Serial.println("Failed to start software RTC! Check if timer is available.");
  } else {
    Serial.println("Software RTC initialized successfully.");
    
    // Try to sync time from NTP if WiFi is connected
    if (wifiConnected) {
      if (syncTimeFromNTP()) {
        Serial.println("Time synchronized from NTP server");
      } else {
        Serial.println("NTP sync failed, using default time");
        // Fallback to a reasonable default time
        struct tm timeInfo;
        timeInfo.tm_year = 2025 - 1900;
        timeInfo.tm_mon = 6 - 1;
        timeInfo.tm_mday = 14;
        timeInfo.tm_hour = 12;
        timeInfo.tm_min = 0;
        timeInfo.tm_sec = 0;
        timeInfo.tm_isdst = -1;
        
        time_t setTime = mktime(&timeInfo);
        myRTC.setUnixTime(setTime);
      }
    } else {
      Serial.println("WiFi not connected, using default time");
      // Fallback to default time
      struct tm timeInfo;
      timeInfo.tm_year = 2025 - 1900;
      timeInfo.tm_mon = 6 - 1;
      timeInfo.tm_mday = 14;
      timeInfo.tm_hour = 12;
      timeInfo.tm_min = 0;
      timeInfo.tm_sec = 0;
      timeInfo.tm_isdst = -1;
      
      time_t setTime = mktime(&timeInfo);
      myRTC.setUnixTime(setTime);
    }
    
    Serial.print("RTC time set to: ");
    Serial.println(asctime(myRTC.getTmTime()));
  }
}

void loop() {
  // First, ensure connections are maintained
  if (!wifiConnected || !mqttConnected) {
    reconnect();
  }
  
  // Only proceed with MQTT operations if connected
  if (mqttConnected) {
    mqttClient.poll();
  }
  
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
      digitalWrite(3, LOW); // Turn off relay for pump
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
  
  // Sync time periodically (every 24 hours)
  static unsigned long lastNTPSync = 0;
  if (wifiConnected && millis() - lastNTPSync > 86400000) { // 24 hours in milliseconds
    lastNTPSync = millis();
    syncTimeFromNTP();
  }
  
  // Keep system responsive
  delay(10);
}
