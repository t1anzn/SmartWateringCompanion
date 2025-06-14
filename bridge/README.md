# UAL MQTT Bridge

This bridge connects to the UAL Holborn building's internal air quality MQTT server and forwards environmental data to your plant system.

## ⚠️ Status: Incomplete Implementation

This bridge is partially implemented and requires UAL-specific MQTT credentials to function.

## Setup

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Configure UAL MQTT password:**
   Edit `mqtt-bridge.js` and replace the placeholder password:

   ```javascript
   const UAL_MQTT_CONFIG = {
     host: "mqtt.cci.arts.ac.uk",
     port: 1883,
     username: "student",
     password: "YOUR_UAL_PASSWORD", // Replace with actual password
   };
   ```

3. **Configure your plant system credentials:**
   Edit `mqtt-bridge.js` and update the plant system config:

   ```javascript
   const PLANT_MQTT_CONFIG = {
     host: "b3c8688c2bee401d97632509bbfbce7d.s1.eu.hivemq.cloud",
     username: "YOUR_PLANT_USERNAME",
     password: "YOUR_PLANT_PASSWORD",
   };
   ```

4. **Run the bridge:**
   ```bash
   npm start
   ```

## Features

- Connects to UAL building MQTT broker (mqtt.cci.arts.ac.uk)
- Subscribes to air quality topics with wildcards
- Forwards environmental data to plant system
- Auto-reconnection on connection loss
- Graceful shutdown handling

## Data Flow

```
UAL Building MQTT → Bridge → Plant System MQTT → Mobile App
```

## Topics

### UAL Building Topics (subscribed):

- `airgradient/#` - All airgradient data with wildcard
- `airgradient/sensors/+` - All sensors with wildcard
- `sensors/#` - All sensors data

## Note

This implementation is specific to UAL Holborn building and does not impact the main watering system functionality.
