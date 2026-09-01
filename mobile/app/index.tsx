import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../src/auth/auth-context";

export default function IndexRoute() {
  const { status } = useAuth();
  if (status === "restoring") {
    return (
      <View style={styles.splash}>
        <Text style={styles.logo}>finwise</Text>
        <ActivityIndicator color="#087f78" />
      </View>
    );
  }
  return <Redirect href={status === "authenticated" ? "/(app)" : "/login"} />;
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    backgroundColor: "#f7faf9",
  },
  logo: {
    color: "#075f5a",
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -1,
  },
});
