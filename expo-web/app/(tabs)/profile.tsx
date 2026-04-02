import { useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { AppShell } from "@/src/components/AppShell";
import { ScreenSkeletonCard } from "@/src/components/Skeleton";
import { useSession } from "@/src/context/SessionContext";
import { checkAdmin, getApproverInbox, getApproverProfile, getCatalog, getUserRoles } from "@/src/lib/api";
import { buildCurrentUser } from "@/src/lib/user";
import { AppUser, ApproverProfile } from "@/src/lib/types";

function displayValue(value?: string | null) {
  return value && value.trim() ? value : "No disponible";
}

export default function ProfileScreen() {
  const { user } = useSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [approverProfiles, setApproverProfiles] = useState<ApproverProfile[]>([]);
  const [inboxCount, setInboxCount] = useState(0);

  useEffect(() => {
    if (!user?.email) {
      setLoading(false);
      return;
    }

    let active = true;

    const loadProfile = async () => {
      const startedAt = Date.now();
      setError(null);

      try {
        const [adminCheck, nextApproverProfiles, userRoles, catalog, inboxItems] = await Promise.all([
          checkAdmin(user.email),
          getApproverProfile(user.email),
          getUserRoles(user.email),
          getCatalog(),
          getApproverInbox(user.email)
        ]);

        if (!active) {
          return;
        }

        const builtUser = buildCurrentUser(user.name, user.email, adminCheck.isAdmin, nextApproverProfiles, userRoles, {
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

        const visibleTypes = catalog.requestTypes.filter(
          (type) => !["PERSONNEL_REQUEST", "TERMINATION_REQUEST"].includes(type.code) || builtUser.canManagePeopleFlows
        );

        setCurrentUser(builtUser);
        setApproverProfiles(nextApproverProfiles);
        setInboxCount(inboxItems.length);

        if (visibleTypes.length === 0) {
          setError("No hay tipos de solicitud visibles para tu perfil en este momento.");
        }
      } catch {
        if (!active) {
          return;
        }
        setError("No se pudo cargar el perfil operativo.");
      } finally {
        if (!active) {
          return;
        }

        const minVisibleMs = 500;
        const elapsedMs = Date.now() - startedAt;
        const remainingMs = Math.max(0, minVisibleMs - elapsedMs);
        if (remainingMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, remainingMs));
        }
        setLoading(false);
      }
    };

    void loadProfile();

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

  const roleLabels = useMemo(() => {
    if (!currentUser?.roleLabels?.length) {
      return ["Colaborador"];
    }
    return currentUser.roleLabels;
  }, [currentUser?.roleLabels]);

  return (
    <AppShell
      title="SSD | Perfil"
      subtitle="Consulta tu identidad corporativa, roles detectados y el alcance operativo habilitado dentro de SSD."
    >
      {loading ? <ScreenSkeletonCard rows={7} /> : null}

      {!loading && error ? (
        <View style={{ backgroundColor: "#fff1f2", borderColor: "#fecdd3", borderWidth: 1, borderRadius: 24, padding: 16 }}>
          <Text style={{ color: "#be123c", fontWeight: "700" }}>No se pudo cargar</Text>
          <Text style={{ color: "#9f1239", marginTop: 4 }}>{error}</Text>
        </View>
      ) : null}

      {!loading && currentUser ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          <View
            style={{
              flex: 1,
              minWidth: 300,
              borderRadius: 32,
              borderWidth: 1,
              borderColor: "#d7e4f2",
              backgroundColor: "white",
              padding: 16
            }}
          >
            <Text style={{ color: "#1f406b", fontSize: 11, letterSpacing: 2.2, textTransform: "uppercase" }}>Identidad</Text>
            <Text style={{ marginTop: 6, color: "#001534", fontSize: 28, fontWeight: "700" }}>{currentUser.name}</Text>
            <Text style={{ marginTop: 2, color: "#475569" }}>{currentUser.email}</Text>

            <View style={{ marginTop: 12, gap: 8 }}>
              <View style={{ borderRadius: 22, borderWidth: 1, borderColor: "#d7e4f2", backgroundColor: "#f5faff", padding: 12 }}>
                <Text style={{ color: "#64748b", fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase" }}>Administrador</Text>
                <Text style={{ marginTop: 4, color: "#001534", fontWeight: "700" }}>{currentUser.isAdmin ? "Si" : "No"}</Text>
              </View>
              <View style={{ borderRadius: 22, borderWidth: 1, borderColor: "#d7e4f2", backgroundColor: "#f5faff", padding: 12 }}>
                <Text style={{ color: "#64748b", fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase" }}>Aprobador</Text>
                <Text style={{ marginTop: 4, color: "#001534", fontWeight: "700" }}>{currentUser.isApprover ? "Si" : "No"}</Text>
              </View>
              <View style={{ borderRadius: 22, borderWidth: 1, borderColor: "#d7e4f2", backgroundColor: "#f5faff", padding: 12 }}>
                <Text style={{ color: "#64748b", fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase" }}>
                  Acceso a personal y desvinculacion
                </Text>
                <Text style={{ marginTop: 4, color: "#001534", fontWeight: "700" }}>
                  {currentUser.canManagePeopleFlows ? "Habilitado" : "Restringido"}
                </Text>
              </View>
            </View>
          </View>

          <View
            style={{
              flex: 1.2,
              minWidth: 320,
              borderRadius: 32,
              borderWidth: 1,
              borderColor: "#d7e4f2",
              backgroundColor: "white",
              padding: 16
            }}
          >
            <Text style={{ color: "#1f406b", fontSize: 11, letterSpacing: 2.2, textTransform: "uppercase" }}>
              Informacion del trabajo
            </Text>

            <View style={{ marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <View style={{ minWidth: 220, flex: 1, borderRadius: 22, borderWidth: 1, borderColor: "#d7e4f2", backgroundColor: "#f5faff", padding: 12 }}>
                <Text style={{ color: "#64748b", fontSize: 11, textTransform: "uppercase", letterSpacing: 1.2 }}>Puesto</Text>
                <Text style={{ marginTop: 4, color: "#0f172a", fontWeight: "700" }}>{displayValue(currentUser.jobTitle)}</Text>
              </View>
              <View style={{ minWidth: 220, flex: 1, borderRadius: 22, borderWidth: 1, borderColor: "#d7e4f2", backgroundColor: "#f5faff", padding: 12 }}>
                <Text style={{ color: "#64748b", fontSize: 11, textTransform: "uppercase", letterSpacing: 1.2 }}>Unidad de negocio</Text>
                <Text style={{ marginTop: 4, color: "#0f172a", fontWeight: "700" }}>{displayValue(currentUser.companyName)}</Text>
              </View>
              <View style={{ minWidth: 220, flex: 1, borderRadius: 22, borderWidth: 1, borderColor: "#d7e4f2", backgroundColor: "#f5faff", padding: 12 }}>
                <Text style={{ color: "#64748b", fontSize: 11, textTransform: "uppercase", letterSpacing: 1.2 }}>Departamento</Text>
                <Text style={{ marginTop: 4, color: "#0f172a", fontWeight: "700" }}>{displayValue(currentUser.department)}</Text>
              </View>
              <View style={{ minWidth: 220, flex: 1, borderRadius: 22, borderWidth: 1, borderColor: "#d7e4f2", backgroundColor: "#f5faff", padding: 12 }}>
                <Text style={{ color: "#64748b", fontSize: 11, textTransform: "uppercase", letterSpacing: 1.2 }}>Ubicacion</Text>
                <Text style={{ marginTop: 4, color: "#0f172a", fontWeight: "700" }}>{displayValue(currentUser.officeLocation)}</Text>
              </View>
              <View style={{ minWidth: 220, flex: 1, borderRadius: 22, borderWidth: 1, borderColor: "#d7e4f2", backgroundColor: "#f5faff", padding: 12 }}>
                <Text style={{ color: "#64748b", fontSize: 11, textTransform: "uppercase", letterSpacing: 1.2 }}>Jefe/Supervisor Directo</Text>
                <Text style={{ marginTop: 4, color: "#0f172a", fontWeight: "700" }}>
                  {currentUser.managerName || currentUser.managerEmail
                    ? `${currentUser.managerName ?? "Jefatura directa"}${currentUser.managerEmail ? ` | ${currentUser.managerEmail}` : ""}`
                    : "No disponible"}
                </Text>
              </View>
            </View>

            <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: "#e2e8f0", paddingTop: 12, gap: 8 }}>
              <Text style={{ color: "#1f406b", fontSize: 11, letterSpacing: 2.2, textTransform: "uppercase" }}>Roles detectados</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {roleLabels.map((role) => (
                  <View key={role} style={{ borderRadius: 999, borderWidth: 1, borderColor: "#d7e4f2", backgroundColor: "#f5faff", paddingHorizontal: 10, paddingVertical: 6 }}>
                    <Text style={{ color: "#334155", fontWeight: "600", fontSize: 12 }}>{role}</Text>
                  </View>
                ))}
              </View>

              <Text style={{ marginTop: 6, color: "#0f172a", fontWeight: "700" }}>Perfiles de aprobacion</Text>
              <View style={{ gap: 6 }}>
                {approverProfiles.length === 0 ? (
                  <View style={{ borderRadius: 18, borderWidth: 1, borderColor: "#d7e4f2", backgroundColor: "#f8fafc", padding: 10 }}>
                    <Text style={{ color: "#475569" }}>No tienes perfiles de aprobacion configurados en SSD.</Text>
                  </View>
                ) : (
                  approverProfiles.map((profile) => (
                    <View key={profile.id} style={{ borderRadius: 18, borderWidth: 1, borderColor: "#d7e4f2", backgroundColor: "#f8fafc", padding: 10 }}>
                      <Text style={{ color: "#001534", fontWeight: "700" }}>{profile.title}</Text>
                      <Text style={{ marginTop: 2, color: "#475569" }}>
                        {profile.department ?? profile.scope} | {profile.role_code}
                      </Text>
                    </View>
                  ))
                )}
              </View>

              <Text style={{ color: "#64748b", marginTop: 4, fontSize: 12 }}>Pendientes en bandeja: {inboxCount}</Text>
            </View>
          </View>
        </View>
      ) : null}
    </AppShell>
  );
}
