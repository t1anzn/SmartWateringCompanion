import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  TouchableOpacity,
  Switch,
  ScrollView,
} from "react-native";
import { LineChart } from "react-native-chart-kit";
import {
  getDatabase,
  ref,
  query,
  orderByChild,
  limitToLast,
  get,
} from "firebase/database";
import { database } from "@/constants/FirebaseConfig";
import { useColorScheme } from "@/hooks/useColorScheme";
import { Colors } from "@/constants/Colors";

interface PlantHistoryChartProps {
  plantId: string;
  daysToShow?: number;
}

interface SensorDataPoint {
  timestamp: number;
  moistureLevel: number;
  waterLevel: number;
  watered?: boolean;
  isoDate?: string; // Add this property to match the data coming from Arduino
}

export default function PlantHistoryChart({
  plantId,
  daysToShow = 7,
}: PlantHistoryChartProps) {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [moistureData, setMoistureData] = useState<number[]>([]);
  const [waterLevelData, setWaterLevelData] = useState<number[]>([]);
  const [labels, setLabels] = useState<string[]>([]);
  const [wateringEvents, setWateringEvents] = useState<string[]>([]);
  const [processedEntries, setProcessedEntries] = useState<any[]>([]);

  // Add state for view mode
  const [viewMode, setViewMode] = useState<"day" | "week">(
    daysToShow === 1 ? "day" : "week"
  );

  // Calculate actual daysToShow based on viewMode
  const effectiveDaysToShow = viewMode === "day" ? 1 : 7;

  // Add state for how many data points to show
  const [maxDataPoints, setMaxDataPoints] = useState(8);

  // Simplified tooltip state - just track one active tooltip at a time
  const [activeTooltip, setActiveTooltip] = useState<{
    value: number;
    timestamp: number;
    type: "moisture" | "water";
    index: number;
  } | null>(null);

  // Use useCallback to memoize the function so it can be used in useEffect and button press
  const loadHistoricalData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const dataRef = ref(database, `plants/${plantId}/history`);

      // Get all history data without filtering by timestamp
      const dataQuery = query(dataRef);

      const snapshot = await get(dataQuery);

      if (snapshot.exists()) {
        const historyData: SensorDataPoint[] = [];

        snapshot.forEach((childSnapshot) => {
          const dataPoint = childSnapshot.val();

          // Ensure all values are valid numbers and convert negative values to 0
          const processedDataPoint = {
            timestamp: dataPoint.timestamp || 0,
            moistureLevel: Math.max(0, dataPoint.moistureLevel || 0),
            waterLevel: Math.max(0, dataPoint.waterLevel || 0),
            watered: dataPoint.watered || false,
            isoDate: dataPoint.isoDate, // Add this line to capture the isoDate field
          };

          historyData.push(processedDataPoint);
        });

        console.log(`Found ${historyData.length} history entries`);

        // Process data for charts - don't filter by days since we don't have proper timestamps
        const processedData = processDataForCharts(
          historyData,
          effectiveDaysToShow
        );
        setMoistureData(processedData.moistureData);
        setWaterLevelData(processedData.waterLevelData);
        setLabels(processedData.labels);
        setWateringEvents(processedData.wateringEvents);
        setProcessedEntries(processedData.processedEntries); // Store processed entries
      } else {
        // No data found
        setMoistureData([]);
        setWaterLevelData([]);
        setLabels([]);
        setWateringEvents([]);
        setError("No historical data available yet");
      }
    } catch (error) {
      console.error("Error loading historical data:", error);
      setError("Failed to load historical data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [plantId, effectiveDaysToShow]);

  // Initial data load
  useEffect(() => {
    loadHistoricalData();
  }, [loadHistoricalData]);

  // Handle refresh button press
  const handleRefresh = () => {
    setRefreshing(true);
    loadHistoricalData();
  };

  // Helper function to check if a timestamp is valid (after 2020)
  function isRecentTimestamp(timestamp: number): boolean {
    // For debugging
    console.log(`Checking timestamp: ${timestamp}`);

    // Check if this is one of the old 2010 timestamps (they're around 1.2-1.3 billion)
    const isOldTimestamp = timestamp > 1000000000 && timestamp < 2000000000;

    if (isOldTimestamp) {
      console.log("Found old 2010 timestamp, will override with 2025 date");
      return false; // Return false to trigger our override logic
    }

    // For modern timestamps (milliseconds since 1970)
    if (timestamp > 1000000000000) {
      console.log("Found valid millisecond timestamp");
      return true;
    }

    return false;
  }

  // Helper function to process raw data into chart format
  function processDataForCharts(data: SensorDataPoint[], days: number) {
    const labels: string[] = [];
    const moistureData: number[] = [];
    const waterLevelData: number[] = [];
    const wateringEvents: string[] = [];

    console.log("Raw data entries:", data);

    // 1. Check if we have any entries with valid timestamps
    // Consider both millisecond-based (modern) and second-based (legacy) timestamps
    const modernTimestamps = data.some(
      (point) => point.timestamp > 1000000000000
    );
    const legacyTimestamps = data.some(
      (point) => point.timestamp > 1000000000 && point.timestamp < 10000000000
    );

    console.log(
      `Timestamp analysis: modern=${modernTimestamps}, legacy=${legacyTimestamps}`
    );

    // Create a working copy of the data and normalize timestamps
    const processedData = data.map((point) => {
      let timestamp = point.timestamp;
      let displayDate;

      // If it has an ISO date string, use that preferentially
      if (point.isoDate) {
        // Parse the ISO date string to a Date object
        const date = new Date(point.isoDate);
        timestamp = date.getTime(); // Use the parsed date's timestamp
        displayDate = point.isoDate; // Store the original ISO string for display
        console.log(`Using ISO date: ${point.isoDate} → ${date.toISOString()}`);
      }
      // Otherwise, if it's a legacy second-based timestamp, convert to milliseconds
      else if (
        legacyTimestamps &&
        !modernTimestamps &&
        timestamp > 1000000000 &&
        timestamp < 10000000000
      ) {
        timestamp = timestamp * 1000;
      }

      return {
        ...point,
        timestamp: timestamp,
        displayDate: displayDate,
      };
    });

    // Sort the data by timestamp (chronological order)
    processedData.sort((a, b) => a.timestamp - b.timestamp);

    // Determine if we should display by day or by time
    const shouldShowByDay = effectiveDaysToShow > 1;

    // Keep all processed entries, don't truncate them
    const processedEntries = processedData;

    // Format labels and add data points for all entries
    processedData.forEach((point) => {
      const date = new Date(point.timestamp);

      let label;
      if (shouldShowByDay) {
        // Show only the date for multi-day view (no time)
        label = date.toLocaleDateString("en-UK", {
          month: "short",
          day: "numeric",
        });
      } else {
        // For same-day view, show just the hour
        label = date
          .toLocaleTimeString("en-UK", {
            hour: "2-digit",
          })
          .replace(/\s/g, ""); // Remove any spaces
      }

      labels.push(label);
      moistureData.push(point.moistureLevel);
      waterLevelData.push(point.waterLevel);

      if (point.watered) {
        wateringEvents.push(label);
      }
    });

    console.log("Final chart data prepared:", {
      labels,
      moistureData,
      waterLevelData,
      wateringEvents,
    });

    // Remove the code that adds artificial variation and just use real data

    const moistureMin = 0;
    const moistureMax = Math.max(500, ...moistureData) + 100;
    const waterLevelMin = 0;
    const waterLevelMax = Math.max(100, ...waterLevelData) + 10;

    return {
      labels,
      moistureData,
      waterLevelData,
      wateringEvents,
      moistureMin,
      moistureMax,
      waterLevelMin,
      waterLevelMax,
      processedEntries, // Add this to the return value
    };
  }

  // Simplified tooltip render function
  const renderTooltip = () => {
    if (!activeTooltip) return null;

    const { value, timestamp, type } = activeTooltip;
    const formattedDate = new Date(timestamp).toLocaleString("en-UK", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    return (
      <View style={styles.tooltipOverlay}>
        <View
          style={[
            styles.tooltip,
            { backgroundColor: colorScheme === "dark" ? "#333" : "#fff" },
          ]}
        >
          <Text style={[styles.tooltipTitle, { color: colors.text }]}>
            {formattedDate}
          </Text>
          <Text style={[styles.tooltipValue, { color: colors.text }]}>
            {type === "moisture"
              ? `Moisture: ${value}`
              : `Water Level: ${value}%`}
          </Text>
        </View>
      </View>
    );
  };

  // Define some baseline values to ensure charts look good
  const defaultMoistureData = [0, 50, 0];
  const defaultWaterLevelData = [0, 50, 0];

  // Make sure we have proper datasets
  const chartMoistureData = moistureData.length
    ? moistureData
    : defaultMoistureData;
  const chartWaterLevelData = waterLevelData.length
    ? waterLevelData
    : defaultWaterLevelData;

  // Calculate the width based on the number of data points
  const calculateChartWidth = () => {
    const screenWidth = Dimensions.get("window").width - 40;
    // Ensure minimum width is the screen width
    const dataPointWidth = 50; // Width per data point
    const calculatedWidth = Math.max(
      screenWidth,
      dataPointWidth * labels.length
    );
    return calculatedWidth;
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.tint} />
        <Text style={[styles.loadingText, { color: colors.text }]}>
          Loading historical data...
        </Text>
      </View>
    );
  }

  if (error && !refreshing) {
    return (
      <View style={styles.errorContainer}>
        <Text style={[styles.errorText, { color: colors.text }]}>{error}</Text>
        <TouchableOpacity
          style={[styles.refreshButton, { backgroundColor: colors.tint }]}
          onPress={handleRefresh}
        >
          <Text style={styles.refreshButtonText}>Refresh Data</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      <View style={styles.headerContainer}>
        <Text style={[styles.subsectionTitle, { color: colors.text }]}>
          Moisture Level History
        </Text>
        <View style={styles.controlsContainer}>
          <View style={styles.viewModeContainer}>
            <Text style={[styles.viewModeLabel, { color: colors.text }]}>
              Day
            </Text>
            <Switch
              value={viewMode === "week"}
              onValueChange={(value) => setViewMode(value ? "week" : "day")}
              trackColor={{ false: "#767577", true: colors.tint }}
              thumbColor={colors.background}
            />
            <Text style={[styles.viewModeLabel, { color: colors.text }]}>
              Week
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.refreshButton, { backgroundColor: colors.tint }]}
            onPress={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.refreshButtonText}>Refresh</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {refreshing ? (
        <View style={styles.refreshingContainer}>
          <ActivityIndicator size="small" color={colors.tint} />
          <Text style={[styles.refreshingText, { color: colors.text }]}>
            Updating...
          </Text>
        </View>
      ) : null}

      <View style={styles.chartContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={true}>
          <LineChart
            data={{
              labels: labels,
              datasets: [
                {
                  data: chartMoistureData,
                  color: () => colors.tint,
                  strokeWidth: 2,
                },
              ],
              legend: ["Soil Moisture %"],
            }}
            width={calculateChartWidth()}
            height={220}
            fromZero={true}
            onDataPointClick={({ value, index }) => {
              const timestamp = processedEntries[index]?.timestamp;
              if (!timestamp) return;

              setActiveTooltip({
                value,
                timestamp,
                type: "moisture",
                index,
              });

              // Auto-hide tooltip after 3 seconds
              setTimeout(() => {
                setActiveTooltip(null);
              }, 3000);
            }}
            decorator={() => null} // Remove decorator here since we're handling it separately
            chartConfig={{
              backgroundColor: colorScheme === "dark" ? "#1E1E1E" : "#FFFFFF",
              backgroundGradientFrom:
                colorScheme === "dark" ? "#1E1E1E" : "#FFFFFF",
              backgroundGradientTo:
                colorScheme === "dark" ? "#1E1E1E" : "#FFFFFF",
              decimalPlaces: 0,
              color: () =>
                colorScheme === "dark"
                  ? "rgba(255, 255, 255, 0.8)"
                  : "rgba(0, 0, 0, 0.8)",
              labelColor: () =>
                colorScheme === "dark"
                  ? "rgba(255, 255, 255, 0.5)"
                  : "rgba(0, 0, 0, 0.5)",
              style: {
                borderRadius: 16,
              },
              propsForDots: {
                r: "5",
                strokeWidth: "2",
                stroke: colors.tint,
              },
              formatYLabel: (value) => `${value}`,
              // Set the Y-axis steps explicitly
              count: 5, // Number of Y-axis labels
              // Set proper min and max values to ensure Y-axis renders correctly
              min: 0,
              max: Math.max(500, ...chartMoistureData) + 100, // Dynamic max based on data
              horizontalLabelRotation: 45, // Rotate labels to avoid overlap
            }}
            bezier
            style={styles.chart}
          />
        </ScrollView>
        {labels.length > 8 && (
          <Text style={[styles.scrollHint, { color: colors.text }]}>
            Swipe left or right to see more data
          </Text>
        )}
      </View>

      <Text
        style={[styles.subsectionTitle, { color: colors.text, marginTop: 20 }]}
      >
        Water Reservoir Level History
      </Text>

      <View style={styles.chartContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={true}>
          <LineChart
            data={{
              labels: labels,
              datasets: [
                {
                  data: chartWaterLevelData,
                  color: () => "#2196F3", // Blue for water
                  strokeWidth: 2,
                },
              ],
              legend: ["Water Level %"],
            }}
            width={calculateChartWidth()}
            height={220}
            fromZero={true}
            onDataPointClick={({ value, index }) => {
              const timestamp = processedEntries[index]?.timestamp;
              if (!timestamp) return;

              setActiveTooltip({
                value,
                timestamp,
                type: "water",
                index,
              });

              // Auto-hide tooltip after 3 seconds
              setTimeout(() => {
                setActiveTooltip(null);
              }, 3000);
            }}
            decorator={() => null} // Remove decorator here since we're handling it separately
            chartConfig={{
              backgroundColor: colorScheme === "dark" ? "#1E1E1E" : "#FFFFFF",
              backgroundGradientFrom:
                colorScheme === "dark" ? "#1E1E1E" : "#FFFFFF",
              backgroundGradientTo:
                colorScheme === "dark" ? "#1E1E1E" : "#FFFFFF",
              decimalPlaces: 0,
              color: () =>
                colorScheme === "dark"
                  ? "rgba(255, 255, 255, 0.8)"
                  : "rgba(0, 0, 0, 0.8)",
              labelColor: () =>
                colorScheme === "dark"
                  ? "rgba(255, 255, 255, 0.5)"
                  : "rgba(0, 0, 0, 0.5)",
              style: {
                borderRadius: 16,
              },
              propsForDots: {
                r: "5",
                strokeWidth: "2",
                stroke: "#2196F3",
              },
              formatYLabel: (value) => `${value}`,
              // Set the Y-axis steps explicitly
              count: 5, // Number of Y-axis labels
              // Set proper min and max values to ensure Y-axis renders correctly
              min: 0,
              max: Math.max(100, ...chartWaterLevelData) + 10, // Dynamic max based on data
              horizontalLabelRotation: 45, // Rotate labels to avoid overlap
            }}
            bezier
            style={styles.chart}
          />
        </ScrollView>
        {labels.length > 8 && (
          <Text style={[styles.scrollHint, { color: colors.text }]}>
            Swipe left or right to see more data
          </Text>
        )}
      </View>

      {/* Render tooltip as the last element so it appears on top */}
      {renderTooltip()}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 20,
    marginBottom: 10,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "transparent",
  },
  loadingContainer: {
    height: 200,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
  },
  errorContainer: {
    padding: 20,
    alignItems: "center",
  },
  errorText: {
    fontSize: 14,
    textAlign: "center",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  wateringEventsContainer: {
    marginTop: 20,
    padding: 16,
    borderRadius: 8,
    backgroundColor: "transparent",
  },
  wateringEventsTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  wateringEvent: {
    fontSize: 14,
    marginBottom: 4,
  },
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  refreshButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
    minWidth: 80,
    height: 32,
  },
  refreshButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  refreshingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  refreshingText: {
    fontSize: 12,
    marginLeft: 8,
  },
  chartContainer: {
    position: "relative",
    marginBottom: 20,
  },
  tooltipContainer: {
    position: "relative",
    alignItems: "center",
    marginVertical: 10,
    zIndex: 10,
  },
  tooltip: {
    padding: 10,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    minWidth: 180,
    alignItems: "center",
  },
  tooltipTitle: {
    fontWeight: "600",
    fontSize: 12,
    marginBottom: 4,
  },
  tooltipValue: {
    fontSize: 14,
    fontWeight: "bold",
  },
  controlsContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  viewModeContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 10,
  },
  viewModeLabel: {
    fontSize: 12,
    marginHorizontal: 4,
  },
  content: {
    marginTop: 8,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  scrollHint: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 8,
    fontStyle: "italic",
  },
  tooltipOverlay: {
    position: "absolute",
    top: 50, // Position from top of the parent component
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000, // Ensure it's above everything else
    pointerEvents: "none", // Allow touches to pass through to components below
  },
});
