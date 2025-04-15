import DashboardHeader from "@/components/DashboardHeader";
import PlantDashboard from "../../components/PlantDashboard";
import { View, StyleSheet, ScrollView } from "react-native";
import { useColorScheme } from "@/hooks/useColorScheme";
import { Colors } from "@/constants/Colors";

export default function HomeScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];

  console.log("Index rendered");
  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.scrollContent}
    >
      <DashboardHeader />
      <PlantDashboard />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
  },
  welcomeContainer: {
    width: "100%",
    alignItems: "center",
    marginBottom: 20,
  },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#f5f5f5",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
  },
  placeholder: {
    fontSize: 16,
    color: "#555",
    textAlign: "center",
  },
});
