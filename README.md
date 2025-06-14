# Smart Watering Companion

A smart irrigation system that monitors soil moisture and automatically waters plants when needed.

## Prerequisites

- Arduino IDE (version 2.0.0 or later recommended)
- Arduino Uno R4 WiFi development board
- Required libraries (see Installation section)
- HiveMQ Cloud account (for MQTT broker)
- Firebase account (for cloud database)

## Software Components

| Component                    | Description                                                                   |
| ---------------------------- | ----------------------------------------------------------------------------- |
| Arduino IDE                  | Writing and uploading code to the Arduino board                               |
| WiFiNINA Library             | Allows the WiFi module to communicate over the internet                       |
| MQTT Broker (HiveMQ Cloud)   | Manages the communication between mobile app and Arduino                      |
| ArduinoMqttClient Library    | Lets the Arduino publish and subscribe messages using MQTT                    |
| Firebase - Realtime Database | A cloud database to store data from the Arduino                               |
| Firebase Library             | Enables Firebase Realtime Database connectivity on the Arduino                |
| r4SwRTC Library              | A Real-Time-Clock library for using the GPT Timer on Arduino UNO R4           |
| Mobile App                   | Used to monitor the plant through sensor values and control watering remotely |

## Hardware Requirements

| Component                   | Description                                                                                        |
| --------------------------- | -------------------------------------------------------------------------------------------------- |
| Arduino Uno R4 WiFi         | Microcontroller that reads data from the sensors and controls the system with in-built WiFi module |
| Soil Moisture Sensor        | Detects the moisture level of the soil to determine if a plant needs watering                      |
| Relay Module/MOSFET Module  | Acts as a switch to turn the water pump on/off and allows higher voltages to be safely controlled  |
| Submersible Mini Water Pump | Pumps the water to the plant's soil                                                                |
| Ultrasonic Sensor           | Measures water tank level                                                                          |
| LEDs                        | Status indicators (dry soil, watering, standby etc.)                                               |
| Breadboard                  | Construction base to connect components without soldering                                          |
| Jumper Wires                | Used to connect components on the breadboard                                                       |
| USB Cable                   | For uploading code and powering the Arduino                                                        |

_Note: Detailed hardware setup instructions are available in the separate hardware documentation._

## Installation

### 1. Install Arduino IDE

