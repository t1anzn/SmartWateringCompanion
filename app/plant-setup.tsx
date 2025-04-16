import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function PlantSetupScreen() {
  const [plantName, setPlantName] = useState("");
  const [plantType, setPlantType] = useState("Succulent");
  const [wateringFrequency, setWateringFrequency] = useState("7");
  const router = useRouter();
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];

  const plantTypes = [
    { key: 0, label: "Succulent" },
    { key: 1, label: "Cactus" },
    { key: 2, label: "Flowering Plant" },
    { key: 3, label: "Herb" },
    { key: 4, label: "Vegetable" },
    { key: 5, label: "Fern" },
    { key: 6, label: "Tropical" },
    { key: 7, label: "Bonsai" },
  ];

  const handleSubmit = async () => {
    if (plantName.trim() && wateringFrequency) {
      try {
        // Create a plant object
        const plant = {
          id: "plant1", // For now, just a single plant
          name: plantName.trim(),
          type: plantType,
          wateringFrequency: parseInt(wateringFrequency),
          lastWatered: new Date().toISOString(),
          nextWatering: new Date(
            new Date().setDate(
              new Date().getDate() + parseInt(wateringFrequency)
            )
          ).toISOString(),
        };

        // Save plant to storage
        await AsyncStorage.setItem("plants", JSON.stringify([plant]));
        await AsyncStorage.setItem("hasPlants", "true");

        // Navigate to the main app
        router.push("/(tabs)");
      } catch (error) {
        console.error("Error saving plant data:", error);
        alert("Failed to save plant data. Please try again.");
      }
    } else {
      alert("Please fill out all fields");
    }
  };

  return (
    <ScrollView
      style={[
        styles.container,
        { backgroundColor: colorScheme === "dark" ? "#151718" : "#FFFFFF" },
      ]}
      contentContainerStyle={styles.contentContainer}
    >
      <Image
        source={require("@/assets/images/leaf-logo.png")}
        style={styles.logo}
        resizeMode="contain"
      />

      <Text style={[styles.title, { color: colors.text }]}>Add Your Plant</Text>
      <Text
        style={[
          styles.subtitle,
          { color: colorScheme === "dark" ? "#9BA1A6" : "#757575" },
        ]}
      >
        Let's set up your first plant for monitoring
      </Text>

      <View style={styles.formGroup}>
        <Text
          style={[
            styles.label,
            { color: colorScheme === "dark" ? "#9BA1A6" : "#757575" },
          ]}
        >
          Plant Name
        </Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colorScheme === "dark" ? "#2C2C2C" : "#F5F5F5",
              color: colors.text,
              borderColor: colorScheme === "dark" ? "#444" : "#E0E0E0",
            },
          ]}
          value={plantName}
          onChangeText={setPlantName}
          placeholder="e.g., Aloe Vera"
          placeholderTextColor={colorScheme === "dark" ? "#9BA1A6" : "#BDBDBD"}
        />
      </View>

      <View style={styles.formGroup}>
        <Text
          style={[
            styles.label,
            { color: colorScheme === "dark" ? "#9BA1A6" : "#757575" },
          ]}
        >
          Plant Type
        </Text>

        {/* Plant Type options as individual buttons */}
        <View style={styles.typeButtonsContainer}>
          {plantTypes.map((type) => (
            <TouchableOpacity
              key={type.key}
              style={[
                styles.typeButton,
                {
                  backgroundColor:
                    plantType === type.label
                      ? colors.tint
                      : colorScheme === "dark"
                      ? "#2C2C2C"
                      : "#F5F5F5",
                },
              ]}
              onPress={() => setPlantType(type.label)}
            >
              <Text
                style={[
                  styles.typeButtonText,
                  {
                    color:
                      plantType === type.label
                        ? "white"
                        : colorScheme === "dark"
                        ? "#9BA1A6"
                        : "#757575",
                  },
                ]}
              >
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text
          style={[
            styles.label,
            { color: colorScheme === "dark" ? "#9BA1A6" : "#757575" },
          ]}
        >
          Watering Frequency (days)
        </Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colorScheme === "dark" ? "#2C2C2C" : "#F5F5F5",
              color: colors.text,
              borderColor: colorScheme === "dark" ? "#444" : "#E0E0E0",
            },
          ]}
          value={wateringFrequency}
          onChangeText={(text) => {
            // Only allow numeric input
            if (/^\d*$/.test(text)) {
              setWateringFrequency(text);
            }
          }}
          placeholder="7"
          placeholderTextColor={colorScheme === "dark" ? "#9BA1A6" : "#BDBDBD"}
          keyboardType="numeric"
        />
      </View>

      <TouchableOpacity
        style={[
          styles.button,
          {
            backgroundColor: colors.tint,
            opacity: plantName.trim() && wateringFrequency ? 1 : 0.7,
          },
        ]}
        onPress={handleSubmit}
        disabled={!plantName.trim() || !wateringFrequency}
      >
        <Text style={styles.buttonText}>Create Plant</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
    paddingTop: 60,
    alignItems: "center",
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 32,
    textAlign: "center",
  },
  formGroup: {
    width: "100%",
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    fontWeight: "500",
  },
  input: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  dropdownButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dropdownButtonText: {
    fontSize: 16,
  },
  typeButtonsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 10,
    justifyContent: "flex-start",
    alignItems: "flex-start",
    gap: 8,
  },
  typeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginBottom: 8,
  },
  typeButtonText: {
    fontSize: 14,
  },
  button: {
    marginTop: 16,
    width: "100%",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
});
