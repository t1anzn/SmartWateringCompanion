import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import React, { useEffect, useState } from "react";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";

export default function DashboardHeader() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const [userName, setUserName] = useState("");
  const router = useRouter();

  // Get current time to determine greeting
  const currentHour = new Date().getHours();
  const greeting =
    currentHour < 12
      ? "Good morning"
      : currentHour < 18
      ? "Good afternoon"
      : "Good evening";

  // Format current date - April 15, 2025
  const currentDate = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  // This would be dynamic in a real app based on plant data
  const plantsNeedingWater = 1;

  // Load user name from storage
  useEffect(() => {
    const loadUserName = async () => {
      try {
        const storedName = await AsyncStorage.getItem("userName");
        if (storedName) {
          setUserName(storedName);
        }
      } catch (error) {
        console.error("Failed to load user name:", error);
      }
    };

    loadUserName();
  }, []);

  // Reset user data function
  const resetUserData = async () => {
    try {
      await AsyncStorage.removeItem("userName");
      await AsyncStorage.removeItem("hasCompletedOnboarding");
      alert("User data reset. Restart the app to see onboarding.");
      // Optional: Navigate back to start screen
      router.replace("/start");
    } catch (error) {
      console.error("Failed to reset user data:", error);
    }
  };

  return (
    <View style={styles.container}>
      <Text
        style={[
          styles.date,
          { color: colorScheme === "dark" ? "#9BA1A6" : "#757575" },
        ]}
      >
        {currentDate}
      </Text>

      <View style={styles.greetingRow}>
        <Text style={[styles.greeting, { color: colors.text }]}>
          {greeting}
          {userName ? `, ${userName}` : ""}
        </Text>

        {/* Reset button for testing */}
        <TouchableOpacity
          onPress={resetUserData}
          style={[styles.resetButton, { borderColor: colors.tint }]}
        >
          <Text style={[styles.resetText, { color: colors.tint }]}>Reset</Text>
        </TouchableOpacity>
      </View>

      {plantsNeedingWater > 0 ? (
        <View
          style={[
            styles.alertContainer,
            { backgroundColor: colorScheme === "dark" ? "#3A3A3C" : "#F0F8FF" },
          ]}
        >
          <Text style={[styles.alertText, { color: colors.tint }]}>
            {plantsNeedingWater} plant{plantsNeedingWater > 1 ? "s" : ""} need
            {plantsNeedingWater === 1 ? "s" : ""} watering today
          </Text>
        </View>
      ) : (
        <View
          style={[
            styles.alertContainer,
            { backgroundColor: colorScheme === "dark" ? "#3A3A3C" : "#F0F8FF" },
          ]}
        >
          <Text style={[styles.alertText, { color: colors.tint }]}>
            All plants are watered and happy
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    paddingTop: 60,
    paddingBottom: 16,
  },
  date: {
    fontSize: 14,
    marginBottom: 4,
  },
  greeting: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
  },
  alertContainer: {
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 16,
  },
  alertText: {
    fontSize: 16,
    fontWeight: "500",
  },
  greetingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    marginBottom: 16,
  },
  resetButton: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 4,
    borderWidth: 1,
  },
  resetText: {
    fontSize: 12,
    fontWeight: "500",
  },
});
