import { Stack } from "expo-router";
import { SessionProvider } from "@/src/context/SessionContext";

export default function RootLayout() {
  return (
    <SessionProvider>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="request/[id]" options={{ title: "Detalle de solicitud" }} />
        <Stack.Screen name="solicitudes/[code]" options={{ title: "Nueva solicitud" }} />
        <Stack.Screen name="requests/[id]" options={{ title: "Detalle de solicitud" }} />
        <Stack.Screen name="requests/[id]/print" options={{ title: "Formato imprimible" }} />
        <Stack.Screen name="requests/[id]/responsiva" options={{ title: "Carta responsiva" }} />
      </Stack>
    </SessionProvider>
  );
}
