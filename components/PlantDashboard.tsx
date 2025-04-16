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

export default function PlantDashboard() {
  const [plant, setPlant] = useState<Plant | null>(null);
  const [waterLevel, setWaterLevel] = useState(72);
  const [autoWateringEnabled, setAutoWateringEnabled] = useState(true);
  const [wateringFrequency, setWateringFrequency] = useState(7);
  const [lastWatered, setLastWatered] = useState("");
  const [nextScheduledWatering, setNextScheduledWatering] = useState("");
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];

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

  const handleWaterPlant = async () => {
    const now = new Date();
    const formattedNow = formatDateWithTime(now);

    setLastWatered(formattedNow);

    // Simulate water level decrease
    setWaterLevel((prevLevel) => Math.max(prevLevel - 5, 0));

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
  };

  const toggleAutoWatering = () => {
    setAutoWateringEnabled((prevState) => !prevState);
  };

  // Update wateringFrequency and next scheduled date
  interface Plant {
    name: string;
    type: string;
    wateringFrequency: number;
    lastWatered: string;
    nextWatering: string;
  }

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
              : colors.tint,
            opacity: autoWateringEnabled ? 0.7 : 1,
          },
        ]}
        onPress={handleWaterPlant}
        disabled={autoWateringEnabled}
      >
        <Text
          style={[
            styles.buttonText,
            {
              color: autoWateringEnabled
                ? colorScheme === "dark"
                  ? "#AAA"
                  : "#757575"
                : "white",
            },
          ]}
        >
          Water Now
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
});
