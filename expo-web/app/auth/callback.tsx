import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, Text, View } from "react-native";
import { supabase } from "@/src/lib/supabase";

export default function AuthCallbackScreen() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function resolveOAuthCallback() {
      try {
        if (typeof window === "undefined") {
          router.replace("/login");
          return;
        }

        const callbackUrl = new URL(window.location.href);
        const authError =
          callbackUrl.searchParams.get("error_description") ?? callbackUrl.searchParams.get("error");

        if (authError) {
          throw new Error(authError);
        }

        const code = callbackUrl.searchParams.get("code");

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

          if (exchangeError) {
            throw exchangeError;
          }

          window.history.replaceState({}, document.title, "/auth/callback");
        }

        await supabase.auth.getSession();
        router.replace("/login");
      } catch (callbackError) {
        if (!isMounted) {
          return;
        }

        setError(
          callbackError instanceof Error
            ? callbackError.message
            : "No se pudo completar el inicio de sesion."
        );
      }
    }

    resolveOAuthCallback();

    return () => {
      isMounted = false;
    };
  }, []);

  if (error) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 16, backgroundColor: "#dbe7f5" }}>
        <View style={{ width: "100%", maxWidth: 520, borderRadius: 24, borderWidth: 1, borderColor: "#fecdd3", backgroundColor: "#fff1f2", padding: 16 }}>
          <Text style={{ color: "#be123c", fontWeight: "700", fontSize: 16 }}>No se pudo completar el acceso</Text>
          <Text style={{ color: "#9f1239", marginTop: 8, lineHeight: 21 }}>{error}</Text>
          <Pressable
            onPress={() => router.replace("/login")}
            style={{ marginTop: 14, borderRadius: 999, backgroundColor: "#1e3a5f", paddingVertical: 11, alignItems: "center" }}
          >
            <Text style={{ color: "white", fontWeight: "700" }}>Volver a iniciar sesion</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#dbe7f5" }}>
      <ActivityIndicator />
      <Text style={{ marginTop: 12, color: "#1e3a5f" }}>Completando autenticacion...</Text>
    </SafeAreaView>
  );
}
