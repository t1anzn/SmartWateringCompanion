import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function OnboardingScreen() {
  const [name, setName] = useState("");
  const router = useRouter();
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];

  const handleContinue = async () => {
    if (name.trim()) {
      try {
        await AsyncStorage.setItem("userName", name.trim());
        await AsyncStorage.setItem("hasCompletedOnboarding", "true");
        router.push("/plant-setup"); // Redirect to plant setup instead of tabs
      } catch (error) {
        console.error("Failed to save user name:", error);
      }
    }
  };

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
          { color: colorScheme === "dark" ? "#9BA1A6" : "#757575" },
        ]}
      >
        Let's personalize your experience
      </Text>

      <View style={styles.inputContainer}>
        <Text style={[styles.label, { color: colors.text }]}>
          What's your name?
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
          value={name}
          onChangeText={setName}
          placeholder="Enter your name"
          placeholderTextColor={colorScheme === "dark" ? "#9BA1A6" : "#BDBDBD"}
        />
      </View>

      <TouchableOpacity
        style={[
          styles.button,
          {
            backgroundColor: name.trim()
              ? colors.tint
              : colorScheme === "dark"
              ? "#444"
              : "#E0E0E0",
            opacity: name.trim() ? 1 : 0.7,
          },
        ]}
        onPress={handleContinue}
        disabled={!name.trim()}
      >
        <Text
          style={[
            styles.buttonText,
            {
              color: name.trim()
                ? "white"
                : colorScheme === "dark"
                ? "#9BA1A6"
                : "#757575",
            },
          ]}
        >
          Continue
        </Text>
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
    width: 100,
    height: 100,
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
  inputContainer: {
    width: "100%",
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 8,
  },
  input: {
    width: "100%",
    height: 50,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  button: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
