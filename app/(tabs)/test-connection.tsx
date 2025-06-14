import React, { useState } from "react";
import { View, Text, Button, StyleSheet, ScrollView } from "react-native";

export default function TestConnection() {
  const [messages, setMessages] = useState<string[]>([]);

  const addMessage = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setMessages((prev) => [`${timestamp}: ${message}`, ...prev.slice(0, 9)]);
  };

  const testWebSocket = () => {
    addMessage("🧪 Testing WebSocket connection to localhost:8765...");

    try {
      const ws = new WebSocket("ws://localhost:8765");

      ws.onopen = () => {
        addMessage("✅ WebSocket connected successfully!");
        ws.send("Hello from React Native!");
      };

      ws.onmessage = (event) => {
        addMessage(`📨 Received: ${event.data}`);
      };

      ws.onerror = (error) => {
        addMessage(`❌ WebSocket error: ${JSON.stringify(error)}`);
      };

      ws.onclose = () => {
        addMessage("🔌 WebSocket connection closed");
      };

      // Auto close after 5 seconds
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      }, 5000);
    } catch (error) {
      addMessage(`❌ Connection failed: ${error}`);
    }
  };

  const testHTTP = async () => {
    addMessage("🌐 Testing HTTP connection to localhost...");

    try {
      const response = await fetch("http://localhost:8765");
      addMessage(`✅ HTTP response: ${response.status}`);
    } catch (error) {
      addMessage(`❌ HTTP failed: ${error}`);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Connection Test</Text>

      <View style={styles.buttonContainer}>
        <Button title="Test WebSocket" onPress={testWebSocket} />
        <Button title="Test HTTP" onPress={testHTTP} />
      </View>

      <View style={styles.messagesContainer}>
        <Text style={styles.subtitle}>Test Results:</Text>
        {messages.map((message, index) => (
          <Text key={index} style={styles.message}>
            {message}
          </Text>
        ))}
      </View>

      <View style={styles.instructionsContainer}>
        <Text style={styles.instructionsTitle}>Localhost Connection Issue</Text>
        <Text style={styles.instruction}>
          Expo/React Native often blocks localhost connections
        </Text>
        <Text style={styles.instruction}>Solutions:</Text>
        <Text style={styles.instruction}>
          • Use your computer's IP address
        </Text>
        <Text style={styles.instruction}>• Use ngrok tunnel</Text>
        <Text style={styles.instruction}>• Use Expo tunnel mode</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  subtitle: { fontSize: 18, fontWeight: "bold", marginBottom: 10 },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 20,
  },
  messagesContainer: {
    backgroundColor: "#f0f0f0",
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  message: {
    fontSize: 12,
    marginBottom: 5,
    fontFamily: "monospace",
  },
  instructionsContainer: {
    backgroundColor: "#fff3cd",
    padding: 15,
    borderRadius: 10,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#856404",
  },
  instruction: {
    fontSize: 14,
    marginBottom: 5,
    color: "#856404",
  },
});
