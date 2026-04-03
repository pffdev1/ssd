import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { getRequest } from "@/src/lib/api";
import { parseBeneficiaries } from "@/src/lib/beneficiaries";
import { formatDateTimePanama } from "@/src/lib/datetime";
import { RequestDetail } from "@/src/lib/types";
import { useSession } from "@/src/context/SessionContext";
import { AppShell } from "@/src/components/AppShell";
import { ScreenSkeletonCard } from "@/src/components/Skeleton";
import { getStatusLabel } from "@/src/lib/status";

function parseIsoDateParts(value: string) {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }

  return { year, month, day };
}

function formatIsoDateField(value: string) {
  const parts = parseIsoDateParts(value);

  if (!parts) {
    return null;
  }

  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12));
  return new Intl.DateTimeFormat("es-PA", {
    dateStyle: "long",
    timeZone: "America/Panama"
  }).format(date);
}

function humanizePayloadLabel(key: string) {
  const aliases: Record<string, string> = {
    tipoSolicitud: "Tipo de solicitud",
    fechaNecesaria: "Fecha requerida",
    salarioReferencial: "Salario referencial",
    justificacionRol: "Justificacion del rol",
    tipoAusencia: "Tipo de ausencia",
    fechaInicio: "Fecha de inicio",
    fechaFin: "Fecha de fin",
    fechaSalida: "Fecha de salida",
    tipoSalida: "Tipo de salida",
    proveedorSugerido: "Proveedor sugerido",
    montoEstimado: "Monto estimado",
    detalleCompra: "Detalle de compra",
    tipoActivo: "Tipo de activo",
    beneficiarioActivo: "Beneficiario(s) final(es)",
    presupuestoEstimado: "Presupuesto estimado",
    planSugerido: "Plan sugerido",
    motivoNegocio: "Motivo del requerimiento",
    requiereEquipo: "Entrega de equipo"
  };

  if (aliases[key]) {
    return aliases[key];
  }

  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (value) => value.toUpperCase())
    .trim();
}

function formatSimpleValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "N/A";
  }

  if (typeof value === "boolean") {
    return value ? "Si" : "No";
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  return String(value);
}

function resolvePayloadDisplay(key: string, value: unknown) {
  if (Array.isArray(value)) {
    const values = value.map((item) => formatSimpleValue(item)).filter((item) => item !== "N/A");
    if (values.length > 1) {
      return { list: values };
    }
    return { text: values[0] ?? "N/A" };
  }

  if (typeof value === "string") {
    const normalized = value.trim();

    if (!normalized) {
      return { text: "N/A" };
    }

    const dateLabel = formatIsoDateField(normalized);
    if (dateLabel) {
      return { text: dateLabel };
    }

    const keySuggestsList = /benefici|colaborador|lista|participante/i.test(key);
    if (keySuggestsList) {
      const values = normalized
        .split(/\r?\n|,|;/)
        .map((item) => item.trim())
        .filter(Boolean);

      if (values.length > 1) {
        return { list: values };
      }

      if (values.length === 1) {
        return { text: values[0] };
      }
    }

    return { text: normalized };
  }

  return { text: formatSimpleValue(value) };
}

