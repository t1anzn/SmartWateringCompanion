import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Switch,
} from "react-native";
import React, { useState } from "react";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";

export default function PlantDashboard() {
  const [lastWatered, setLastWatered] = useState("April 10, 2025");
  const [waterLevel, setWaterLevel] = useState(72); // Percentage of water in the reservoir
  const [autoWateringEnabled, setAutoWateringEnabled] = useState(true);
  const [nextScheduledWatering, setNextScheduledWatering] =
    useState("April 17, 2025");
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];

  const handleWaterPlant = () => {
    const today = new Date().toLocaleDateString("en-UK", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    setLastWatered(today);

    // Simulate water level decrease (in a real app this would come from sensor)
    setWaterLevel((prevLevel) => Math.max(prevLevel - 5, 0));

    // Update next watering date (in a real app this would be calculated based on plant needs)
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + 7); // Next watering in 7 days
    setNextScheduledWatering(
      nextDate.toLocaleDateString("en-UK", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    );
  };

  const toggleAutoWatering = () => {
    setAutoWateringEnabled((prevState) => !prevState);
  };

  // Determine water level status and color
  const getWaterLevelStatus = () => {
    if (waterLevel >= 70) return { text: "Good", color: colors.tint };
    if (waterLevel >= 30) return { text: "Moderate", color: "#FFC107" };
    return { text: "Low - Refill Soon!", color: "#F44336" };
  };

  const waterLevelStatus = getWaterLevelStatus();

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
          <Text style={[styles.title, { color: colors.text }]}>Aloe Vera</Text>
          <Text
            style={[
              styles.plantType,
              { color: colorScheme === "dark" ? "#9BA1A6" : "#757575" },
            ]}
          >
            Succulent
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
                true: colorScheme === "dark" ? "#81C784" : "#C8E6C9",
              }}
              thumbColor={autoWateringEnabled ? colors.tint : "#f4f3f4"}
            />
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
