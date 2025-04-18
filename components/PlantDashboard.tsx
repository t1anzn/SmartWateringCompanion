import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Switch,
  TextInput,
} from "react-native";
import React, { useState, useEffect } from "react";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MQTT_CONFIG, MQTT_TOPICS } from "@/constants/MQTTConfig";
import MQTTService from "@/services/MQTTService";

// Define Plant interface at the top level
interface Plant {
  name: string;
  type: string;
  wateringFrequency: number;
  lastWatered: string;
  nextWatering: string;
}

export default function PlantDashboard() {
  const [mqttConnected, setMqttConnected] = useState(false);
  const [isWatering, setIsWatering] = useState(false);

  const [plant, setPlant] = useState<Plant | null>(null);
  const [waterLevel, setWaterLevel] = useState(72);
  const [autoWateringEnabled, setAutoWateringEnabled] = useState(true);
  const [wateringFrequency, setWateringFrequency] = useState(7); // Default to 7 days
  const [moistureLevel, setMoistureLevel] = useState(50); // Default to 50% moisture level
  const [lastWatered, setLastWatered] = useState("");
  const [nextScheduledWatering, setNextScheduledWatering] = useState("");
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];

  const MOISTURE_THRESHOLD = 100; // Adjust based on sensor calibration
  const CHECK_INTERVAL = 3600000; // Check moisture every hour (in ms)

  // Add a watering duration parameter (in seconds)
  const MANUAL_WATERING_DURATION = 10; // 10 seconds of watering

  // Add state to track watering progress (0-100%)
  const [wateringProgress, setWateringProgress] = useState(0);

  // Load plant data on component mount
  useEffect(() => {
    const loadPlantData = async () => {
      try {
        const plantsData = await AsyncStorage.getItem("plants");

        if (plantsData) {
          const plants = JSON.parse(plantsData);
          if (plants.length > 0) {
            // For now, just use the first plant
            const currentPlant = plants[0];
            setPlant(currentPlant);
            setWateringFrequency(currentPlant.wateringFrequency);

            // Format the dates for display
            const lastWateredDate = new Date(currentPlant.lastWatered);
            setLastWatered(formatDateWithTime(lastWateredDate));

            const nextWateringDate = new Date(currentPlant.nextWatering);
            setNextScheduledWatering(formatDateWithoutTime(nextWateringDate));
          }
        }
      } catch (error) {
        console.error("Error loading plant data:", error);
      }
    };

    loadPlantData();
  }, []);

  // Set up MQTT connection
  useEffect(() => {
    let cleanupFunction: (() => void) | undefined;

    const setupMQTT = async () => {
      try {
        console.log("Connecting to MQTT broker...");
        await MQTTService.connect(
          MQTT_CONFIG.HOST,
          MQTT_CONFIG.PORT,
          MQTT_CONFIG.USERNAME,
          MQTT_CONFIG.PASSWORD
        );

        console.log("Connected to MQTT broker");
        setMqttConnected(true); // Set connected status to true

        // Subscribe to topics
        await MQTTService.subscribe(MQTT_TOPICS.MANUAL_WATERING);
        await MQTTService.subscribe(MQTT_TOPICS.SOIL_MOISTURE);
        await MQTTService.subscribe(MQTT_TOPICS.WATER_LEVEL); // Add subscription to water level updates

        //Listen for messages
        MQTTService.onMessage((topic, message) => {
          console.log(`Received message: ${topic} - ${message}`);

          // Handle soil moisture readings
          if (topic === MQTT_TOPICS.SOIL_MOISTURE) {
            try {
              const moistureData = JSON.parse(message);
              const moistureLevel = moistureData.value;

              // Update UI with current moisture level
              setMoistureLevel(moistureLevel);

              // If auto-watering is enabled, check if today is the scheduled watering day first
              if (autoWateringEnabled) {
                const today = new Date();
                const nextWateringDate = new Date(nextScheduledWatering);

                // Format dates to compare just the day, month, and year (ignore time)
                const todayStr = formatDateWithoutTime(today);
                const nextWateringStr = formatDateWithoutTime(nextWateringDate);

                // Only proceed if today is the scheduled watering day (or past)
                if (todayStr === nextWateringStr || today > nextWateringDate) {
                  // Now check the moisture level
                  if (moistureLevel <= MOISTURE_THRESHOLD) {
                    // Trigger automatic watering only if soil is dry enough
                    handleAutomaticWatering();
                  } else {
                    // Soil is still moist enough, postpone watering by 1 day
                    const postponedDate = new Date(today);
                    postponedDate.setDate(today.getDate() + 1);
                    setNextScheduledWatering(
                      formatDateWithoutTime(postponedDate)
                    );

                    // Update storage with new date
                    updateWateringSchedule(postponedDate);
                  }
                }
              }
            } catch (error) {
              console.error("Error parsing soil moisture data:", error);
            }
          }
          // Handle water level readings
          else if (topic === MQTT_TOPICS.WATER_LEVEL) {
            try {
              const waterLevelData = JSON.parse(message);
              const distance = waterLevelData.value;

              // Convert distance to water level percentage (adjust these values based on your tank)
              // Assuming: 5cm = full (100%), 20cm = empty (0%)
              const MAX_DISTANCE = 10; // Distance when tank is empty (cm)
              const MIN_DISTANCE = 2; // Distance when tank is full (cm)

              // Calculate percentage (inverted because closer distance = more water)
              let percentage =
                100 -
                ((distance - MIN_DISTANCE) / (MAX_DISTANCE - MIN_DISTANCE)) *
                  100;

              // Clamp between 0-100
              percentage = Math.max(0, Math.min(100, percentage));

              // Update UI with current water level
              setWaterLevel(Math.round(percentage));

              console.log(`Updated water level: ${Math.round(percentage)}%`);
            } catch (error) {
              console.error("Error parsing water level data:", error);
            }
          }
        });

        // Store the cleanup function
        cleanupFunction = () => {
          MQTTService.disconnect();
          console.log("Disconnected from MQTT broker");
        };
      } catch (error) {
        console.error("Error connecting to MQTT broker:", error);
        setMqttConnected(false); // Set connected status to false
        alert("Failed to connect to MQTT Broker.");
      }
    };

    // Call the setup function
    setupMQTT();

    // Return the cleanup function for when component unmounts
    return () => {
      // Make sure cleanup is defined before calling it
      if (cleanupFunction) {
        cleanupFunction();
      }
    };
  }, []);

  // Set up disconnect handler
  useEffect(() => {
    // Set up disconnect handler to track connection status
    MQTTService.onDisconnect(() => {
      console.log("🔴 MQTT disconnected - updating UI state");
      setMqttConnected(false);
    });

    // Clean up the handler when component unmounts
    return () => {
      // Remove the disconnect handler
    };
  }, []);

  // Set up reconnection logic
  useEffect(() => {
    // Don't try to reconnect if we're already connected
    if (mqttConnected) return;

    // Create a reconnection function
    const attemptReconnection = async () => {
      try {
        console.log("🔄 Attempting to reconnect to MQTT broker...");
        await MQTTService.connect(
          MQTT_CONFIG.HOST,
          MQTT_CONFIG.PORT,
          MQTT_CONFIG.USERNAME,
          MQTT_CONFIG.PASSWORD
        );

        console.log("🟢 Reconnected to MQTT broker");
        setMqttConnected(true);

        // Resubscribe to topics
        await MQTTService.subscribe(MQTT_TOPICS.MANUAL_WATERING);
      } catch (error) {
        console.error("Failed to reconnect:", error);
      }
    };

    // Set up reconnection timer - try every 5 seconds
    const reconnectionTimer = setInterval(attemptReconnection, 5000);

    // Clean up timer when component unmounts or when we reconnect
    return () => {
      clearInterval(reconnectionTimer);
    };
  }, [mqttConnected]); // Depend on mqttConnected so this runs when connection status changes

  // Format date with time: April 16, 2025, 2:30 PM
  const formatDateWithTime = (date: Date): string => {
    return (
      date.toLocaleDateString("en-UK", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }) +
      ", " +
      date.toLocaleTimeString("en-UK", {
        hour: "numeric",
        minute: "numeric",
        hour12: true,
      })
    );
  };

  // Format date without time: April 16, 2025
  const formatDateWithoutTime = (date: Date): string => {
    return date.toLocaleDateString("en-UK", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const handleAutomaticWatering = async () => {
    try {
      if (!mqttConnected) {
        console.log("Cannot water plant - MQTT not connected");
        return;
      }
      console.log(
        "Automatic watering triggered based on schedule and moisture level"
      );

      // Use 5 seconds for automatic watering or customize as needed
      const AUTO_WATERING_DURATION = 5;

      // Include duration in message
      const wateringMessage = JSON.stringify({
        action: "ON",
        duration: AUTO_WATERING_DURATION * 1000, // in milliseconds
      });

      // Send MQTT message to turn the pump on with duration
      await MQTTService.publish(MQTT_TOPICS.AUTO_WATERING, wateringMessage);
      setIsWatering(true);

      // Update UI after duration (no need to send OFF command)
      setTimeout(() => {
        setIsWatering(false);
      }, AUTO_WATERING_DURATION * 1000);

      // Update watering records
      const now = new Date();
      const formattedNow = formatDateWithTime(now);
      setLastWatered(formattedNow);

      // Calculate next watering date
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + wateringFrequency);
      setNextScheduledWatering(formatDateWithoutTime(nextDate));

      // Update storage
      updateWateringSchedule(nextDate);
    } catch (error) {
      console.error("Error during automatic watering:", error);
    }
  };

  // Helper function to update watering schedule in storage
  const updateWateringSchedule = async (nextDate: Date) => {
    try {
      const plantsData = await AsyncStorage.getItem("plants");
      if (plantsData) {
        const plants = JSON.parse(plantsData);
        if (plants.length > 0) {
          plants[0].lastWatered = new Date().toISOString();
          plants[0].nextWatering = nextDate.toISOString();
          await AsyncStorage.setItem("plants", JSON.stringify(plants));
        }
      }
    } catch (error) {
      console.error("Error updating plant data:", error);
    }
  };

  const handleWaterPlant = async () => {
    try {
      // Check if MQTT is connected before attempting to send
      if (!mqttConnected) {
        console.log("Cannot water plant - MQTT not connected");
        alert("Cannot water plant. MQTT connection lost. Reconnecting...");
        return;
      }

      // Check if already watering
      if (isWatering) {
        console.log("Already watering, ignoring request");
        return;
      }

      // Set watering state to true and start progress at 0
      setIsWatering(true);
      setWateringProgress(0);

      // Include watering duration in the MQTT message itself
      const wateringMessage = JSON.stringify({
        action: "ON",
        duration: MANUAL_WATERING_DURATION * 1000, // Send duration in milliseconds
      });

      // Send MQTT message to turn the pump on with duration
      console.log(
        `Sending watering command with ${MANUAL_WATERING_DURATION}s duration via MQTT...`
      );
      await MQTTService.publish(MQTT_TOPICS.MANUAL_WATERING, wateringMessage);
      console.log("Watering command sent!");

      // Update timestamp for when watering started
      const now = new Date();
      const formattedNow = formatDateWithTime(now);
      setLastWatered(formattedNow);

      // Update next watering date
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + wateringFrequency);
      const formattedNextDate = formatDateWithoutTime(nextDate);
      setNextScheduledWatering(formattedNextDate);

      // Update plant data in storage
      try {
        const plantsData = await AsyncStorage.getItem("plants");
        if (plantsData) {
          const plants = JSON.parse(plantsData);
          if (plants.length > 0) {
            plants[0].lastWatered = now.toISOString();
            plants[0].nextWatering = nextDate.toISOString();
            await AsyncStorage.setItem("plants", JSON.stringify(plants));
          }
        }
      } catch (error) {
        console.error("Error updating plant data:", error);
      }

      // Start a progress timer to update the UI during watering
      const startTime = Date.now();
      const totalDuration = MANUAL_WATERING_DURATION * 1000; // Convert to milliseconds

      const progressInterval = setInterval(() => {
        const elapsedTime = Date.now() - startTime;
        const progress = Math.min(
          Math.floor((elapsedTime / totalDuration) * 100),
          100
        );
        setWateringProgress(progress);
      }, 100); // Update progress every 100ms

      // Set a timer to update the UI when watering should be complete
      // We no longer need to send the OFF command - the Arduino handles this based on the duration
      setTimeout(() => {
        // Clear the interval first
        clearInterval(progressInterval);

        // Update state to reflect watering is done
        setIsWatering(false);
        setWateringProgress(100);

        // Reset progress to 0 after a short delay
        setTimeout(() => {
          setWateringProgress(0);
        }, 1000);

        console.log("Watering UI updated to completed state");
      }, totalDuration + 500); // Add a small buffer to account for Arduino processing time
    } catch (error) {
      console.error("Error sending watering command:", error);

      // Show a more specific error message
      if (!mqttConnected) {
        alert("MQTT connection lost. Trying to reconnect... ");
      } else {
        alert("Failed to water plant. Please check your connection.");
      }

      // Reset state if there was an error
      setIsWatering(false);
      setWateringProgress(0);
    }
  };

  const toggleAutoWatering = () => {
    setAutoWateringEnabled((prevState) => !prevState);
  };

  // Update wateringFrequency and next scheduled date
  const updateWateringFrequency = async (frequency: number): Promise<void> => {
    if (frequency > 0) {
      setWateringFrequency(frequency);

      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + frequency);
      const formattedNextDate = formatDateWithoutTime(nextDate);
      setNextScheduledWatering(formattedNextDate);

      // Update plant data in storage
      try {
        const plantsData = await AsyncStorage.getItem("plants");
        if (plantsData) {
          const plants: Plant[] = JSON.parse(plantsData);
          if (plants.length > 0) {
            plants[0].wateringFrequency = frequency;
            plants[0].nextWatering = nextDate.toISOString();
            await AsyncStorage.setItem("plants", JSON.stringify(plants));
          }
        }
      } catch (error) {
        console.error("Error updating watering frequency:", error);
      }
    }
  };

  // Water level indicators
  const getWaterLevelStatus = () => {
    if (waterLevel >= 70) return { text: "Good", color: colors.tint };
    if (waterLevel >= 30) return { text: "Moderate", color: "#FFC107" };
    console.log("Changing water level!");
    return { text: "Low - Refill Soon!", color: "#F44336" };
  };

  const waterLevelStatus = getWaterLevelStatus();

  // If plant data is not loaded yet, show loading state
  if (!plant) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: colorScheme === "dark" ? "#1E1E1E" : "#FFFFFF" },
        ]}
      >
        <Text style={[styles.title, { color: colors.text }]}>
          Loading plant data...
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colorScheme === "dark" ? "#1E1E1E" : "#FFFFFF" },
      ]}
    >
      <View style={styles.plantHeader}>
        <Image
          source={require("@/assets/images/leaf-logo.png")}
          style={styles.plantImage}
          resizeMode="contain"
        />
        <View>
          <Text style={[styles.title, { color: colors.text }]}>
            {plant.name}
          </Text>
          <Text
            style={[
              styles.plantType,
              { color: colorScheme === "dark" ? "#9BA1A6" : "#757575" },
            ]}
          >
            {plant.type}
          </Text>
        </View>
      </View>

      <View style={styles.divider} />

      {/* Water Level Indicator */}
      <View style={styles.infoContainer}>
        <View style={styles.infoItem}>
          <View style={styles.infoHeader}>
            <Text
              style={[
                styles.infoLabel,
                { color: colorScheme === "dark" ? "#9BA1A6" : "#757575" },
              ]}
            >
              Water Reservoir
            </Text>
            <Text style={[styles.infoValue, { color: waterLevelStatus.color }]}>
              {waterLevelStatus.text}
            </Text>
          </View>
          <View style={styles.waterLevelBar}>
            <View
              style={[
                styles.waterLevelFill,
                {
                  width: `${waterLevel}%`,
                  backgroundColor: waterLevelStatus.color,
                },
              ]}
            />
          </View>
          <Text
            style={[
              styles.waterLevelText,
              { color: colorScheme === "dark" ? "#9BA1A6" : "#757575" },
            ]}
          >
            {waterLevel}% full
          </Text>
        </View>

        {/* Auto Watering Toggle */}
        <View style={styles.infoItem}>
          <View style={styles.autoWateringRow}>
            <View>
              <Text
                style={[
                  styles.infoLabel,
                  { color: colorScheme === "dark" ? "#9BA1A6" : "#757575" },
                ]}
              >
                Automatic Watering
              </Text>
              <Text
                style={[
                  styles.scheduleText,
                  { color: colorScheme === "dark" ? "#9BA1A6" : "#757575" },
                ]}
              >
                Next scheduled:{" "}
                {autoWateringEnabled ? nextScheduledWatering : "Disabled"}
              </Text>
            </View>
            <Switch
              value={autoWateringEnabled}
              onValueChange={toggleAutoWatering}
              trackColor={{
                false: "#767577",
                true: colorScheme === "dark" ? "#fff" : "#C8E6C9",
              }}
              thumbColor={autoWateringEnabled ? colors.tint : "#f4f3f4"}
            />
          </View>
        </View>

        <View style={styles.infoItem}>
          <Text
            style={[
              styles.infoLabel,
              { color: colorScheme === "dark" ? "#9BA1A6" : "#757575" },
            ]}
          >
            Watering Frequency
          </Text>

          <View style={styles.frequencyInputContainer}>
            <TextInput
              style={[
                styles.frequencyInput,
                {
                  backgroundColor:
                    colorScheme === "dark" ? "#2C2C2C" : "#F5F5F5",
                  color: colors.text,
                  borderColor: colorScheme === "dark" ? "#444" : "#E0E0E0",
                },
              ]}
              value={
                wateringFrequency === 0 ? "" : wateringFrequency.toString()
              }
              onChangeText={(text) => {
                if (text === "") {
                  setWateringFrequency(0);
                  return;
                }

                // Parse the input as a number
                const frequency = parseInt(text);
                // Only update if it's a valid positive number
                if (!isNaN(frequency) && frequency > 0) {
                  updateWateringFrequency(frequency);
                }
              }}
              onBlur={() => {
                // If a valid frequency is set, ensure next watering date is updated
                if (wateringFrequency > 0) {
                  updateWateringFrequency(wateringFrequency);
                }
              }}
              keyboardType="numeric"
              placeholder="Days"
              placeholderTextColor={
                colorScheme === "dark" ? "#9BA1A6" : "#BDBDBD"
              }
              editable={autoWateringEnabled}
            />
            <Text
              style={[
                styles.frequencyUnit,
                { color: colorScheme === "dark" ? "#9BA1A6" : "#757575" },
              ]}
            >
              {wateringFrequency > 0
                ? `day${wateringFrequency !== 1 ? "s" : ""} between watering`
                : ""}
            </Text>
          </View>
        </View>

        {/* Last Watered */}
        <View style={styles.infoItem}>
          <Text
            style={[
              styles.infoLabel,
              { color: colorScheme === "dark" ? "#9BA1A6" : "#757575" },
            ]}
          >
            Last Watered
          </Text>

          <Text style={[styles.infoValue, { color: colors.text }]}>
            {lastWatered}
          </Text>
        </View>

        <View style={styles.infoItem}>
          <Text
            style={[
              styles.infoLabel,
              { color: colorScheme === "dark" ? "#9BA1A6" : "#757575" },
            ]}
          >
            Soil Moisture
          </Text>
          <View style={styles.waterLevelBar}>
            <View
              style={[
                styles.waterLevelFill,
                {
                  width: `${moistureLevel}%`,
                  backgroundColor:
                    moistureLevel < MOISTURE_THRESHOLD
                      ? "#F44336"
                      : colors.tint,
                },
              ]}
            />
          </View>
          <Text
            style={[
              styles.waterLevelText,
              { color: colorScheme === "dark" ? "#9BA1A6" : "#757575" },
            ]}
          >
            {moistureLevel < MOISTURE_THRESHOLD
              ? "Dry - Needs Water"
              : "Well Hydrated"}
          </Text>
        </View>
      </View>

      {/* Manual Watering Button */}
      <TouchableOpacity
        style={[
          styles.button,
          {
            backgroundColor: autoWateringEnabled
              ? colorScheme === "dark"
                ? "#555"
                : "#E0E0E0"
              : isWatering
              ? "#F44336" // Red when watering
              : colors.tint,
            opacity: autoWateringEnabled || isWatering ? 0.7 : 1,
          },
        ]}
        onPress={handleWaterPlant}
        disabled={autoWateringEnabled || isWatering}
      >
        <Text
          style={[
            styles.buttonText,
            {
              color:
                autoWateringEnabled || isWatering
                  ? colorScheme === "dark"
                    ? "#AAA"
                    : "#757575"
                  : "white",
            },
          ]}
        >
          {isWatering ? `Watering... (${wateringProgress}%)` : "Water Now"}
        </Text>
      </TouchableOpacity>

      {autoWateringEnabled && (
        <Text
          style={[
            styles.autoWateringNote,
            { color: colorScheme === "dark" ? "#9BA1A6" : "#757575" },
          ]}
        >
          Auto-watering is enabled. Turn it off to water manually.
        </Text>
      )}

      {isWatering && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${wateringProgress}%`, backgroundColor: colors.tint },
              ]}
            />
          </View>
          <Text
            style={[
              styles.wateringNote,
              { color: colorScheme === "dark" ? "#9BA1A6" : "#757575" },
            ]}
          >
            Watering in progress for {MANUAL_WATERING_DURATION} seconds
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  plantHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  plantImage: {
    width: 50,
    height: 50,
    marginRight: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 4,
  },
  plantType: {
    fontSize: 14,
  },
  divider: {
    height: 1,
    backgroundColor: "#E0E0E0",
    marginVertical: 12,
  },
  infoContainer: {
    marginBottom: 16,
  },
  infoItem: {
    marginBottom: 16,
  },
  infoHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  infoLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: "500",
  },
  waterLevelBar: {
    height: 10,
    backgroundColor: "#E0E0E0",
    borderRadius: 5,
    marginBottom: 6,
    overflow: "hidden",
  },
  waterLevelFill: {
    height: "100%",
    borderRadius: 5,
  },
  waterLevelText: {
    fontSize: 12,
  },
  autoWateringRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  frequencyInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 4,
  },
  frequencyInput: {
    fontSize: 16,
    width: 70,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    textAlign: "center",
  },
  frequencyUnit: {
    fontSize: 14,
    marginLeft: 10,
  },
  scheduleText: {
    fontSize: 12,
    marginTop: 2,
  },
  button: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  autoWateringNote: {
    fontSize: 12,
    textAlign: "center",
    fontStyle: "italic",
  },
  progressContainer: {
    marginTop: 10,
  },
  progressBar: {
    height: 6,
    backgroundColor: "#E0E0E0",
    borderRadius: 3,
    overflow: "hidden",
    marginVertical: 4,
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  wateringNote: {
    fontSize: 12,
    textAlign: "center",
    fontStyle: "italic",
  },
});
