import { Redirect } from "expo-router";
import { ActivityIndicator, Text, View } from "react-native";
import { useSession } from "@/src/context/SessionContext";

export default function IndexScreen() {
  const { isLoading, user } = useSession();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
        <Text style={{ marginTop: 12 }}>Cargando sesion...</Text>
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  return <Redirect href="/(tabs)" />;
}