export default function RequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();
  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState<RequestDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !user?.email) {
      setLoading(false);
      return;
    }

    const startedAt = Date.now();

    getRequest(id, user.email)
      .then((response) => {
        setRequest(response);
        setError(null);
      })
      .catch(() => setError("No se pudo cargar el detalle de la solicitud."))
      .finally(async () => {
        const minVisibleMs = 450;
        const elapsedMs = Date.now() - startedAt;
        const remainingMs = Math.max(0, minVisibleMs - elapsedMs);
        if (remainingMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, remainingMs));
        }
        setLoading(false);
      });
  }, [id, user?.email]);

  const beneficiaries = useMemo(() => parseBeneficiaries(request?.payload ?? {}), [request?.payload]);
  const payloadEntries = useMemo(() => Object.entries(request?.payload ?? {}), [request?.payload]);

  if (!user) {
    return <Redirect href="/login" />;
  }

  return (
    <AppShell
      title={`SSD | ${request?.ticket_code ?? "Detalle de solicitud"}`}
      subtitle="Consulta el historial, los pasos del flujo y la trazabilidad completa de la solicitud."
    >
      {loading ? (
        <ScreenSkeletonCard rows={5} />
      ) : null}

      {!loading && error ? (
        <View style={{ backgroundColor: "#fff1f2", borderColor: "#fecdd3", borderWidth: 1, borderRadius: 18, padding: 16 }}>
          <Text style={{ color: "#be123c", fontWeight: "700" }}>No se pudo cargar</Text>
          <Text style={{ color: "#9f1239", marginTop: 4 }}>{error}</Text>
        </View>
      ) : null}

      {!loading && !error && !request ? (
        <View style={{ backgroundColor: "white", borderRadius: 30, borderWidth: 1, borderColor: "#bfd2e7", padding: 16 }}>
          <Text style={{ color: "#0f2440", fontWeight: "700" }}>No encontrada</Text>
          <Text style={{ marginTop: 6, color: "#475569" }}>No se encontro la solicitud.</Text>
        </View>
      ) : null}

      {!loading && !error && request ? (
        <View style={{ gap: 12 }}>
          <View style={{ backgroundColor: "white", borderRadius: 30, borderWidth: 1, borderColor: "#bfd2e7", padding: 16 }}>
            <Text style={{ color: "#1f406b", fontSize: 12, letterSpacing: 2, textTransform: "uppercase" }}>Resumen</Text>
            <Text style={{ color: "#0f2440", fontSize: 22, fontWeight: "700", marginTop: 6 }}>{request.subject}</Text>
            <Text style={{ color: "#475569", marginTop: 6 }}>{request.justification}</Text>
            <View style={{ marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <View style={{ borderRadius: 999, borderWidth: 1, borderColor: "#bfdbfe", backgroundColor: "#eff6ff", paddingHorizontal: 10, paddingVertical: 5 }}>
                <Text style={{ color: "#1e3a8a", fontWeight: "600", fontSize: 12 }}>{getStatusLabel(request.status)}</Text>
              </View>
              <View style={{ borderRadius: 999, borderWidth: 1, borderColor: "#d7e4f2", backgroundColor: "#f5faff", paddingHorizontal: 10, paddingVertical: 5 }}>
                <Text style={{ color: "#1e3a5f", fontWeight: "600", fontSize: 12 }}>{request.request_type_name}</Text>
              </View>
            </View>
            <Text style={{ marginTop: 8, color: "#64748b", fontSize: 12 }}>
              Solicitante: {request.requester_name} - {request.department}
            </Text>
            <Text style={{ marginTop: 4, color: "#64748b", fontSize: 12 }}>
              Creada: {formatDateTimePanama(request.created_at)}
            </Text>
            <Text style={{ marginTop: 2, color: "#64748b", fontSize: 12 }}>
              Ultima actualizacion: {formatDateTimePanama(request.updated_at)}
            </Text>

            <View style={{ flexDirection: "row", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <Pressable
                onPress={() => router.push(`/requests/${request.id}/print`)}
                style={{ backgroundColor: "#0b5ed7", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 }}
              >
                <Text style={{ color: "white", fontWeight: "700", fontSize: 12 }}>Formato imprimible</Text>
              </Pressable>
              <Pressable
                onPress={() =>
                  router.push(
                    beneficiaries[0]
                      ? `/requests/${request.id}/responsiva?beneficiary=${encodeURIComponent(beneficiaries[0])}`
                      : `/requests/${request.id}/responsiva`
                  )
                }
                style={{ backgroundColor: "#1d4ed8", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 }}
              >
                <Text style={{ color: "white", fontWeight: "700", fontSize: 12 }}>Carta responsiva</Text>
              </Pressable>
            </View>
          </View>

          <View style={{ backgroundColor: "white", borderRadius: 30, borderWidth: 1, borderColor: "#bfd2e7", padding: 16, gap: 10 }}>
            <Text style={{ color: "#1f406b", fontSize: 12, letterSpacing: 2, textTransform: "uppercase" }}>Detalle del formulario</Text>
            {payloadEntries.length === 0 ? (
              <Text style={{ color: "#475569" }}>No hay campos adicionales capturados.</Text>
            ) : (
              payloadEntries.map(([key, value]) => {
                const formatted = resolvePayloadDisplay(key, value);

                return (
                  <View key={key} style={{ borderWidth: 1, borderColor: "#d7e4f2", borderRadius: 12, padding: 10, backgroundColor: "#f9fbff" }}>
                    <Text style={{ color: "#0f2440", fontWeight: "700" }}>{humanizePayloadLabel(key)}</Text>
                    {formatted.list ? (
                      <View style={{ marginTop: 6, gap: 4 }}>
                        {formatted.list.map((item, index) => (
                          <Text key={`${key}-${index}`} style={{ color: "#334155" }}>• {item}</Text>
                        ))}
                      </View>
                    ) : (
                      <Text style={{ color: "#334155", marginTop: 6 }}>{formatted.text}</Text>
                    )}
                  </View>
                );
              })
            )}
          </View>

          <View style={{ backgroundColor: "white", borderRadius: 30, borderWidth: 1, borderColor: "#bfd2e7", padding: 16, gap: 8 }}>
            <Text style={{ color: "#1f406b", fontSize: 12, letterSpacing: 2, textTransform: "uppercase" }}>Pasos del flujo</Text>
            {request.steps.length === 0 ? (
              <Text style={{ color: "#475569" }}>No hay pasos registrados.</Text>
            ) : (
              request.steps.map((step) => (
                <View key={step.id} style={{ borderWidth: 1, borderColor: "#d7e4f2", borderRadius: 12, padding: 10, backgroundColor: "#f9fbff" }}>
                  <Text style={{ color: "#0f2440", fontWeight: "700" }}>
                    {step.sequence}. {step.label}
                  </Text>
                  <Text style={{ color: "#64748b", marginTop: 3, fontSize: 12 }}>
                    {step.approver_name} - {getStatusLabel(step.status)}
                  </Text>
                  <Text style={{ color: "#64748b", marginTop: 3, fontSize: 12 }}>
                    {step.acted_at ? `Gestionado: ${formatDateTimePanama(step.acted_at)}` : "Gestion pendiente"}
                  </Text>
                  {step.comments ? <Text style={{ color: "#334155", marginTop: 6 }}>{step.comments}</Text> : null}
                </View>
              ))
            )}
          </View>

          <View style={{ backgroundColor: "white", borderRadius: 30, borderWidth: 1, borderColor: "#bfd2e7", padding: 16, gap: 8 }}>
            <Text style={{ color: "#1f406b", fontSize: 12, letterSpacing: 2, textTransform: "uppercase" }}>Bitacora</Text>
            {request.events.length === 0 ? (
              <Text style={{ color: "#475569" }}>No hay eventos registrados.</Text>
            ) : (
              request.events.map((event) => (
                <View key={event.id} style={{ borderWidth: 1, borderColor: "#d7e4f2", borderRadius: 12, padding: 10 }}>
                  <Text style={{ color: "#0f2440", fontWeight: "700" }}>{event.event_type}</Text>
                  <Text style={{ color: "#334155", marginTop: 4 }}>{event.notes}</Text>
                  <Text style={{ color: "#64748b", marginTop: 4, fontSize: 12 }}>
                    {event.actor_name} - {event.actor_email}
                  </Text>
                  <Text style={{ color: "#64748b", marginTop: 2, fontSize: 12 }}>
                    {formatDateTimePanama(event.created_at)}
                  </Text>
                </View>
              ))
            )}
          </View>
        </View>
      ) : null}
    </AppShell>
  );
}


