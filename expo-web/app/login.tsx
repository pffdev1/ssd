import { Redirect } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, SafeAreaView, Text, View, useWindowDimensions } from "react-native";
import { useSession } from "@/src/context/SessionContext";
import { hasSupabaseEnv, supabase } from "@/src/lib/supabase";

const brandLogo = require("../assets/brand/pedersen-connect-logo.png");

function MicrosoftMark() {
  const size = 8;
  const blockStyle = { width: size, height: size };

  return (
    <View
      style={{
        borderRadius: 7,
        backgroundColor: "white",
        padding: 4,
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 3
      }}
    >
      <View style={[blockStyle, { backgroundColor: "#f25022" }]} />
      <View style={[blockStyle, { backgroundColor: "#7fba00" }]} />
      <View style={[blockStyle, { backgroundColor: "#00a4ef" }]} />
      <View style={[blockStyle, { backgroundColor: "#ffb900" }]} />
    </View>
  );
}

export default function LoginScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const { user, isLoading, authError, signInWithMicrosoft } = useSession();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wrapperWidth = useMemo(() => {
    if (width >= 1440) {
      return 1220;
    }

    if (width >= 1200) {
      return 1140;
    }

    if (width >= 900) {
      return 900;
    }

    return Math.max(340, width - 32);
  }, [width]);

  useEffect(() => {
    let active = true;

    async function resolveCodeFromLoginRoute() {
      if (typeof window === "undefined" || !hasSupabaseEnv) {
        return;
      }

      const currentUrl = new URL(window.location.href);
      const authError =
        currentUrl.searchParams.get("error_description") ?? currentUrl.searchParams.get("error");
      const code = currentUrl.searchParams.get("code");

      if (authError) {
        if (active) {
          setError(authError);
        }
        return;
      }

      if (!code) {
        return;
      }

      if (active) {
        setIsSigningIn(true);
      }

      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

      if (!active) {
        return;
      }

      if (exchangeError) {
        setError(exchangeError.message);
        setIsSigningIn(false);
        return;
      }

      window.history.replaceState({}, document.title, "/login");
      setError(null);
      setIsSigningIn(false);
    }

    void resolveCodeFromLoginRoute();

    return () => {
      active = false;
    };
  }, []);

  async function handleMicrosoftLogin() {
    if (isSigningIn || isLoading) {
      return;
    }

    setError(null);
    setIsSigningIn(true);
    try {
      await signInWithMicrosoft();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesion con Microsoft.");
      setIsSigningIn(false);
    }
  }

  if (!isLoading && user) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#dbe7f5", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <View
        style={{
          position: "absolute",
          top: -120,
          left: -130,
          width: 360,
          height: 360,
          borderRadius: 999,
          backgroundColor: "rgba(31,64,107,0.10)"
        }}
      />
      <View
        style={{
          position: "absolute",
          right: -160,
          bottom: -150,
          width: 420,
          height: 420,
          borderRadius: 999,
          backgroundColor: "rgba(0,21,52,0.12)"
        }}
      />

      <View
        style={{
          width: wrapperWidth,
          borderRadius: 42,
          borderWidth: 1,
          borderColor: "#c7d8ea",
          backgroundColor: "white",
          overflow: "hidden"
        }}
      >
        <View style={{ flexDirection: isDesktop ? "row" : "column" }}>
          <View
            style={{
              flex: isDesktop ? 1.08 : undefined,
              paddingHorizontal: isDesktop ? 48 : 24,
              paddingVertical: isDesktop ? 56 : 26,
              backgroundColor: "#edf4fd",
              borderBottomWidth: isDesktop ? 0 : 1,
              borderBottomColor: "#d7e4f2"
            }}
          >
            <View
              style={{
                borderRadius: 28,
                borderWidth: 1,
                borderColor: "#d7e4f2",
                backgroundColor: "rgba(255,255,255,0.92)",
                paddingHorizontal: 14,
                paddingVertical: 14,
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                alignSelf: "flex-start"
              }}
            >
              <View
                style={{
                  width: 62,
                  height: 62,
                  borderRadius: 18,
                  overflow: "hidden",
                  borderWidth: 1,
                  borderColor: "#d7e4f2",
                  backgroundColor: "white"
                }}
              >
                <Image source={brandLogo} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
              </View>
              <View>
                <Text style={{ color: "#1f406b", fontSize: 10, letterSpacing: 2.8, textTransform: "uppercase" }}>
                  Pedersen Connect
                </Text>
                <Text style={{ color: "#001534", marginTop: 2, fontSize: 18, fontWeight: "700" }}>
                  Sistema de Solicitudes Digital
                </Text>
                <Text style={{ color: "#1e3a5f", marginTop: 2, fontWeight: "500" }}>SSD</Text>
              </View>
            </View>

            <Text
              style={{
                marginTop: isDesktop ? 36 : 18,
                color: "#001534",
                fontSize: isDesktop ? 44 : 32,
                fontWeight: "700",
                lineHeight: isDesktop ? 50 : 38,
                maxWidth: 680
              }}
            >
              Solicitudes y aprobaciones corporativas en una sola experiencia.
            </Text>

            <Text
              style={{
                marginTop: 12,
                color: "#1e3a5f",
                fontSize: isDesktop ? 18 : 16,
                lineHeight: 30,
                maxWidth: 620
              }}
            >
              Ingresa con tu cuenta empresarial para acceder a tus formularios, bandeja de aprobaciones y trazabilidad operativa.
            </Text>
          </View>

          <View
            style={{
              flex: isDesktop ? 0.92 : undefined,
              paddingHorizontal: isDesktop ? 34 : 20,
              paddingVertical: isDesktop ? 46 : 22,
              backgroundColor: "#f7fbff",
              justifyContent: "center"
            }}
          >
            <View
              style={{
                borderRadius: 32,
                borderWidth: 1,
                borderColor: "#7197bf",
                backgroundColor: "white",
                paddingHorizontal: isDesktop ? 28 : 18,
                paddingVertical: isDesktop ? 28 : 18
              }}
            >
              <Text style={{ color: "#1f406b", fontSize: 11, letterSpacing: 2.2, textTransform: "uppercase" }}>
                Ingreso corporativo
              </Text>
              <Text style={{ marginTop: 8, color: "#001534", fontSize: 36, fontWeight: "700" }}>Entrar a SSD</Text>
              <Text style={{ marginTop: 10, color: "#1e3a5f", lineHeight: 24 }}>
                Usa tu cuenta corporativa de Pedersen para continuar.
              </Text>

              <Pressable
                onPress={handleMicrosoftLogin}
                disabled={isSigningIn || isLoading}
                style={{
                  marginTop: 18,
                  borderRadius: 24,
                  borderWidth: 1,
                  borderColor: isSigningIn || isLoading ? "#cbd5e1" : "#bfd2e7",
                  backgroundColor: "white",
                  paddingHorizontal: 16,
                  paddingVertical: 13,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  minHeight: 52,
                  opacity: isSigningIn || isLoading ? 0.7 : 1
                }}
              >
                {isSigningIn || isLoading ? (
                  <ActivityIndicator color="#1e3a5f" />
                ) : (
                  <>
                    <MicrosoftMark />
                    <Text style={{ color: "#001534", fontWeight: "700", fontSize: 14 }}>Entrar con cuenta corporativa</Text>
                  </>
                )}
              </Pressable>

              <Text
                style={{
                  marginTop: 12,
                  textAlign: "center",
                  color: "#64748b",
                  fontSize: 11,
                  letterSpacing: 1.4,
                  textTransform: "uppercase"
                }}
              >
                Supabase Auth + Microsoft Entra ID
              </Text>

              <Text style={{ marginTop: 10, color: "#334155", lineHeight: 21 }}>
                Validamos tu jefatura inmediata en Entra durante el ingreso para habilitar los flujos de aprobacion.
              </Text>

              {error || authError ? (
                <View
                  style={{
                    marginTop: 12,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: "#fecdd3",
                    backgroundColor: "#fff1f2",
                    paddingHorizontal: 12,
                    paddingVertical: 10
                  }}
                >
                  <Text style={{ color: "#be123c" }}>{error ?? authError}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
