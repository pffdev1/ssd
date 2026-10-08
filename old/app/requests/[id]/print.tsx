import { Redirect, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, SafeAreaView, ScrollView, Text, View } from "react-native";
import { useSession } from "@/src/context/SessionContext";
import { formatDateTimePanama } from "@/src/lib/datetime";
import { getRequest } from "@/src/lib/api";
import { getStatusLabel } from "@/src/lib/status";
import { RequestDetail } from "@/src/lib/types";

const brandLogo = require("../../../assets/brand/pedersen-connect-logo.png");

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

export default function RequestPrintScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();
  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState<RequestDetail | null>(null);

  useEffect(() => {
    if (!id || !user?.email) {
      setLoading(false);
      return;
    }

    getRequest(id, user.email)
      .then(setRequest)
      .finally(() => setLoading(false));
  }, [id, user?.email]);

  const payloadEntries = useMemo(() => Object.entries(request?.payload ?? {}), [request?.payload]);
  const printedAt = formatDateTimePanama(new Date());

  if (!user) {
    return <Redirect href="/login" />;
  }

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f3f7fc", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator />
        <Text style={{ marginTop: 10, color: "#475569" }}>Cargando formato...</Text>
      </SafeAreaView>
    );
  }

  if (!request) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f3f7fc", justifyContent: "center", padding: 16 }}>
        <View style={{ backgroundColor: "white", borderRadius: 24, borderWidth: 1, borderColor: "#bfd2e7", padding: 16 }}>
          <Text style={{ color: "#0f2440", fontWeight: "700" }}>No encontrada</Text>
          <Text style={{ marginTop: 6, color: "#475569" }}>No se encontro la solicitud.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f3f7fc" }}>
      <ScrollView contentContainerStyle={{ padding: 14, gap: 10, maxWidth: 900, width: "100%", alignSelf: "center" }}>
        <View style={{ alignItems: "flex-end" }}>
          <Pressable
            onPress={() => {
              if (typeof window !== "undefined") {
                window.print();
              }
            }}
            style={{ borderRadius: 999, backgroundColor: "#0b5ed7", paddingHorizontal: 14, paddingVertical: 10 }}
          >
            <Text style={{ color: "white", fontWeight: "700" }}>Imprimir formato</Text>
          </Pressable>
        </View>

        <View style={{ borderRadius: 28, borderWidth: 1, borderColor: "#bfd2e7", backgroundColor: "white", padding: 16 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10, borderBottomWidth: 1, borderBottomColor: "#d7e4f2", paddingBottom: 10 }}>
            <View style={{ flexDirection: "row", gap: 10, flex: 1 }}>
              <View style={{ width: 56, height: 56, borderRadius: 14, borderWidth: 1, borderColor: "#d7e4f2", overflow: "hidden", backgroundColor: "white" }}>
                <Image source={brandLogo} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#1f406b", fontSize: 10, letterSpacing: 2.2, textTransform: "uppercase" }}>Pedersen Connect</Text>
                <Text style={{ marginTop: 2, color: "#001534", fontSize: 24, fontWeight: "700" }}>Formato imprimible de aprobacion</Text>
                <Text style={{ marginTop: 4, color: "#1e3a5f", lineHeight: 20 }}>
                  Documento de respaldo operativo con trazabilidad de aprobaciones y firmas registradas en SSD.
                </Text>
              </View>
            </View>

            <View style={{ borderRadius: 18, borderWidth: 1, borderColor: "#bfd2e7", backgroundColor: "#f5faff", paddingHorizontal: 12, paddingVertical: 10 }}>
              <Text style={{ color: "#1e3a5f" }}>Ticket: {request.ticket_code}</Text>
              <Text style={{ color: "#1e3a5f", marginTop: 4 }}>Estado: {getStatusLabel(request.status)}</Text>
            </View>
          </View>

          <View style={{ marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            <View style={{ flex: 1, minWidth: 240, borderRadius: 18, borderWidth: 1, borderColor: "#d7e4f2", backgroundColor: "#f9fbff", padding: 12 }}>
              <Text style={{ color: "#64748b", fontSize: 11, letterSpacing: 1.3, textTransform: "uppercase" }}>Solicitante</Text>
              <Text style={{ marginTop: 4, color: "#001534", fontWeight: "700" }}>{request.requester_name}</Text>
              <Text style={{ marginTop: 2, color: "#1e3a5f" }}>{request.requester_email}</Text>
              <Text style={{ marginTop: 2, color: "#1e3a5f" }}>{request.department}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 240, borderRadius: 18, borderWidth: 1, borderColor: "#d7e4f2", backgroundColor: "#f9fbff", padding: 12 }}>
              <Text style={{ color: "#64748b", fontSize: 11, letterSpacing: 1.3, textTransform: "uppercase" }}>Tipo de solicitud</Text>
              <Text style={{ marginTop: 4, color: "#001534", fontWeight: "700" }}>{request.request_type_name}</Text>
              <Text style={{ marginTop: 2, color: "#1e3a5f" }}>Fecha: {formatDateTimePanama(request.created_at)}</Text>
            </View>
          </View>

          <View style={{ marginTop: 10, borderRadius: 18, borderWidth: 1, borderColor: "#d7e4f2", backgroundColor: "#f9fbff", padding: 12 }}>
            <Text style={{ color: "#64748b", fontSize: 11, letterSpacing: 1.3, textTransform: "uppercase" }}>Solicitud</Text>
            <Text style={{ marginTop: 4, color: "#001534", fontSize: 18, fontWeight: "700" }}>{request.subject}</Text>
            <Text style={{ marginTop: 6, color: "#1e3a5f", lineHeight: 21 }}>{request.justification}</Text>
          </View>

          <View style={{ marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            <View style={{ flex: 1, minWidth: 260 }}>
              <Text style={{ color: "#64748b", fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase" }}>Datos del formulario</Text>
              <View style={{ gap: 8, marginTop: 6 }}>
                {payloadEntries.length > 0 ? (
                  payloadEntries.map(([key, value]) => {
                    const formatted = resolvePayloadDisplay(key, value);

                    return (
                      <View key={key} style={{ borderRadius: 16, borderWidth: 1, borderColor: "#d7e4f2", backgroundColor: "#f5faff", padding: 10 }}>
                        <Text style={{ color: "#0f2440", fontWeight: "700" }}>{humanizePayloadLabel(key)}</Text>
                        {formatted.list ? (
                          <View style={{ marginTop: 5, gap: 4 }}>
                            {formatted.list.map((item, index) => (
                              <Text key={`${key}-${index}`} style={{ color: "#475569" }}>
                                • {item}
                              </Text>
                            ))}
                          </View>
                        ) : (
                          <Text style={{ marginTop: 4, color: "#475569" }}>{formatted.text}</Text>
                        )}
                      </View>
                    );
                  })
                ) : (
                  <View style={{ borderRadius: 16, borderWidth: 1, borderColor: "#d7e4f2", backgroundColor: "#f5faff", padding: 10 }}>
                    <Text style={{ color: "#475569" }}>Sin datos adicionales en el payload.</Text>
                  </View>
                )}
              </View>
            </View>

            <View style={{ flex: 1, minWidth: 260 }}>
              <Text style={{ color: "#64748b", fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase" }}>Aprobaciones y firma digital</Text>
              <View style={{ gap: 8, marginTop: 6 }}>
                {request.steps.map((step) => (
                  <View key={step.id} style={{ borderRadius: 16, borderWidth: 1, borderColor: "#d7e4f2", backgroundColor: "#f9fbff", padding: 10 }}>
                    <Text style={{ color: "#0f2440", fontWeight: "700" }}>{step.sequence}. {step.label}</Text>
                    <Text style={{ marginTop: 2, color: "#1e3a5f", fontSize: 12 }}>{step.approver_name} | {step.approver_email}</Text>
                    <Text style={{ marginTop: 3, color: "#64748b", fontSize: 12 }}>Estado: {getStatusLabel(step.status)}</Text>
                    {step.comments ? <Text style={{ marginTop: 4, color: "#334155" }}>{step.comments}</Text> : null}
                    <Text style={{ marginTop: 4, color: "#64748b", fontSize: 12 }}>
                      {step.acted_at ? `Gestionado: ${formatDateTimePanama(step.acted_at)}` : "Pendiente"}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          <View style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: "#d7e4f2", paddingTop: 8 }}>
            <Text style={{ color: "#46607d", fontSize: 11 }}>
              Pedersen Fine Foods | Departamento de Tecnologia e Innovacion | Fecha de impresion: {printedAt}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
