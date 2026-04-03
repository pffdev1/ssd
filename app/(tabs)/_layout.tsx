import { Redirect, Tabs } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useSession } from "@/src/context/SessionContext";

export default function TabsLayout() {
  const { isLoading, user } = useSession();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  return (
    <Tabs screenOptions={{ headerShown: false, headerTitleAlign: "center", tabBarStyle: { display: "none" } }}>
      <Tabs.Screen name="home" options={{ title: "Inicio" }} />
      <Tabs.Screen name="catalogo" options={{ title: "Catalogo" }} />
      <Tabs.Screen name="requests" options={{ title: "Solicitudes" }} />
      <Tabs.Screen name="inbox" options={{ title: "Inbox" }} />
      <Tabs.Screen name="admin" options={{ title: "Admin" }} />
      <Tabs.Screen name="profile" options={{ title: "Perfil" }} />
    </Tabs>
  );
}
