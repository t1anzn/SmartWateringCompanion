import React, { useState, useEffect } from "react";
import { View, Text, Button, ScrollView, StyleSheet } from "react-native";
import EnhancedMQTTService, {
  AirQualityData,
} from "@/services/EnhancedMQTTService";

export default function TestMQTT() {
  const [connectionStatus, setConnectionStatus] = useState({
    plantSystem: false,
    ualAirQuality: false,
  });
  const [messages, setMessages] = useState<string[]>([]);
  const [airQualityData, setAirQualityData] = useState<AirQualityData[]>([]);

  const addMessage = (message: string) => {
    setMessages((prev) => [
      ...prev.slice(-10),
      `${new Date().toLocaleTimeString()}: ${message}`,
    ]);
  };

  const handleAirQualityData = (data: AirQualityData) => {
    addMessage(`📊 Air Quality Data: CO2=${data.rco2}ppm, Temp=${data.atmp}°C`);
    setAirQualityData((prev) => [...prev.slice(-5), data]);
  };

  useEffect(() => {
    EnhancedMQTTService.onAirQualityData(handleAirQualityData);
    // Update connection status on mount
    setConnectionStatus(EnhancedMQTTService.getConnectionStatus());
    addMessage("📱 Test page loaded - ready to test connections");
    return () => EnhancedMQTTService.offAirQualityData(handleAirQualityData);
  }, []);

  const testUALConnection = async () => {
    try {
      addMessage("🌍 Testing UAL MQTT connection...");
      console.log("Starting UAL connection test...");
      const result = await EnhancedMQTTService.connectToUALAirQuality();
      console.log("UAL connection result:", result);
      addMessage(result ? "✅ UAL connected!" : "❌ UAL connection failed");
      setConnectionStatus(EnhancedMQTTService.getConnectionStatus());
    } catch (error) {
      console.error("UAL connection error:", error);
      addMessage(`❌ UAL Error: ${error}`);
    }
  };

  const testBothConnections = async () => {
    try {
      addMessage("🔄 Testing both connections...");
      const results = await EnhancedMQTTService.connectAll();
      addMessage(
        `Plant: ${results.plantSystem ? "✅" : "❌"}, UAL: ${
          results.ualAirQuality ? "✅" : "❌"
        }`
      );
      setConnectionStatus(EnhancedMQTTService.getConnectionStatus());
    } catch (error) {
      addMessage(`❌ Connection Error: ${error}`);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>MQTT Connection Test</Text>

      <View style={styles.statusContainer}>
        <Text>Plant System: {connectionStatus.plantSystem ? "✅" : "❌"}</Text>
        <Text>
          UAL Air Quality: {connectionStatus.ualAirQuality ? "✅" : "❌"}
        </Text>
      </View>

      <View style={styles.buttonContainer}>
        <Button title="Test UAL Only" onPress={testUALConnection} />
        <Button title="Test Both" onPress={testBothConnections} />
      </View>

      <Text style={styles.subtitle}>Messages:</Text>
      <View style={styles.messagesContainer}>
        {messages.map((msg, index) => (
          <Text key={index} style={styles.message}>
            {msg}
          </Text>
        ))}
      </View>

      {airQualityData.length > 0 && (
        <>
          <Text style={styles.subtitle}>Latest Air Quality Data:</Text>
          <View style={styles.dataContainer}>
            {airQualityData.slice(-1).map((data, index) => (
              <Text key={index} style={styles.data}>
                CO2: {data.rco2}ppm | Temp: {data.atmp}°C | Humidity:{" "}
                {data.rhum}%
              </Text>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 20 },
  subtitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 20,
    marginBottom: 10,
  },
  statusContainer: { marginBottom: 20 },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 20,
  },
  messagesContainer: {
    backgroundColor: "#f0f0f0",
    padding: 10,
    marginBottom: 20,
  },
  message: { fontSize: 12, marginBottom: 2 },
  dataContainer: { backgroundColor: "#e8f5e8", padding: 10 },
  data: { fontSize: 14, marginBottom: 5 },
});
