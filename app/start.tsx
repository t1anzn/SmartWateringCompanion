import React, { useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { useRouter } from "expo-router";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function StartScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];

  // Check if onboarding has been completed and if plant setup has been done
  useEffect(() => {
    const checkSetupStatus = async () => {
      try {
        const hasCompletedOnboarding = await AsyncStorage.getItem(
          "hasCompletedOnboarding"
        );
        const hasPlants = await AsyncStorage.getItem("hasPlants");

        if (hasCompletedOnboarding === "true") {
          if (hasPlants === "true") {
            // User has completed both onboarding and plant setup, go to main app
            router.replace("/(tabs)");
          } else {
            // User has completed onboarding but not plant setup
            router.replace("/plant-setup");
          }
        } else {
          // User hasn't completed onboarding, redirect to onboarding
          router.replace("/onboarding");
        }
      } catch (error) {
        console.error("Failed to check setup status:", error);
      }
    };

    checkSetupStatus();
  }, [router]);

  console.log("StartScreen rendered");

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Image
        source={require("@/assets/images/leaf-logo.png")}
        style={styles.logo}
        resizeMode="contain"
      />

      <Text style={[styles.title, { color: colors.text }]}>
        Welcome to Smart Watering Companion
      </Text>

      <Text
        style={[
          styles.subtitle,
          { color: colorScheme === "dark" ? "#9BA1A6" : "#666" },
        ]}
      >
        Keep your plants healthy and hydrated
      </Text>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: colors.tint }]}
        onPress={() => router.push("/(tabs)")}
      >
        <Text style={styles.buttonText}>Get Started</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  logo: {
    width: 240,
    height: 240,
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 40,
    textAlign: "center",
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 24,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
});
