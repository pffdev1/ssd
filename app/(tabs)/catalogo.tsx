import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Redirect, router } from "expo-router";
import { AppShell } from "@/src/components/AppShell";
import { ScreenSkeletonCard } from "@/src/components/Skeleton";
import { useSession } from "@/src/context/SessionContext";
import { getApproverProfile, getCatalog, getUserRoles } from "@/src/lib/api";
import { filterRequestTypesForUser } from "@/src/lib/requestTypes";
import { buildCurrentUser } from "@/src/lib/user";
import { RequestType } from "@/src/lib/types";

export default function CatalogScreen() {
  const { user, isAdmin } = useSession();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<RequestType[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    if (!user?.email) {
      setLoading(false);
      return;
    }

    const startedAt = Date.now();

    Promise.all([getCatalog(), getApproverProfile(user.email), getUserRoles(user.email)])
      .then(([catalog, approverProfiles, userRoles]) => {
        if (!active) {
          return;
        }

        const currentUser = buildCurrentUser(user.name, user.email, Boolean(isAdmin), approverProfiles, userRoles, {
          companyName: user.companyName,
          department: user.department,
          jobTitle: user.jobTitle,
          employeeId: user.employeeId,
          employeeType: user.employeeType,
          employeeHireDate: user.employeeHireDate,
          officeLocation: user.officeLocation,
          managerEmail: user.managerEmail,
          managerName: user.managerName,
          managerTitle: user.managerTitle,
          sponsors: user.sponsors
        });

        setItems(filterRequestTypesForUser(catalog.requestTypes, currentUser));
      })
      .catch(() => setError("No se pudo cargar el catalogo de solicitudes."))
      .finally(async () => {
        const minVisibleMs = 450;
        const elapsedMs = Date.now() - startedAt;
        const remainingMs = Math.max(0, minVisibleMs - elapsedMs);
        if (remainingMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, remainingMs));
        }
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [
    isAdmin,
    user?.companyName,
    user?.department,
    user?.email,
    user?.employeeHireDate,
    user?.employeeId,
    user?.employeeType,
    user?.jobTitle,
    user?.managerEmail,
    user?.managerName,
    user?.managerTitle,
    user?.name,
    user?.officeLocation,
    user?.sponsors
  ]);

  if (!user) {
    return <Redirect href="/login" />;
  }

  return (
    <AppShell
      title="SSD | Catalogo de solicitudes"
      subtitle="Selecciona la solicitud correspondiente, completa el formulario y SSD ejecutara la ruta de aprobacion definida."
    >
      {loading ? (
        <ScreenSkeletonCard rows={5} />
      ) : null}

      {!loading && error ? (
        <View style={{ backgroundColor: "#fff1f2", borderColor: "#fecdd3", borderWidth: 1, borderRadius: 24, padding: 16 }}>
          <Text style={{ color: "#be123c", fontWeight: "700" }}>No se pudo cargar</Text>
          <Text style={{ color: "#9f1239", marginTop: 4 }}>{error}</Text>
        </View>
      ) : null}

      {!loading && !error ? (
        <View style={{ borderRadius: 32, borderWidth: 1, borderColor: "#bfd2e7", backgroundColor: "white", padding: 18, gap: 10 }}>
          <Text style={{ color: "#1f406b", fontSize: 11, letterSpacing: 2.2, textTransform: "uppercase" }}>Solicitudes disponibles</Text>
          <Text style={{ color: "#001534", fontSize: 30, fontWeight: "700" }}>{items.length}</Text>

          {items.length === 0 ? (
            <View style={{ borderRadius: 24, borderWidth: 1, borderColor: "#d7e4f2", backgroundColor: "#f5faff", padding: 14 }}>
              <Text style={{ color: "#475569" }}>No hay solicitudes disponibles.</Text>
            </View>
          ) : (
            items.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => router.push(`/solicitudes/${item.code}`)}
                style={{ borderRadius: 24, borderWidth: 1, borderColor: "#d7e4f2", backgroundColor: "#f5faff", padding: 14 }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: "#001534", fontWeight: "700", fontSize: 18 }}>{item.name}</Text>
                    <Text style={{ color: "#1e3a5f", marginTop: 5, lineHeight: 21 }}>{item.description}</Text>
                    <Text style={{ color: "#64748b", marginTop: 8, fontSize: 12 }}>Categoria: {item.category}</Text>
                  </View>
                  <View style={{ width: 4, borderRadius: 999, backgroundColor: item.theme_color || "#0b5ed7", minHeight: 40 }} />
                </View>
              </Pressable>
            ))
          )}
        </View>
      ) : null}
    </AppShell>
  );
}
