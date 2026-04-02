import { ReactNode, useEffect, useState } from "react";
import { router, usePathname } from "expo-router";
import { Image, Pressable, SafeAreaView, ScrollView, Text, View, TextStyle, ViewStyle, useWindowDimensions } from "react-native";
import { useSession } from "@/src/context/SessionContext";
import { getApproverInbox, getApproverProfile, getCatalog, getUserRoles } from "@/src/lib/api";
import { buildCurrentUser } from "@/src/lib/user";
import { RequestType } from "@/src/lib/types";

type AppShellProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
};

const restrictedTypeCodes = new Set(["PERSONNEL_REQUEST", "TERMINATION_REQUEST"]);

const brandLogo = require("../../assets/brand/pedersen-connect-logo.png");

function isHomeActive(pathname: string) {
  return pathname === "/" || pathname === "/(tabs)" || pathname === "/(tabs)/home";
}

function isCatalogActive(pathname: string) {
  return pathname.startsWith("/catalogo") || pathname.startsWith("/(tabs)/catalogo") || pathname.startsWith("/solicitudes/");
}

function isRequestsActive(pathname: string) {
  return pathname.startsWith("/mis-solicitudes") || pathname.startsWith("/(tabs)/requests") || pathname.startsWith("/request/") || pathname.startsWith("/requests/");
}

function isInboxActive(pathname: string) {
  return pathname.startsWith("/inbox") || pathname.startsWith("/(tabs)/inbox");
}

function isAccountActive(pathname: string) {
  return pathname.startsWith("/perfil") || pathname.startsWith("/(tabs)/profile") || pathname.startsWith("/admin") || pathname.startsWith("/(tabs)/admin");
}

