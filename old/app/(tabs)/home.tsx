import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import { AppShell } from "@/src/components/AppShell";
import { SkeletonBlock } from "@/src/components/Skeleton";
import { useSession } from "@/src/context/SessionContext";
import {
  checkAdmin,
  getApproverInbox,
  getApproverProfile,
  getCatalog,
  getDashboardForActor,
  getRequests,
  getUserRoles
} from "@/src/lib/api";
import { formatDateTimePanama } from "@/src/lib/datetime";
import { buildPayloadHighlights, summarizePayloadValue } from "@/src/lib/requestPayload";
import { filterRequestTypesForUser } from "@/src/lib/requestTypes";
import { getStatusLabel } from "@/src/lib/status";
import { buildCurrentUser } from "@/src/lib/user";
import { AppUser, CatalogResponse, DashboardResponse, PendingApprovalItem, RequestItem } from "@/src/lib/types";

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= 1240;
  const { user } = useSession();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [inboxItems, setInboxItems] = useState<PendingApprovalItem[]>([]);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);

  useEffect(() => {
    let active = true;

    async function loadHome() {
      if (!user?.email) {
        if (active) {
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setError(null);
      const startedAt = Date.now();

      try {
        const [adminCheck, approverProfiles, userRoles, nextCatalog, nextDashboard, nextRequests, nextInbox] =
          await Promise.all([
            checkAdmin(user.email),
            getApproverProfile(user.email),
            getUserRoles(user.email),
            getCatalog(),
            getDashboardForActor(user.email),
            getRequests(undefined, user.email),
            getApproverInbox(user.email)
          ]);

        if (!active) {
          return;
        }

        const builtUser = buildCurrentUser(user.name, user.email, adminCheck.isAdmin, approverProfiles, userRoles, {
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

        setCurrentUser(builtUser);
        setCatalog(nextCatalog);
        setDashboard(nextDashboard);
        setRequests(nextRequests);
        setInboxItems(nextInbox);
      } catch {
        if (!active) {
          return;
        }
        setError("No se pudo cargar el home de SSD. Revisa EXPO_PUBLIC_API_URL.");
      } finally {
        if (active) {
          const minVisibleMs = 550;
          const elapsedMs = Date.now() - startedAt;
          const remainingMs = Math.max(0, minVisibleMs - elapsedMs);
          if (remainingMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, remainingMs));
          }
          setLoading(false);
        }
      }
    }

    void loadHome();

    return () => {
      active = false;
    };
  }, [
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

  const visibleRequestTypes = useMemo(() => {
    if (!catalog) {
      return [];
    }

    return filterRequestTypesForUser(catalog.requestTypes, currentUser);
  }, [catalog, currentUser?.canManagePeopleFlows]);

  return (
    <AppShell
      title="SSD | Home"
      subtitle="Portal corporativo para registrar solicitudes, gestionar aprobaciones y mantener trazabilidad operativa desde Pedersen Connect."
    >
      {loading ? (
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: isWide ? "row" : "column", gap: 12 }}>
            <View style={{ flex: isWide ? 1.2 : undefined, borderRadius: 32, borderWidth: 1, borderColor: "#bfd2e7", backgroundColor: "white", padding: 18, gap: 10 }}>
              <SkeletonBlock height={24} width={220} />
              <SkeletonBlock height={40} />
              <SkeletonBlock height={16} width="92%" />
              <SkeletonBlock height={16} width="78%" />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
                <SkeletonBlock height={92} width={170} />
                <SkeletonBlock height={92} width={170} />
                <SkeletonBlock height={92} width={170} />
              </View>
            </View>

            <View style={{ flex: isWide ? 0.8 : undefined, borderRadius: 32, borderWidth: 1, borderColor: "#bfd2e7", backgroundColor: "white", padding: 18, gap: 10 }}>
              <SkeletonBlock height={16} width={180} />
              <SkeletonBlock height={30} width="72%" />
              <SkeletonBlock height={16} width="60%" />
              <SkeletonBlock height={14} width="88%" />
              <SkeletonBlock height={14} width="75%" />
            </View>
          </View>

          <View style={{ borderRadius: 32, borderWidth: 1, borderColor: "#bfd2e7", backgroundColor: "white", padding: 18, gap: 8 }}>
            <SkeletonBlock height={16} width={180} />
            <SkeletonBlock height={56} />
            <SkeletonBlock height={56} />
            <SkeletonBlock height={56} />
          </View>
        </View>
      ) : null}

      {!loading && error ? (
        <View style={{ backgroundColor: "#fff1f2", borderColor: "#fecdd3", borderWidth: 1, borderRadius: 24, padding: 16 }}>
          <Text style={{ color: "#be123c", fontWeight: "700" }}>No se pudo cargar</Text>
          <Text style={{ color: "#9f1239", marginTop: 4 }}>{error}</Text>
        </View>
      ) : null}

      {!loading && !error ? (
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: isWide ? "row" : "column", gap: 12 }}>
            <View
              style={{
                flex: isWide ? 1.2 : undefined,
                borderRadius: 32,
                borderWidth: 1,
                borderColor: "#bfd2e7",
                backgroundColor: "white",
                padding: 18
              }}
            >
              <View
                style={{
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: "#9cb8d6",
                  backgroundColor: "#eaf6ff",
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  alignSelf: "flex-start"
                }}
              >
                <Text style={{ color: "#1e3a5f", fontSize: 10, letterSpacing: 2.4, textTransform: "uppercase" }}>
                  Sistema de Solicitudes Digital
                </Text>
              </View>

              <Text style={{ marginTop: 12, color: "#001534", fontSize: 32, fontWeight: "700", lineHeight: 38 }}>
                Un punto central para solicitudes de RRHH, compras, TI y aprobaciones ejecutivas.
              </Text>
              <Text style={{ marginTop: 8, color: "#1e3a5f", lineHeight: 24 }}>
                SSD es la subaplicacion de Pedersen Connect que centraliza solicitudes empresariales, aprobaciones por rol y notificaciones institucionales.
              </Text>

              <View style={{ marginTop: 14, flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                <View style={{ borderRadius: 24, borderWidth: 1, borderColor: "#d7e4f2", backgroundColor: "#f5faff", padding: 14, minWidth: 176 }}>
                  <Text style={{ color: "#64748b", fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase" }}>
                    Solicitudes registradas
                  </Text>
                  <Text style={{ marginTop: 4, color: "#001534", fontSize: 30, fontWeight: "700" }}>{requests.length}</Text>
                </View>

                <View style={{ borderRadius: 24, borderWidth: 1, borderColor: "#d7e4f2", backgroundColor: "#f5faff", padding: 14, minWidth: 176 }}>
                  <Text style={{ color: "#64748b", fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase" }}>
                    Pendientes en tu bandeja
                  </Text>
                  <Text style={{ marginTop: 4, color: "#001534", fontSize: 30, fontWeight: "700" }}>{inboxItems.length}</Text>
                </View>

                <View style={{ borderRadius: 24, borderWidth: 1, borderColor: "#d7e4f2", backgroundColor: "#f5faff", padding: 14, minWidth: 176 }}>
                  <Text style={{ color: "#64748b", fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase" }}>
                    Tipos disponibles
                  </Text>
                  <Text style={{ marginTop: 4, color: "#001534", fontSize: 30, fontWeight: "700" }}>{visibleRequestTypes.length}</Text>
                </View>
              </View>

              <View style={{ marginTop: 12, flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                <Pressable onPress={() => router.push("/catalogo")} style={{ borderRadius: 999, backgroundColor: "#1e3a5f", paddingHorizontal: 16, paddingVertical: 10 }}>
                  <Text style={{ color: "white", fontWeight: "700" }}>Ir al catalogo</Text>
                </Pressable>
                <Pressable onPress={() => router.push("/inbox")} style={{ borderRadius: 999, borderWidth: 1, borderColor: "#bfd2e7", backgroundColor: "white", paddingHorizontal: 16, paddingVertical: 10 }}>
                  <Text style={{ color: "#1e3a5f", fontWeight: "700" }}>Abrir bandeja</Text>
                </Pressable>
              </View>
            </View>

            <View
              style={{
                flex: isWide ? 0.8 : undefined,
                borderRadius: 32,
                borderWidth: 1,
                borderColor: "#bfd2e7",
                backgroundColor: "white",
                padding: 18
              }}
            >
              <Text style={{ color: "#1f406b", fontSize: 11, letterSpacing: 2.2, textTransform: "uppercase" }}>Tu perfil operativo</Text>
              <Text style={{ marginTop: 5, color: "#001534", fontSize: 24, fontWeight: "700" }}>{currentUser?.name ?? user?.name ?? "Usuario"}</Text>
              <Text style={{ marginTop: 2, color: "#64748b" }}>{currentUser?.email ?? user?.email ?? ""}</Text>

              <View style={{ marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {(currentUser?.roleLabels?.length ? currentUser.roleLabels : ["Colaborador"]).map((role) => (
                  <View key={role} style={{ borderRadius: 999, borderWidth: 1, borderColor: "#d7e4f2", backgroundColor: "#f5faff", paddingHorizontal: 10, paddingVertical: 6 }}>
                    <Text style={{ color: "#334155", fontWeight: "600", fontSize: 12 }}>{role}</Text>
                  </View>
                ))}
              </View>

              <Text style={{ marginTop: 10, color: "#475569", lineHeight: 22 }}>
                {currentUser?.canManagePeopleFlows
                  ? "Tienes acceso a solicitudes sensibles de personal y desvinculacion."
                  : "Tu catalogo muestra solo las solicitudes habilitadas para tu perfil actual."}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: isWide ? "row" : "column", gap: 12 }}>
            <View
              style={{
                flex: isWide ? 0.9 : undefined,
                borderRadius: 32,
                borderWidth: 1,
                borderColor: "#bfd2e7",
                backgroundColor: "white",
                padding: 18
              }}
            >
              <Text style={{ color: "#1f406b", fontSize: 11, letterSpacing: 2.2, textTransform: "uppercase" }}>Catalogo rapido</Text>
              <View style={{ marginTop: 10, gap: 8 }}>
                {visibleRequestTypes.map((type) => (
                  <Pressable
                    key={type.code}
                    onPress={() => router.push(`/solicitudes/${encodeURIComponent(type.code)}` as never)}
                    style={{ borderRadius: 24, borderWidth: 1, borderColor: "#d7e4f2", backgroundColor: "#f5faff", padding: 14 }}
                  >
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: "#001534", fontWeight: "700", fontSize: 18 }}>{type.name}</Text>
                        <Text style={{ color: "#1e3a5f", marginTop: 5, lineHeight: 21 }}>{type.description}</Text>
                      </View>
                      <View style={{ width: 4, borderRadius: 999, backgroundColor: type.theme_color || "#0b5ed7", minHeight: 40 }} />
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>

            <View
              style={{
                flex: isWide ? 1.1 : undefined,
                borderRadius: 32,
                borderWidth: 1,
                borderColor: "#bfd2e7",
                backgroundColor: "white",
                padding: 18
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <Text style={{ color: "#1f406b", fontSize: 11, letterSpacing: 2.2, textTransform: "uppercase" }}>
                  Ultimas solicitudes
                </Text>
                <Pressable onPress={() => router.push("/catalogo")}>
                  <Text style={{ color: "#1e3a5f", fontWeight: "700" }}>Nueva solicitud</Text>
                </Pressable>
              </View>

              <View style={{ marginTop: 10, gap: 8 }}>
                {requests.slice(0, 10).map((item) => {
                  const payloadHighlights = buildPayloadHighlights(item.payload, 2);

                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => router.push(`/requests/${item.id}`)}
                      style={{ borderRadius: 24, borderWidth: 1, borderColor: "#d7e4f2", backgroundColor: "#f5faff", padding: 14 }}
                    >
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: "#64748b", fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase" }}>
                            {item.ticket_code}
                          </Text>
                          <Text style={{ color: "#001534", marginTop: 3, fontWeight: "700", fontSize: 20 }}>
                            {item.subject}
                          </Text>
                          <Text style={{ marginTop: 7, color: "#1e3a5f" }}>{item.request_type_name}</Text>
                          <Text style={{ marginTop: 4, color: "#64748b", fontSize: 12 }}>
                            {item.department} | {formatDateTimePanama(item.created_at)}
                          </Text>
                        </View>
                        <View style={{ borderRadius: 999, borderWidth: 1, borderColor: "#bfdbfe", backgroundColor: "#eff6ff", paddingHorizontal: 10, paddingVertical: 5 }}>
                          <Text style={{ color: "#1e3a8a", fontWeight: "700", fontSize: 12 }}>{getStatusLabel(item.status)}</Text>
                        </View>
                      </View>

                      {payloadHighlights.length > 0 ? (
                        <View style={{ marginTop: 8, gap: 4 }}>
                          {payloadHighlights.map((highlight) => (
                            <Text key={`${item.id}-${highlight.key}`} style={{ color: "#334155", fontSize: 12 }}>
                              {highlight.label}: {summarizePayloadValue(highlight.display)}
                            </Text>
                          ))}
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}

                {requests.length === 0 ? (
                  <View style={{ borderRadius: 24, borderWidth: 1, borderColor: "#d7e4f2", backgroundColor: "#f5faff", padding: 14 }}>
                    <Text style={{ color: "#475569" }}>No hay solicitudes recientes.</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>

          <View style={{ borderRadius: 32, borderWidth: 1, borderColor: "#bfd2e7", backgroundColor: "white", padding: 18 }}>
            <Text style={{ color: "#1f406b", fontSize: 11, letterSpacing: 2.2, textTransform: "uppercase" }}>Analitica operativa</Text>
            <View style={{ marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {(dashboard?.byType ?? []).map((item) => (
                <View key={item.name} style={{ borderRadius: 24, borderWidth: 1, borderColor: "#d7e4f2", backgroundColor: "#f5faff", padding: 14, minWidth: 220 }}>
                  <Text style={{ color: "#001534", fontWeight: "700", fontSize: 16 }}>{item.name}</Text>
                  <Text style={{ marginTop: 3, color: "#1e3a5f" }}>{item.total} solicitudes</Text>
                </View>
              ))}

              {(dashboard?.byType ?? []).length === 0 ? (
                <View style={{ borderRadius: 24, borderWidth: 1, borderColor: "#d7e4f2", backgroundColor: "#f5faff", padding: 14 }}>
                  <Text style={{ color: "#475569" }}>No hay datos analiticos por tipo.</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      ) : null}
    </AppShell>
  );
}



