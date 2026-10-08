import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { AppShell } from "@/src/components/AppShell";
import { ScreenSkeletonCard } from "@/src/components/Skeleton";
import { useSession } from "@/src/context/SessionContext";
import { formatDateTimePanama } from "@/src/lib/datetime";
import { getRequests } from "@/src/lib/api";
import { getStatusLabel } from "@/src/lib/status";
import { RequestItem } from "@/src/lib/types";

export default function RequestsScreen() {
  const { user } = useSession();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<RequestItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      return;
    }

    const startedAt = Date.now();

    getRequests(user.email)
      .then(setItems)
      .catch(() => setError("No se pudieron cargar tus solicitudes."))
      .finally(async () => {
        const minVisibleMs = 450;
        const elapsedMs = Date.now() - startedAt;
        const remainingMs = Math.max(0, minVisibleMs - elapsedMs);
        if (remainingMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, remainingMs));
        }
        setLoading(false);
      });
  }, [user]);

  return (
    <AppShell
      title="SSD | Mis solicitudes"
      subtitle="Consulta el estado de tus tickets, su trazabilidad y el avance del flujo de aprobacion."
    >
      {loading ? (
        <ScreenSkeletonCard rows={6} />
      ) : null}

      {!loading && error ? (
        <View style={{ backgroundColor: "#fff1f2", borderColor: "#fecdd3", borderWidth: 1, borderRadius: 24, padding: 16 }}>
          <Text style={{ color: "#be123c", fontWeight: "700" }}>No se pudo cargar</Text>
          <Text style={{ color: "#9f1239", marginTop: 4 }}>{error}</Text>
        </View>
      ) : null}

      {!loading && !error ? (
        <View style={{ borderRadius: 32, borderWidth: 1, borderColor: "#bfd2e7", backgroundColor: "white", padding: 18, gap: 10 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <View>
              <Text style={{ color: "#1f406b", fontSize: 11, letterSpacing: 2.2, textTransform: "uppercase" }}>Historial personal</Text>
              <Text style={{ marginTop: 5, color: "#001534", fontSize: 24, fontWeight: "700" }}>Solicitudes registradas por ti</Text>
            </View>
            <Pressable onPress={() => router.push("/catalogo")} style={{ borderRadius: 999, backgroundColor: "#1e3a5f", paddingHorizontal: 14, paddingVertical: 9 }}>
              <Text style={{ color: "white", fontWeight: "700" }}>Nueva</Text>
            </Pressable>
          </View>

          {items.length === 0 ? (
            <View style={{ borderRadius: 24, borderWidth: 1, borderColor: "#d7e4f2", backgroundColor: "#f5faff", padding: 14 }}>
              <Text style={{ color: "#475569" }}>Aun no has creado solicitudes en SSD.</Text>
            </View>
          ) : (
            items.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => router.push(`/requests/${item.id}`)}
                style={{ borderRadius: 24, borderWidth: 1, borderColor: "#d7e4f2", backgroundColor: "#f5faff", padding: 14 }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: "#64748b", fontSize: 11, letterSpacing: 1.3, textTransform: "uppercase" }}>{item.ticket_code}</Text>
                    <Text style={{ color: "#001534", marginTop: 3, fontWeight: "700", fontSize: 20 }}>{item.subject}</Text>
                    <Text style={{ marginTop: 7, color: "#1e3a5f" }}>
                      {item.request_type_name} | {item.department}
                    </Text>
                  </View>
                  <View style={{ borderRadius: 999, borderWidth: 1, borderColor: "#bfdbfe", backgroundColor: "#eff6ff", paddingHorizontal: 10, paddingVertical: 5 }}>
                    <Text style={{ color: "#1e3a8a", fontWeight: "700", fontSize: 12 }}>{getStatusLabel(item.status)}</Text>
                  </View>
                </View>
                <Text style={{ color: "#64748b", marginTop: 10, fontSize: 12 }}>
                  Registrada: {formatDateTimePanama(item.created_at)}
                </Text>
              </Pressable>
            ))
          )}
        </View>
      ) : null}
    </AppShell>
  );
}