function navButtonStyle(active: boolean): ViewStyle {
  return {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: active ? "#5d97ff" : "#99bde6",
    backgroundColor: active ? "#dcecff" : "rgba(255,255,255,0.14)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  };
}

function navTextStyle(active: boolean): TextStyle {
  return {
    color: active ? "#0b5ed7" : "white",
    fontWeight: active ? "700" : "500",
    fontSize: 13
  };
}

function navIconCircleStyle(active: boolean): ViewStyle {
  return {
    width: 20,
    height: 20,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: active ? "#93c5fd" : "#bcd2ed",
    backgroundColor: active ? "#eff6ff" : "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center"
  };
}

function MenuDot({ color }: { color: string }) {
  return (
    <View
      style={{
        width: 7,
        height: 7,
        borderRadius: 99,
        backgroundColor: color
      }}
    />
  );
}

function UserGlyph({ color }: { color: string }) {
  return (
    <View style={{ width: 14, height: 14, alignItems: "center" }}>
      <View style={{ width: 5, height: 5, borderRadius: 99, backgroundColor: color }} />
      <View style={{ marginTop: 2, width: 10, height: 5, borderRadius: 99, backgroundColor: color }} />
    </View>
  );
}

function BellGlyph({ color }: { color: string }) {
  return (
    <View style={{ width: 14, height: 14, alignItems: "center", justifyContent: "center" }}>
      <View
        style={{
          width: 10,
          height: 8,
          borderWidth: 1.5,
          borderColor: color,
          borderTopLeftRadius: 6,
          borderTopRightRadius: 6,
          borderBottomLeftRadius: 2,
          borderBottomRightRadius: 2,
          backgroundColor: "transparent"
        }}
      />
      <View style={{ marginTop: 1, width: 8, height: 1.5, borderRadius: 99, backgroundColor: color }} />
      <View
        style={{
          position: "absolute",
          bottom: 1,
          width: 2.8,
          height: 2.8,
          borderRadius: 99,
          backgroundColor: color
        }}
      />
    </View>
  );
}

export function AppShell({ title, subtitle, children }: AppShellProps) {
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const { user, signOut, isAdmin } = useSession();
  const [accountOpen, setAccountOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [menuLoading, setMenuLoading] = useState(true);
  const [inboxCount, setInboxCount] = useState(0);
  const [visibleRequestTypes, setVisibleRequestTypes] = useState<RequestType[]>([]);

  useEffect(() => {
    setAccountOpen(false);
    setCatalogOpen(false);
  }, [pathname]);

  useEffect(() => {
    let active = true;

    async function loadMenuData() {
      if (!user?.email) {
        if (active) {
          setMenuLoading(false);
          setVisibleRequestTypes([]);
          setInboxCount(0);
        }
        return;
      }

      if (active) {
        setMenuLoading(true);
      }

      try {
        const [catalog, inboxItems, approverProfiles, userRoles] = await Promise.all([
          getCatalog(),
          getApproverInbox(user.email),
          getApproverProfile(user.email),
          getUserRoles(user.email)
        ]);

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

        const filteredRequestTypes = catalog.requestTypes.filter(
          (type) => !restrictedTypeCodes.has(type.code) || Boolean(currentUser.canManagePeopleFlows)
        );

        setVisibleRequestTypes(filteredRequestTypes);
        setInboxCount(inboxItems.length);
      } catch {
        if (!active) {
          return;
        }
        setVisibleRequestTypes([]);
        setInboxCount(0);
      } finally {
        if (active) {
          setMenuLoading(false);
        }
      }
    }

    void loadMenuData();

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

  async function handleSignOut() {
    setAccountOpen(false);
    setCatalogOpen(false);
    try {
      await signOut();
    } finally {
      router.replace("/login");
    }
  }

  function handleGoProfile() {
    setAccountOpen(false);
    setCatalogOpen(false);
    router.navigate("/perfil");
  }

  function handleGoAdmin() {
    setAccountOpen(false);
    setCatalogOpen(false);
    router.navigate("/admin");
  }

  const homeActive = isHomeActive(pathname);
  const catalogActive = isCatalogActive(pathname);
  const requestsActive = isRequestsActive(pathname);
  const inboxActive = isInboxActive(pathname);
  const accountActive = accountOpen || isAccountActive(pathname);
  const unreadLabel = inboxCount > 99 ? "99+" : String(inboxCount);
  const accountMenuWidth = Math.min(280, Math.max(220, width - 52));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#dbe7f5" }}>
      <ScrollView
        contentContainerStyle={{
          maxWidth: 1600,
          width: "100%",
          alignSelf: "center",
          paddingHorizontal: 16,
          paddingVertical: 18,
          gap: 14
        }}
      >
        <View
          style={{
            position: "relative",
            overflow: "visible",
            zIndex: 20,
            borderRadius: 32,
            borderWidth: 1,
            borderColor: "#3c68a8",
            paddingHorizontal: 18,
            paddingVertical: 18,
            backgroundColor: "#0b5ed7"
          }}
        >
          <View
            style={{
              position: "absolute",
              right: -72,
              top: -64,
              width: 190,
              height: 190,
              borderRadius: 999,
              backgroundColor: "rgba(255,255,255,0.11)"
            }}
          />
          <View
            style={{
              position: "absolute",
              left: -98,
              bottom: -102,
              width: 220,
              height: 220,
              borderRadius: 999,
              backgroundColor: "rgba(0,21,52,0.14)"
            }}
          />

          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10, zIndex: 30 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  overflow: "hidden",
                  borderWidth: 1,
                  borderColor: "#d7e4f2",
                  backgroundColor: "white"
                }}
              >
                <Image source={brandLogo} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#d8e8ff", fontSize: 10, letterSpacing: 2.8, textTransform: "uppercase" }}>
                  Pedersen Connect
                </Text>
                <Text style={{ color: "white", fontWeight: "700", marginTop: 2, fontSize: 14 }}>
                  Sistema de Solicitudes Digital
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Pressable
                onPress={() => {
                  setCatalogOpen(false);
                  setAccountOpen(false);
                  router.push("/(tabs)/inbox");
                }}
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: inboxActive ? "#8bb8ff" : "#8caed8",
                  backgroundColor: inboxActive ? "#dcecff" : "rgba(255,255,255,0.12)",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <BellGlyph color={inboxActive ? "#0b5ed7" : "white"} />
                {inboxCount > 0 ? (
                  <View
                    style={{
                      position: "absolute",
                      right: -3,
                      top: -3,
                      minWidth: 20,
                      borderRadius: 999,
                      backgroundColor: "white",
                      alignItems: "center",
                      justifyContent: "center",
                      paddingHorizontal: 5,
                      paddingVertical: 2
                    }}
                  >
                    <Text style={{ color: "#0b5ed7", fontWeight: "700", fontSize: 11 }}>{unreadLabel}</Text>
                  </View>
                ) : null}
              </Pressable>

              <View style={{ position: "relative" }}>
                <Pressable
                  onPress={() => {
                    setCatalogOpen(false);
                    setAccountOpen((value) => !value);
                  }}
                  style={{
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: accountActive ? "#5d97ff" : "#8caed8",
                    backgroundColor: accountActive ? "#dcecff" : "rgba(255,255,255,0.12)",
                    paddingHorizontal: 10,
                    paddingVertical: 7,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8
                  }}
                >
                  <View
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: accountActive ? "#93c5fd" : "#bcd2ed",
                      backgroundColor: accountActive ? "#eff6ff" : "rgba(255,255,255,0.22)",
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                  >
                    <UserGlyph color={accountActive ? "#0b5ed7" : "white"} />
                  </View>

                  <View>
                    <Text style={{ color: accountActive ? "#0b5ed7" : "white", fontWeight: "700", fontSize: 12 }}>
                      {user?.name ?? "Cuenta"}
                    </Text>
                    <Text style={{ color: accountActive ? "#52708f" : "#dbe7f8", fontSize: 10 }}>
                      {user?.email ?? ""}
                    </Text>
                  </View>

                  <Text style={{ color: accountActive ? "#0b5ed7" : "white", fontWeight: "700", fontSize: 12 }}>
                    {accountOpen ? "^" : "v"}
                  </Text>
                </Pressable>

              </View>
            </View>
          </View>

          {accountOpen ? (
            <View style={{ marginTop: 10, alignItems: "flex-end", zIndex: 40 }}>
              <View
                style={{
                  width: accountMenuWidth,
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: "#bfd2e7",
                  backgroundColor: "white",
                  padding: 8,
                  gap: 6
                }}
              >
                <Pressable
                  onPress={handleGoProfile}
                  style={{
                    borderRadius: 12,
                    backgroundColor: pathname.startsWith("/perfil") || pathname.startsWith("/(tabs)/profile") ? "#e9f2ff" : "white",
                    paddingHorizontal: 12,
                    paddingVertical: 10
                  }}
                >
                  <Text style={{ color: "#1e3a5f", fontWeight: "700" }}>Perfil</Text>
                </Pressable>

                {isAdmin ? (
                  <Pressable
                    onPress={handleGoAdmin}
                    style={{
                      borderRadius: 12,
                      backgroundColor: pathname.startsWith("/admin") || pathname.startsWith("/(tabs)/admin") ? "#e9f2ff" : "white",
                      paddingHorizontal: 12,
                      paddingVertical: 10
                    }}
                  >
                    <Text style={{ color: "#1e3a5f", fontWeight: "700" }}>Administracion</Text>
                  </Pressable>
                ) : null}

                <Pressable
                  onPress={handleSignOut}
                  style={{
                    borderRadius: 12,
                    backgroundColor: "#fef2f2",
                    paddingHorizontal: 12,
                    paddingVertical: 10
                  }}
                >
                  <Text style={{ color: "#991b1b", fontWeight: "700" }}>Cerrar sesion</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          <View style={{ marginTop: 13, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.16)", paddingTop: 13 }}>
            <Text style={{ color: "white", fontSize: 30, fontWeight: "700" }}>{title}</Text>
            <Text style={{ color: "#dbe7f8", marginTop: 8, lineHeight: 21 }}>{subtitle}</Text>
          </View>

          <View style={{ marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 8, zIndex: 35 }}>
            <Pressable
              onPress={() => {
                setCatalogOpen(false);
                setAccountOpen(false);
                router.push("/(tabs)/home");
              }}
              style={navButtonStyle(homeActive)}
            >
              <View style={navIconCircleStyle(homeActive)}>
                <MenuDot color={homeActive ? "#0b5ed7" : "white"} />
              </View>
              <Text style={navTextStyle(homeActive)}>Home</Text>
            </Pressable>

            <View style={{ position: "relative" }}>
              <Pressable
                onPress={() => {
                  setAccountOpen(false);
                  setCatalogOpen((value) => !value);
                }}
                style={navButtonStyle(catalogActive || catalogOpen)}
              >
                <View style={navIconCircleStyle(catalogActive || catalogOpen)}>
                  <MenuDot color={catalogActive || catalogOpen ? "#0b5ed7" : "white"} />
                </View>
                <Text style={navTextStyle(catalogActive || catalogOpen)}>Catalogo de solicitudes</Text>
                <Text style={navTextStyle(catalogActive || catalogOpen)}>{catalogOpen ? "^" : "v"}</Text>
              </Pressable>
            </View>

            <Pressable
              onPress={() => {
                setCatalogOpen(false);
                setAccountOpen(false);
                router.push("/(tabs)/requests");
              }}
              style={navButtonStyle(requestsActive)}
            >
              <View style={navIconCircleStyle(requestsActive)}>
                <MenuDot color={requestsActive ? "#0b5ed7" : "white"} />
              </View>
              <Text style={navTextStyle(requestsActive)}>Mis solicitudes</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                setCatalogOpen(false);
                setAccountOpen(false);
                router.push("/(tabs)/inbox");
              }}
              style={navButtonStyle(inboxActive)}
            >
              <View style={navIconCircleStyle(inboxActive)}>
                <BellGlyph color={inboxActive ? "#0b5ed7" : "white"} />
              </View>
              <Text style={navTextStyle(inboxActive)}>
                Bandeja {inboxCount > 0 ? `(${unreadLabel})` : ""}
              </Text>
            </Pressable>
          </View>

          {catalogOpen ? (
            <View
              style={{
                marginTop: 10,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: "#bfd2e7",
                backgroundColor: "white",
                padding: 8,
                gap: 6,
                zIndex: 40
              }}
            >
              <Text style={{ marginLeft: 8, marginTop: 4, color: "#0b5ed7", fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase" }}>
                Solicitudes disponibles
              </Text>
              <ScrollView nestedScrollEnabled style={{ maxHeight: 360 }}>
                <View style={{ gap: 4, paddingBottom: 4 }}>
                  {menuLoading ? (
                    <>
                      <View style={{ borderRadius: 12, backgroundColor: "#eef4fb", height: 44 }} />
                      <View style={{ borderRadius: 12, backgroundColor: "#eef4fb", height: 44 }} />
                      <View style={{ borderRadius: 12, backgroundColor: "#eef4fb", height: 44 }} />
                    </>
                  ) : null}

                  {!menuLoading
                    ? visibleRequestTypes.map((type) => (
                        <Pressable
                          key={type.code}
                          onPress={() => {
                            setCatalogOpen(false);
                            router.push(`/solicitudes/${encodeURIComponent(type.code)}` as never);
                          }}
                          style={({ hovered, pressed }) => ({
                            borderRadius: 12,
                            paddingHorizontal: 10,
                            paddingVertical: 10,
                            backgroundColor: pressed ? "#eaf3ff" : hovered ? "#f7fbff" : "white"
                          })}
                        >
                          <Text style={{ color: "#1e3a5f", fontWeight: "600" }}>{type.name}</Text>
                        </Pressable>
                      ))
                    : null}

                  {!menuLoading && visibleRequestTypes.length === 0 ? (
                    <View style={{ borderRadius: 12, backgroundColor: "#f8fafc", paddingHorizontal: 10, paddingVertical: 10 }}>
                      <Text style={{ color: "#64748b" }}>No hay solicitudes disponibles.</Text>
                    </View>
                  ) : null}
                </View>
              </ScrollView>
            </View>
          ) : null}
        </View>

        <View style={{ gap: 12 }}>{children}</View>

        <View
          style={{
            borderRadius: 24,
            borderWidth: 1,
            borderColor: "#bfd2e7",
            backgroundColor: "#eef5fd",
            paddingHorizontal: 16,
            paddingVertical: 14
          }}
        >
          <Text style={{ color: "#1e3a5f", fontSize: 12 }}>
            Aplicacion desarrollada por Departamento de Tecnologia e Innovacion. Todos los derechos reservados, 2026.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