Download and install the Arduino IDE from [arduino.cc](https://www.arduino.cc/en/software)

### 2. Install Arduino Uno R4 Board Package

1. Open Arduino IDE
2. Go to Tools → Board → Boards Manager
3. Search for "Arduino UNO R4 Boards" and install the package

### 3. Install Required Libraries

Install these libraries through the Arduino IDE Library Manager (Sketch → Include Library → Manage Libraries):

- **WiFiNINA** - For WiFi connectivity
- **ArduinoMqttClient** - For MQTT communication
- **Firebase Arduino Client Library for ESP32 and ESP8266** - For Firebase integration
- **r4SwRTC** - For real-time clock functionality

### 4. Set Up Cloud Services

#### HiveMQ Cloud Setup

1. Create an account at [HiveMQ Cloud](https://www.hivemq.com/mqtt-cloud-broker/)
2. Create a new cluster
3. Note down your broker URL, username, and password

#### Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project
3. Enable Realtime Database
4. Get your database URL and API key
5. Configure database rules for read/write access

### 5. Create Configuration Files

Since credentials are sensitive and excluded from version control, you need to create these configuration files:

#### Create arduino_secrets.h

1. Create a new file: `arduino_secrets.h` in your Arduino sketch directory
2. Add your credentials using this template:

```cpp
/*

          WIFI SETUP

*/

char ssid[] = "YOUR_WIFI_SSID";  // your network SSID (name)
char pass[] = "YOUR_WIFI_PASSWORD";  // your network password (use for WPA, or use as key for WEP)
#define DATABASE_URL "https://your-project-id-default-rtdb.firebaseio.com/"

// HiveMQ Connection
const char* mqtt_server = "your-hivemq-broker-url";
const char* mqtt_username = "your-mqtt-username";
const char* mqtt_password = "your-mqtt-password";
const int mqtt_port = 8883;  // SSL/TLS port for direct device connections

/*
 * NOTE: While the React Native app uses port 8884 for WebSocket connections,
 * Arduino should use port 8883 for direct MQTT SSL connections.
 */

/*

          FIREBASE SETUP

  ------------------------------------------------
  IMPORTANT: Choose Firebase Initialization Method
  ------------------------------------------------

  1. ** Test Mode (No Authentication) **:

     - Ensure Firebase rules are set to allow public access. Set the rules as follows:
       {
         "rules": {
           ".read": "true",
           ".write": "true"
         }
       }

  2. ** Locked Mode (With Authentication) **:

     - Obtain your Firebase Authentication Token:
       1. Open your Firebase Console: https://console.firebase.google.com/
       2. Navigate to your project.
       3. Click on the gear icon next to "Project Overview" and select "Project settings".
       4. Go to the "Service accounts" tab.
       5. In the "Database secrets" section, click on "Show" to reveal your authentication token.

     - Ensure Firebase rules require authentication. Set the rules as follows:
       {
         "rules": {
           ".read": "auth != null",
           ".write": "auth != null"
         }
       }

  Note: Using authentication is recommended for production environments to secure your data.
*/

/* Test Mode (No Authentication) */
#define REFERENCE_URL "https://your-project-id-default-rtdb.firebaseio.com/"

/* Uncomment the following line for Locked Mode (With Authentication) */
// #define AUTH_TOKEN "YOUR-AUTHENTICATION-CODE"
```

#### Create MQTTConfig.ts

1. Create a new file: `constants/MQTTConfig.ts` in your project directory
2. Add your MQTT configuration:

```typescript
export const MQTT_CONFIG = {
  HOST: "your-hivemq-broker-url",
  PORT: 8884, // WebSocket port for React Native
  USERNAME: "your-mqtt-username",
  PASSWORD: "your-mqtt-password",
};

export const MQTT_TOPICS = {
  MANUAL_WATERING: "plantSystem/manualWatering",
  AUTO_WATERING: "plantSystem/autoWatering", 
  SOIL_MOISTURE: "plantSystem/soilMoisture",
  WATER_LEVEL: "plantSystem/waterLevel",
  WATERING_STATUS: "plantSystem/manualWatering/status"
};
```

#### Create FirebaseConfig.ts

1. Create a new file: `FirebaseConfig.ts` in your project directory
2. Add your Firebase configuration:

```typescript
export const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project-id.firebaseapp.com",
  databaseURL: "https://your-project-id-default-rtdb.firebaseio.com/",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "your-sender-id",
  appId: "your-app-id",
};
```

_Note: These files are in .gitignore to protect your credentials. Never commit sensitive credentials to version control._

## Software Setup

### 1. Configure WiFi and MQTT Credentials

The credentials are now stored in the `arduino_secrets.h` file you created above.

### 2. Configure Sensor Settings

Adjust the sensor thresholds and pin assignments in the code:

```cpp
// Pin definitions
const int moistureSensorPin = A1;     // Soil moisture sensor analog pin
const int trigPin = 8;                // Ultrasonic sensor TRIG pin
const int echoPin = 9;                // Ultrasonic sensor ECHO pin
const int ledPin = 10;                // Status LED pin

// Sensor thresholds
const int MOISTURE_THRESHOLD = 400;   // Moisture level that triggers watering

// RTC frequency adjustment for accuracy
#define TMR_FREQ_HZ 100.076          // Adjust based on your testing

// Timing intervals (in milliseconds)
unsigned long lastSensorReadTime = 0;     // Sensor reading interval
unsigned long lastFirebaseSendTime = 0;   // Firebase update interval
unsigned long lastMqttSendTime = 0;       // MQTT publish interval
unsigned long lastHistoryUpdate = 0;      // History data update interval
```

## Running the Application

### 1. Upload the Code

1. Connect your Arduino Uno R4 WiFi to your computer via USB-C
2. Select the correct board: Tools → Board → Arduino UNO R4 WiFi
3. Select the correct port: Tools → Port → [Your Arduino Port]
4. Click the Upload button (→) in the Arduino IDE

### 2. Monitor Serial Output

1. Open the Serial Monitor: Tools → Serial Monitor
2. Set baud rate to 115200
3. Watch for WiFi connection status, MQTT connection, Firebase connection, and sensor readings

### 3. Access the Mobile App

#### For Mobile App (React Native):

1. Install **Expo Go** on your mobile device:

   - iOS: Download from the App Store
   - Android: Download from Google Play Store

2. Install dependencies for the bridge (optional):

   ```bash
   cd SmartWateringCompanion/bridge
   npm install
   cd ..
   ```

   _Note: The bridge is specifically designed for UAL Holborn building internal air quality data from their MQTT server. The implementation into the app is not complete and does not impact the main watering system functionality._

3. Install dependencies for the main app and start the development server:

   ```bash
   npm install
   npx expo start
   ```

4. Scan the QR code displayed in the terminal or browser with:

   - iOS: Use the Camera app or Expo Go app
   - Android: Use the Expo Go app

5. The mobile app will load and connect to the same MQTT broker
6. Monitor real-time sensor data and send watering commands remotely

_Note: Ensure your mobile device and Arduino are on the same network for optimal performance._

## Usage

### Automatic Mode

When automatic watering is **enabled**:

- The system checks soil moisture levels every 2 seconds
- **Watering only occurs when BOTH conditions are met:**
  1. **Today is the scheduled watering day** (or past due)
  2. **Soil moisture is below 400** (dry threshold)
- If today is the scheduled day but soil is still moist (above 400), watering is **postponed by 1 day**
- Automatic watering duration is **5 seconds** (hardcoded)
- After watering, the next watering date is calculated based on your frequency setting
- Manual watering is **disabled** when auto mode is on

### Manual Mode

When automatic watering is **disabled**:

- You can manually water your plant using the "Water Now" button
- **You control the watering duration** (1-30 seconds, default 10 seconds)
- Use the +/- buttons or type directly to adjust duration
- The system still updates "Last Watered" and calculates next scheduled date
- No automatic watering occurs regardless of soil moisture

### Watering Frequency

- Set how many days between watering sessions
- System calculates next watering date automatically
- Only editable when automatic mode is enabled
- Updates are saved to your device storage

### Sensor Monitoring

- **Soil Moisture**: Updates every 2 seconds
  - Below 400 = "Dry - Needs Water"
  - 400-500 = "Slightly Moist"
  - Above 500 = "Well Hydrated"
- **Water Reservoir**: Updates every 2 seconds
  - Distance sensor measures water level
  - Warns when reservoir needs refilling
- **Plant History**: Records data every 5 minutes for charts

### MQTT Connection

- Automatically connects to HiveMQ broker
- Reconnects every 5 seconds if connection lost
- All watering commands sent via MQTT to Arduino
- Real-time sensor data received via MQTT

### Data Storage

- Plant data saved locally on your device
- Sensor history stored in Firebase
- Watering events logged with timestamps

## Sensor Calibration

### Soil Moisture Sensor Calibration

The system uses a **400** threshold value for determining when soil is dry. You may need to adjust this based on your specific sensor and soil type:

1. **Test your sensor readings:**

   - Place sensor in completely dry soil - note the reading
   - Place sensor in well-watered soil - note the reading
   - Your dry threshold should be between these values

2. **Adjust the threshold in both locations:**

   - **Arduino Code**: Change `const int MOISTURE_THRESHOLD = 400;` in `smartWateringCode.ino`
   - **App Code**: Change `const MOISTURE_THRESHOLD = 400;` in `PlantDashboard.tsx`

3. **Current moisture interpretation:**
   - Below 400 = "Dry - Needs Water"
   - 400-500 = "Slightly Moist"
   - Above 500 = "Well Hydrated"

### Water Level Sensor Calibration

The ultrasonic sensor calibration values are located **in your React Native app**:

1. **Find the calibration values in PlantDashboard.tsx**:

   ```typescript
   const MAX_DISTANCE = 10; // Distance when tank is empty (cm)
   const MIN_DISTANCE = 2; // Distance when tank is full (cm)
   ```

2. **Measure your water reservoir:**

   - **Empty tank**: Measure distance from ultrasonic sensor to bottom when tank is empty
   - **Full tank**: Measure distance from ultrasonic sensor to water surface when full

3. **Update the app calibration values:**

   - Change `MAX_DISTANCE = 10` to your measured empty tank distance
   - Change `MIN_DISTANCE = 2` to your measured full tank distance

4. **Test the readings:**
   - Fill tank completely - should read close to 100%
   - Empty tank completely - should read close to 0%
   - Restart the app after making changes

## MQTT Topics

The system uses these MQTT topics:

- `plantSystem/soilMoisture` - Publishes soil moisture readings from Arduino to app
- `plantSystem/waterLevel` - Publishes water tank level from Arduino to app
- `plantSystem/manualWatering` - App sends manual watering commands to Arduino
- `plantSystem/autoWatering` - App sends automatic watering commands to Arduino
- `plantSystem/manualWatering/status` - Arduino sends watering status updates to app

## Firebase Data Structure

Data is stored in Firebase with this structure:

```json
{
  "sensorData": {
    "moistureLevel": 450,
    "waterLevelCM": 8
  },
  "plants": {
    "plant1": {
      "history": {
        "entry_[timestamp]": {
          "timestamp": 1704067200000,
          "isoDate": "2025-01-01T12:00:00",
          "moistureLevel": 450,
          "waterLevel": 75,
          "watered": false
        }
      }
    }
  }
}
```

### Data Structure Details:

- **sensorData**: Real-time sensor readings updated every 2 seconds

  - `moistureLevel`: Raw analog reading from soil moisture sensor
  - `waterLevelCM`: Distance measurement from ultrasonic sensor in centimeters

- **plants/plant1/history**: Historical data for charts, updated every 5 minutes
  - `timestamp`: Unix timestamp in milliseconds (for JavaScript compatibility)
  - `isoDate`: Human-readable ISO date string (YYYY-MM-DDTHH:mm:ss)
  - `moistureLevel`: Soil moisture reading at time of recording
  - `waterLevel`: Calculated water percentage (0-100%)
  - `watered`: Boolean indicating if watering occurred at this time

## Safety Notes

- Use a separate power supply for the water pump (not Arduino's 5V)
- Ensure all electrical connections are secure and insulated
- Keep the Arduino and electronics away from water
- Test the system thoroughly before leaving it unattended
- Monitor WiFi connection stability for reliable operation

## Power Considerations

- Arduino Uno R4 WiFi can be powered via USB-C or external adapter
- Water pump requires separate power supply (check pump specifications)
- Consider using a relay module with optical isolation
- WiFi functionality increases power consumption compared to basic Arduino

## Support

For issues or questions:

1. Review the code comments for additional guidance
2. Consult the Arduino Uno R4 WiFi documentation
3. Visit Arduino community forums for WiFi-specific issues
4. Check sensor calibration if readings seem incorrect

## License

This project is open source. Feel free to modify and distribute according to your needs.
This project is open source. Feel free to modify and distribute according to your needs.
