import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
} from "react-native";
import EnhancedMQTTService, {
  AirQualityData,
} from "@/services/EnhancedMQTTService";

export default function AirQuality() {
  const [airQualityData, setAirQualityData] = useState<AirQualityData[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const handleAirQualityData = (data: AirQualityData) => {
      console.log("🌍 New air quality data received:", data);
      setAirQualityData((prev) => {
        const newData = [data, ...prev.slice(0, 9)]; // Keep last 10 readings
        return newData;
      });
    };

    // Start listening for air quality data
    EnhancedMQTTService.onAirQualityData(handleAirQualityData);

    // Auto-connect on mount
    connectToUAL();

    return () => {
      EnhancedMQTTService.offAirQualityData(handleAirQualityData);
    };
  }, []);

  const connectToUAL = async () => {
    try {
      await EnhancedMQTTService.connectToUALAirQuality();
      setIsConnected(true);
    } catch (error) {
      console.error("Failed to connect to UAL:", error);
      setIsConnected(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await connectToUAL();
    setRefreshing(false);
  };

  const getAirQualityLevel = (co2: number) => {
    if (co2 < 400) return { level: "Excellent", color: "#4CAF50" };
    if (co2 < 1000) return { level: "Good", color: "#8BC34A" };
    if (co2 < 2000) return { level: "Moderate", color: "#FF9800" };
    return { level: "Poor", color: "#F44336" };
  };

  const latest = airQualityData[0];

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Text style={styles.title}>UAL Air Quality</Text>

      <View style={styles.statusCard}>
        <Text style={styles.statusText}>
          Status: {isConnected ? "🟢 Connected" : "🔴 Disconnected"}
        </Text>
        <Text style={styles.dataCount}>
          Readings received: {airQualityData.length}
        </Text>
      </View>

      {latest && (
        <View style={styles.currentCard}>
          <Text style={styles.cardTitle}>Current Conditions</Text>

          <View style={styles.mainMetrics}>
            <View style={styles.metric}>
              <Text style={styles.metricValue}>{Math.round(latest.rco2)}</Text>
              <Text style={styles.metricUnit}>ppm CO₂</Text>
              <Text
                style={[
                  styles.qualityLevel,
                  { color: getAirQualityLevel(latest.rco2).color },
                ]}
              >
                {getAirQualityLevel(latest.rco2).level}
              </Text>
            </View>

            <View style={styles.metric}>
              <Text style={styles.metricValue}>{latest.atmp.toFixed(1)}</Text>
              <Text style={styles.metricUnit}>°C</Text>
              <Text style={styles.qualityLevel}>Temperature</Text>
            </View>

            <View style={styles.metric}>
              <Text style={styles.metricValue}>{latest.rhum.toFixed(1)}</Text>
              <Text style={styles.metricUnit}>%</Text>
              <Text style={styles.qualityLevel}>Humidity</Text>
            </View>
          </View>

          <View style={styles.detailMetrics}>
            <Text style={styles.detailTitle}>Air Quality Details</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>PM2.5:</Text>
              <Text style={styles.detailValue}>
                {latest.pm02.toFixed(1)} µg/m³
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>PM10:</Text>
              <Text style={styles.detailValue}>
                {latest.pm10.toFixed(1)} µg/m³
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>TVOC Index:</Text>
              <Text style={styles.detailValue}>{latest.tvoc_index}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>NOx Index:</Text>
              <Text style={styles.detailValue}>{latest.nox_index}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Light:</Text>
              <Text style={styles.detailValue}>{latest.light} lux</Text>
            </View>
          </View>

          <Text style={styles.timestamp}>
            Last updated: {new Date(latest.timestamp || 0).toLocaleTimeString()}
          </Text>
          <Text style={styles.location}>📍 {latest.location}</Text>
        </View>
      )}

      {airQualityData.length > 1 && (
        <View style={styles.historyCard}>
          <Text style={styles.cardTitle}>Recent Readings</Text>
          {airQualityData.slice(1, 6).map((reading, index) => (
            <View key={index} style={styles.historyItem}>
              <Text style={styles.historyTime}>
                {new Date(reading.timestamp || 0).toLocaleTimeString()}
              </Text>
              <Text style={styles.historyValue}>
                CO₂: {Math.round(reading.rco2)}ppm | Temp:{" "}
                {reading.atmp.toFixed(1)}°C
              </Text>
            </View>
          ))}
        </View>
      )}

      {airQualityData.length === 0 && (
        <View style={styles.noDataCard}>
          <Text style={styles.noDataText}>
            {isConnected
              ? "Waiting for air quality data..."
              : "Not connected to UAL MQTT"}
          </Text>
          <Text style={styles.noDataSubtext}>
            Make sure the Node.js bridge is running
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#f5f5f5" },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
  },
  statusCard: {
    backgroundColor: "white",
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  statusText: { fontSize: 16, fontWeight: "600" },
  dataCount: { fontSize: 14, color: "#666", marginTop: 4 },
  currentCard: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  cardTitle: { fontSize: 20, fontWeight: "bold", marginBottom: 16 },
  mainMetrics: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 20,
  },
  metric: { alignItems: "center" },
  metricValue: { fontSize: 32, fontWeight: "bold", color: "#2196F3" },
  metricUnit: { fontSize: 14, color: "#666" },
  qualityLevel: { fontSize: 12, fontWeight: "600", marginTop: 4 },
  detailMetrics: { marginBottom: 16 },
  detailTitle: { fontSize: 16, fontWeight: "bold", marginBottom: 8 },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  detailLabel: { fontSize: 14, color: "#666" },
  detailValue: { fontSize: 14, fontWeight: "500" },
  timestamp: { fontSize: 12, color: "#999", textAlign: "center" },
  location: { fontSize: 12, color: "#666", textAlign: "center", marginTop: 4 },
  historyCard: {
    backgroundColor: "white",
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  historyItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  historyTime: { fontSize: 12, color: "#666" },
  historyValue: { fontSize: 14, marginTop: 2 },
  noDataCard: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 12,
    alignItems: "center",
  },
  noDataText: { fontSize: 16, color: "#666", textAlign: "center" },
  noDataSubtext: {
    fontSize: 12,
    color: "#999",
    marginTop: 8,
    textAlign: "center",
  },
});
