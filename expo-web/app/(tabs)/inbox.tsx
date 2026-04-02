import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { AppShell } from "@/src/components/AppShell";
import { ScreenSkeletonCard } from "@/src/components/Skeleton";
import { useSession } from "@/src/context/SessionContext";
import { decideRequestStep, getApproverInbox } from "@/src/lib/api";
import { formatDateTimePanama } from "@/src/lib/datetime";
import { buildPayloadHighlights, summarizePayloadValue } from "@/src/lib/requestPayload";
import { getStatusLabel } from "@/src/lib/status";
import { PendingApprovalItem } from "@/src/lib/types";

type StepDecision = "approve" | "reject" | "complete";

export default function InboxScreen() {
  const { user } = useSession();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PendingApprovalItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [commentsByStep, setCommentsByStep] = useState<Record<string, string>>({});

  const loadInbox = useCallback(async () => {
    if (!user?.email) {
      setLoading(false);
      return;
    }

    setError(null);
    const startedAt = Date.now();

    try {
      const inboxItems = await getApproverInbox(user.email);
      setItems(inboxItems);
    } catch {
      setError("No se pudo cargar la bandeja de aprobaciones.");
    } finally {
      const minVisibleMs = 450;
      const elapsedMs = Date.now() - startedAt;
      const remainingMs = Math.max(0, minVisibleMs - elapsedMs);
      if (remainingMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, remainingMs));
      }
      setLoading(false);
    }
  }, [user?.email]);

  useEffect(() => {
    void loadInbox();
  }, [loadInbox]);

  async function handleDecision(item: PendingApprovalItem, decision: StepDecision) {
    if (!user) {
      return;
    }

    setBusyId(item.step_id);
    setError(null);

    try {
      await decideRequestStep(item.id, item.step_id, {
        decision,
        comments: commentsByStep[item.step_id]?.trim() || undefined,
        actorName: user.name,
        actorEmail: user.email
      });

      await loadInbox();
    } catch (decisionError) {
      setError(decisionError instanceof Error ? decisionError.message : "No se pudo registrar la decision.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AppShell
      title="SSD | Bandeja de aprobaciones"
      subtitle="Cada aprobador ve aqui las solicitudes pendientes asignadas a su correo corporativo."
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
          <Text style={{ color: "#1f406b", fontSize: 11, letterSpacing: 2.2, textTransform: "uppercase" }}>Pendientes</Text>
          <Text style={{ color: "#001534", fontSize: 30, fontWeight: "700" }}>{items.length}</Text>

          {items.length === 0 ? (
            <View style={{ borderRadius: 24, borderWidth: 1, borderColor: "#d7e4f2", backgroundColor: "#f5faff", padding: 14 }}>
              <Text style={{ color: "#475569" }}>Sin pendientes de aprobacion.</Text>
            </View>
          ) : (
            items.map((item) => {
              const isBusy = busyId === item.step_id;
              const canApprove = item.step_kind === "approval";
              const payloadHighlights = buildPayloadHighlights(item.payload, 2);

              return (
                <View key={item.step_id} style={{ borderRadius: 24, borderWidth: 1, borderColor: "#d7e4f2", backgroundColor: "#f5faff", padding: 14 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: "#64748b", fontSize: 11, letterSpacing: 1.3, textTransform: "uppercase" }}>{item.ticket_code}</Text>
                      <Text style={{ color: "#001534", marginTop: 3, fontWeight: "700", fontSize: 18 }}>{item.subject}</Text>
                      <Text style={{ color: "#1e3a5f", marginTop: 6 }}>
                        {item.step_label} | {getStatusLabel(item.step_status)}
                      </Text>
                      <Text style={{ color: "#64748b", marginTop: 4, fontSize: 12 }}>
                        {item.requester_name} | {item.department} | {formatDateTimePanama(item.created_at)}
                      </Text>
                    </View>
                    <View style={{ borderRadius: 999, borderWidth: 1, borderColor: "#bfdbfe", backgroundColor: "#eff6ff", paddingHorizontal: 10, paddingVertical: 5 }}>
                      <Text style={{ color: "#1e3a8a", fontWeight: "700", fontSize: 12 }}>
                        {item.step_kind === "approval" ? "Aprobacion" : "Ejecucion"}
                      </Text>
                    </View>
                  </View>

                  {payloadHighlights.length > 0 ? (
                    <View style={{ marginTop: 8, gap: 4 }}>
                      {payloadHighlights.map((highlight) => (
                        <Text key={`${item.step_id}-${highlight.key}`} style={{ color: "#334155", fontSize: 12 }}>
                          {highlight.label}: {summarizePayloadValue(highlight.display)}
                        </Text>
                      ))}
                    </View>
                  ) : null}

                  <TextInput
                    placeholder="Comentarios (opcional)"
                    value={commentsByStep[item.step_id] ?? ""}
                    onChangeText={(value) =>
                      setCommentsByStep((current) => ({
                        ...current,
                        [item.step_id]: value
                      }))
                    }
                    style={{
                      marginTop: 10,
                      borderWidth: 1,
                      borderColor: "#cbd5e1",
                      borderRadius: 14,
                      paddingHorizontal: 12,
                      paddingVertical: 9,
                      backgroundColor: "white"
                    }}
                  />

                  <View style={{ flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                    {canApprove ? (
                      <>
                        <Pressable
                          disabled={isBusy}
                          onPress={() => handleDecision(item, "approve")}
                          style={{ backgroundColor: isBusy ? "#94a3b8" : "#0f766e", borderRadius: 999, paddingVertical: 10, paddingHorizontal: 14 }}
                        >
                          <Text style={{ color: "white", fontWeight: "700" }}>Aprobar</Text>
                        </Pressable>
                        <Pressable
                          disabled={isBusy}
                          onPress={() => handleDecision(item, "reject")}
                          style={{ backgroundColor: isBusy ? "#94a3b8" : "#b91c1c", borderRadius: 999, paddingVertical: 10, paddingHorizontal: 14 }}
                        >
                          <Text style={{ color: "white", fontWeight: "700" }}>Rechazar</Text>
                        </Pressable>
                      </>
                    ) : (
                      <Pressable
                        disabled={isBusy}
                        onPress={() => handleDecision(item, "complete")}
                        style={{ backgroundColor: isBusy ? "#94a3b8" : "#1d4ed8", borderRadius: 999, paddingVertical: 10, paddingHorizontal: 14 }}
                      >
                        <Text style={{ color: "white", fontWeight: "700" }}>Completar</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>
      ) : null}
    </AppShell>
  );
}
