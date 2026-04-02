
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, TextInput, View, useWindowDimensions } from "react-native";
import { AppShell } from "@/src/components/AppShell";
import { ScreenSkeletonCard } from "@/src/components/Skeleton";
import { useSession } from "@/src/context/SessionContext";
import {
  addAdminUser,
  addCatalogItem,
  checkAdmin,
  createRequestType,
  createWorkflowStep,
  deleteRequestType,
  deleteWorkflowStep,
  getAdminUsers,
  getApprovedMobileLines,
  getCatalog,
  getCatalogItems,
  getWorkflowSteps,
  updateCatalogItem,
  updateRequestType,
  updateRequestTypeWorkflow,
  updateWorkflowStep
} from "@/src/lib/api";
import { parseBeneficiaries } from "@/src/lib/beneficiaries";
import { AdminUser, CatalogItem, RequestItem, RequestType, WorkflowStepTemplate } from "@/src/lib/types";

type Section = "overview" | "steps" | "workflows" | "catalogs" | "admins" | "mobile";
type CatalogViewKey = "REQUEST_TYPES" | "DEPARTMENT" | "BUSINESS_UNIT" | "MOBILE_PLAN" | "IT_ASSET_TYPE";

type CatalogView = {
  key: CatalogViewKey;
  mode: "request-types" | "catalog";
  label: string;
  description: string;
};

const catalogViews: CatalogView[] = [
  { key: "REQUEST_TYPES", mode: "request-types", label: "Solicitudes", description: "Tipos de solicitud en SSD." },
  { key: "DEPARTMENT", mode: "catalog", label: "Departamentos", description: "Catalogo para ruteo por area." },
  { key: "BUSINESS_UNIT", mode: "catalog", label: "Unidades de negocio", description: "Catalogo de divisiones." },
  { key: "MOBILE_PLAN", mode: "catalog", label: "Planes celulares", description: "Planes para lineas nuevas." },
  { key: "IT_ASSET_TYPE", mode: "catalog", label: "Tipos de activos TI", description: "Activos disponibles para TI." }
];

function Field({
  value,
  onChange,
  placeholder,
  multiline,
  editable = true
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  editable?: boolean;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      editable={editable}
      multiline={multiline}
      style={{
        borderWidth: 1,
        borderColor: "#bfd2e7",
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 10,
        minHeight: multiline ? 84 : undefined,
        textAlignVertical: multiline ? "top" : "auto",
        backgroundColor: editable ? "#f9fbff" : "#e2e8f0"
      }}
    />
  );
}

function Tab({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ hovered, pressed }) => ({
        borderWidth: 1,
        borderColor: active ? "#0b5ed7" : "#d7e4f2",
        backgroundColor: active ? "#0b5ed7" : pressed ? "#eef6ff" : hovered ? "#f8fbff" : "white",
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 9
      })}
    >
      <Text style={{ color: active ? "white" : "#1e293b", fontWeight: "700", fontSize: 12 }}>{label}</Text>
    </Pressable>
  );
}

function Badge({ text, tone = "default" }: { text: string; tone?: "default" | "active" | "muted" }) {
  const toneStyle =
    tone === "active"
      ? { borderColor: "#8ebdff", backgroundColor: "#eef5ff", color: "#0b5ed7" }
      : tone === "muted"
        ? { borderColor: "#cbd5e1", backgroundColor: "#f1f5f9", color: "#64748b" }
        : { borderColor: "#d7e4f2", backgroundColor: "white", color: "#1e3a5f" };

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: toneStyle.borderColor,
        borderRadius: 999,
        backgroundColor: toneStyle.backgroundColor,
        paddingHorizontal: 9,
        paddingVertical: 4
      }}
    >
      <Text style={{ color: toneStyle.color, fontSize: 11, textTransform: "uppercase", letterSpacing: 1.1, fontWeight: "700" }}>
        {text}
      </Text>
    </View>
  );
}

function routingLabel(step: Pick<WorkflowStepTemplate, "routing" | "scope">) {
  return step.routing === "department" ? "Por departamento" : step.scope ?? "Scope";
}

function buildRouteCount(departments: string[], stepTemplates: WorkflowStepTemplate[]) {
  const departmentSteps = stepTemplates.filter((s) => s.routing === "department").length;
  const scopeSteps = stepTemplates.filter((s) => s.routing === "scope").length;
  return departmentSteps * departments.length + scopeSteps;
}

function stepUsageCount(stepCode: string, requestTypes: RequestType[]) {
  return requestTypes.filter((rt) => rt.workflow.steps.some((step) => step.code === stepCode)).length;
}

function getBeneficiaries(request: RequestItem) {
  const parsed = parseBeneficiaries(request.payload);
  if (parsed.length > 0) {
    return parsed;
  }
  return request.beneficiary_name ? [request.beneficiary_name] : [];
}
export default function AdminScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= 1220;
  const { user } = useSession();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [section, setSection] = useState<Section>("overview");

  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [requestTypes, setRequestTypes] = useState<RequestType[]>([]);
  const [steps, setSteps] = useState<WorkflowStepTemplate[]>([]);
  const [lines, setLines] = useState<RequestItem[]>([]);

  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");

  const [activeCatalogKey, setActiveCatalogKey] = useState<CatalogViewKey>("REQUEST_TYPES");
  const [catalogItemId, setCatalogItemId] = useState<string | null>(null);
  const [catalogLabel, setCatalogLabel] = useState("");
  const [catalogValue, setCatalogValue] = useState("");
  const [catalogSort, setCatalogSort] = useState("10");

  const [requestTypeId, setRequestTypeId] = useState<string | null>(null);
  const [requestTypeCode, setRequestTypeCode] = useState("");
  const [requestTypeName, setRequestTypeName] = useState("");
  const [requestTypeDescription, setRequestTypeDescription] = useState("");
  const [requestTypeCategory, setRequestTypeCategory] = useState("");
  const [requestTypeColor, setRequestTypeColor] = useState("#0b5ed7");

  const [workflowTypeId, setWorkflowTypeId] = useState("");
  const [workflowCodes, setWorkflowCodes] = useState<string[]>([]);

  const [selectedStepId, setSelectedStepId] = useState("");
  const [stepLabel, setStepLabel] = useState("");
  const [stepDescription, setStepDescription] = useState("");
  const [stepActive, setStepActive] = useState(true);
  const [stepSortOrder, setStepSortOrder] = useState("10");
  const [stepResponsibleName, setStepResponsibleName] = useState("");
  const [stepResponsibleEmail, setStepResponsibleEmail] = useState("");
  const [stepResponsibleTitle, setStepResponsibleTitle] = useState("");

  const [createStepCode, setCreateStepCode] = useState("");
  const [createStepLabel, setCreateStepLabel] = useState("");
  const [createStepDescription, setCreateStepDescription] = useState("");
  const [createStepKind, setCreateStepKind] = useState<"approval" | "fulfillment">("approval");
  const [createStepRouting, setCreateStepRouting] = useState<"department" | "scope">("scope");
  const [createStepScope, setCreateStepScope] = useState("CUSTOM");
  const [createStepSortOrder, setCreateStepSortOrder] = useState("999");
  const [createStepResponsibleName, setCreateStepResponsibleName] = useState("");
  const [createStepResponsibleEmail, setCreateStepResponsibleEmail] = useState("");
  const [createStepResponsibleTitle, setCreateStepResponsibleTitle] = useState("");

  const activeCatalogView = useMemo(
    () => catalogViews.find((view) => view.key === activeCatalogKey) ?? catalogViews[0],
    [activeCatalogKey]
  );
  const sortedSteps = useMemo(
    () => [...steps].sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label)),
    [steps]
  );
  const selectedRequestType = useMemo(
    () => requestTypes.find((item) => item.id === workflowTypeId) ?? null,
    [requestTypes, workflowTypeId]
  );
  const selectedStep = useMemo(
    () => sortedSteps.find((item) => item.id === selectedStepId) ?? null,
    [sortedSteps, selectedStepId]
  );
  const managedDepartments = useMemo(
    () => catalogItems.filter((item) => item.catalog_key === "DEPARTMENT" && item.active).map((item) => item.item_value),
    [catalogItems]
  );
  const visibleCatalogItems = useMemo(
    () =>
      catalogItems
        .filter((item) => item.catalog_key === activeCatalogKey)
        .sort((a, b) => a.sort_order - b.sort_order || a.item_label.localeCompare(b.item_label)),
    [catalogItems, activeCatalogKey]
  );
  const activeWorkflowSteps = useMemo(
    () => workflowCodes.map((code) => sortedSteps.find((item) => item.code === code)).filter(Boolean) as WorkflowStepTemplate[],
    [workflowCodes, sortedSteps]
  );
  const availableWorkflowSteps = useMemo(
    () => sortedSteps.filter((item) => item.active && !workflowCodes.includes(item.code)),
    [sortedSteps, workflowCodes]
  );
  const relatedTypesForSelectedStep = useMemo(() => {
    if (!selectedStep) {
      return [];
    }
    return requestTypes.filter((item) => item.workflow.steps.some((step) => step.code === selectedStep.code));
  }, [requestTypes, selectedStep]);

  useEffect(() => {
    if (!user?.email) {
      setLoading(false);
      return;
    }

    let active = true;

    const load = async () => {
      const startedAt = Date.now();
      setError(null);

      const adminCheck = await checkAdmin(user.email);
      if (!active) {
        return;
      }

      setIsAdmin(adminCheck.isAdmin);
      if (!adminCheck.isAdmin) {
        setLoading(false);
        return;
      }

      const [adminsData, catalogData, catalogItemsData, stepsData, linesData] = await Promise.all([
        getAdminUsers(user.email),
        getCatalog(),
        getCatalogItems(user.email),
        getWorkflowSteps(user.email),
        getApprovedMobileLines(user.email)
      ]);

      if (!active) {
        return;
      }

      setAdmins(adminsData);
      setRequestTypes(catalogData.requestTypes);
      setCatalogItems(catalogItemsData);
      setSteps(stepsData);
      setLines(linesData);
      setWorkflowTypeId(catalogData.requestTypes[0]?.id ?? "");
      setSelectedStepId(stepsData[0]?.id ?? "");

      const remainingMs = Math.max(0, 500 - (Date.now() - startedAt));
      if (remainingMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, remainingMs));
      }

      if (active) {
        setLoading(false);
      }
    };

    load().catch(() => {
      if (!active) {
        return;
      }
      setError("No se pudo cargar el panel de administracion.");
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [user?.email]);

  useEffect(() => {
    if (!requestTypes.length) {
      setWorkflowTypeId("");
      setWorkflowCodes([]);
      return;
    }

    if (!requestTypes.some((item) => item.id === workflowTypeId)) {
      setWorkflowTypeId(requestTypes[0].id);
    }
  }, [requestTypes, workflowTypeId]);

  useEffect(() => {
    if (!selectedRequestType) {
      setWorkflowCodes([]);
      return;
    }

    setWorkflowCodes(selectedRequestType.workflow.steps.map((step) => step.code));
  }, [selectedRequestType?.id]);

  useEffect(() => {
    if (!sortedSteps.length) {
      setSelectedStepId("");
      return;
    }

    if (!sortedSteps.some((item) => item.id === selectedStepId)) {
      setSelectedStepId(sortedSteps[0].id);
    }
  }, [sortedSteps, selectedStepId]);

  useEffect(() => {
    if (!selectedStep) {
      setStepLabel("");
      setStepDescription("");
      setStepActive(true);
      setStepSortOrder("10");
      setStepResponsibleName("");
      setStepResponsibleEmail("");
      setStepResponsibleTitle("");
      return;
    }

    setStepLabel(selectedStep.label);
    setStepDescription(selectedStep.description);
    setStepActive(selectedStep.active);
    setStepSortOrder(String(selectedStep.sort_order));
    setStepResponsibleName(selectedStep.responsible_name ?? "");
    setStepResponsibleEmail(selectedStep.responsible_email ?? "");
    setStepResponsibleTitle(selectedStep.responsible_title ?? "");
  }, [selectedStep?.id]);

  async function withBusy(action: () => Promise<void>) {
    if (busy) {
      return;
    }

    setBusy(true);
    setError(null);
    setInfo(null);

    try {
      await action();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Operacion fallida");
    } finally {
      setBusy(false);
    }
  }

  function resetRequestTypeForm() {
    setRequestTypeId(null);
    setRequestTypeCode("");
    setRequestTypeName("");
    setRequestTypeDescription("");
    setRequestTypeCategory("");
    setRequestTypeColor("#0b5ed7");
  }

  if (loading) {
    return (
      <AppShell title="Administracion SSD" subtitle="Panel central para catalogos, workflows y pasos del sistema.">
        <ScreenSkeletonCard rows={8} />
      </AppShell>
    );
  }

  if (!isAdmin) {
    return (
      <AppShell title="Administracion SSD" subtitle="Panel central para catalogos, workflows y pasos del sistema.">
        <View style={{ borderRadius: 24, borderWidth: 1, borderColor: "#bfd2e7", backgroundColor: "white", padding: 14 }}>
          <Text style={{ color: "#0f2440", fontWeight: "700" }}>Sin permisos</Text>
          <Text style={{ marginTop: 4, color: "#475569" }}>No tienes permisos de administrador.</Text>
        </View>
      </AppShell>
    );
  }

  const routeCount = buildRouteCount(managedDepartments, steps);
  return (
    <AppShell title="Administracion SSD" subtitle="Gestiona configuracion operativa y aprobaciones desde un solo panel.">
      <View style={{ gap: 12 }}>
        <View style={{ backgroundColor: "white", borderRadius: 28, borderWidth: 1, borderColor: "#bfd2e7", padding: 16 }}>
          <Text style={{ color: "#1f406b", fontSize: 11, letterSpacing: 2.2, textTransform: "uppercase" }}>Administracion SSD</Text>
          <Text style={{ marginTop: 3, color: "#001534", fontSize: 30, fontWeight: "700" }}>Centro de control operativo</Text>
          <Text style={{ marginTop: 4, color: "#1e3a5f", lineHeight: 21 }}>
            Calco profundo de catalogos, workflows, pasos y operacion de lineas.
          </Text>
          {error ? <Text style={{ marginTop: 6, color: "#b91c1c" }}>{error}</Text> : null}
          {info ? <Text style={{ marginTop: 6, color: "#475569" }}>{info}</Text> : null}

          <View style={{ marginTop: 9, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Tab active={section === "overview"} label="Resumen" onPress={() => setSection("overview")} />
            <Tab active={section === "steps"} label="Pasos" onPress={() => setSection("steps")} />
            <Tab active={section === "workflows"} label="Workflows" onPress={() => setSection("workflows")} />
            <Tab active={section === "catalogs"} label="Catalogos" onPress={() => setSection("catalogs")} />
            <Tab active={section === "admins"} label="Administradores" onPress={() => setSection("admins")} />
            <Tab active={section === "mobile"} label="Lineas" onPress={() => setSection("mobile")} />
          </View>
        </View>

        {section === "overview" ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <View style={{ minWidth: 200, flex: 1, borderRadius: 20, borderWidth: 1, borderColor: "#d7e4f2", backgroundColor: "white", padding: 12 }}>
              <Text style={{ color: "#64748b", fontSize: 11, textTransform: "uppercase", letterSpacing: 1.2 }}>Rutas</Text>
              <Text style={{ marginTop: 4, color: "#001534", fontSize: 34, fontWeight: "700" }}>{routeCount}</Text>
              <Pressable onPress={() => setSection("workflows")} style={{ marginTop: 6 }}>
                <Text style={{ color: "#1e3a5f", fontWeight: "700" }}>Ver workflows</Text>
              </Pressable>
            </View>
            <View style={{ minWidth: 200, flex: 1, borderRadius: 20, borderWidth: 1, borderColor: "#d7e4f2", backgroundColor: "white", padding: 12 }}>
              <Text style={{ color: "#64748b", fontSize: 11, textTransform: "uppercase", letterSpacing: 1.2 }}>Departamentos</Text>
              <Text style={{ marginTop: 4, color: "#001534", fontSize: 34, fontWeight: "700" }}>{managedDepartments.length}</Text>
              <Pressable onPress={() => setSection("catalogs")} style={{ marginTop: 6 }}>
                <Text style={{ color: "#1e3a5f", fontWeight: "700" }}>Ir a catalogos</Text>
              </Pressable>
            </View>
            <View style={{ minWidth: 200, flex: 1, borderRadius: 20, borderWidth: 1, borderColor: "#d7e4f2", backgroundColor: "white", padding: 12 }}>
              <Text style={{ color: "#64748b", fontSize: 11, textTransform: "uppercase", letterSpacing: 1.2 }}>Solicitudes</Text>
              <Text style={{ marginTop: 4, color: "#001534", fontSize: 34, fontWeight: "700" }}>{requestTypes.length}</Text>
              <Pressable onPress={() => setSection("catalogs")} style={{ marginTop: 6 }}>
                <Text style={{ color: "#1e3a5f", fontWeight: "700" }}>Gestionar</Text>
              </Pressable>
            </View>
            <View style={{ minWidth: 200, flex: 1, borderRadius: 20, borderWidth: 1, borderColor: "#d7e4f2", backgroundColor: "white", padding: 12 }}>
              <Text style={{ color: "#64748b", fontSize: 11, textTransform: "uppercase", letterSpacing: 1.2 }}>Control</Text>
              <Text style={{ marginTop: 4, color: "#001534", fontSize: 34, fontWeight: "700" }}>{admins.length}</Text>
              <Text style={{ marginTop: 2, color: "#1e3a5f" }}>{lines.length} lineas GG</Text>
            </View>
          </View>
        ) : null}

        {section === "catalogs" ? (
          <View style={{ flexDirection: isWide ? "row" : "column", gap: 10 }}>
            <View style={{ flex: isWide ? 0.8 : undefined, borderRadius: 24, borderWidth: 1, borderColor: "#bfd2e7", backgroundColor: "white", padding: 12, gap: 8 }}>
              {catalogViews.map((view) => {
                const active = activeCatalogKey === view.key;
                return (
                  <Pressable
                    key={view.key}
                    onPress={() => {
                      setActiveCatalogKey(view.key);
                      setInfo(null);
                      if (view.mode === "request-types") {
                        resetRequestTypeForm();
                      }
                    }}
                    style={({ hovered, pressed }) => ({
                      borderRadius: 18,
                      borderWidth: 1,
                      borderColor: active ? "#8ebdff" : "#d7e4f2",
                      backgroundColor: active ? "#eef5ff" : pressed ? "#eff6ff" : hovered ? "#f8fbff" : "#f9fbff",
                      padding: 10
                    })}
                  >
                    <Text style={{ color: "#001534", fontWeight: "700" }}>{view.label}</Text>
                    <Text style={{ marginTop: 3, color: "#1e3a5f" }}>{view.description}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={{ flex: isWide ? 1.2 : undefined, borderRadius: 24, borderWidth: 1, borderColor: "#bfd2e7", backgroundColor: "white", padding: 12 }}>
              {activeCatalogView.mode === "request-types" ? (
                <View style={{ gap: 8 }}>
                  {requestTypes.map((item) => (
                    <Pressable
                      key={item.id}
                      onPress={() => {
                        setRequestTypeId(item.id);
                        setRequestTypeCode(item.code);
                        setRequestTypeName(item.name);
                        setRequestTypeDescription(item.description);
                        setRequestTypeCategory(item.category);
                        setRequestTypeColor(item.theme_color);
                      }}
                      style={({ hovered, pressed }) => ({
                        borderRadius: 18,
                        borderWidth: 1,
                        borderColor: requestTypeId === item.id ? "#0b5ed7" : "#d7e4f2",
                        backgroundColor: requestTypeId === item.id ? "#eef5ff" : pressed ? "#eff6ff" : hovered ? "#f8fbff" : "#f9fbff",
                        padding: 10
                      })}
                    >
                      <Text style={{ color: "#001534", fontWeight: "700" }}>{item.name}</Text>
                      <Text style={{ marginTop: 2, color: "#475569" }}>{item.code}</Text>
                    </Pressable>
                  ))}

                  <View style={{ borderRadius: 18, borderWidth: 1, borderColor: "#d7e4f2", backgroundColor: "#f9fbff", padding: 10, gap: 8 }}>
                    <Field value={requestTypeCode} onChange={(value) => setRequestTypeCode(value.toUpperCase())} placeholder="Codigo" editable={!requestTypeId} />
                    <Field value={requestTypeName} onChange={setRequestTypeName} placeholder="Nombre" />
                    <Field value={requestTypeCategory} onChange={setRequestTypeCategory} placeholder="Categoria" />
                    <Field value={requestTypeDescription} onChange={setRequestTypeDescription} placeholder="Descripcion" multiline />
                    <Field value={requestTypeColor} onChange={setRequestTypeColor} placeholder="#0b5ed7" />

                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      <Pressable
                        onPress={() =>
                          withBusy(async () => {
                            if (!user?.email || !requestTypeCode.trim() || !requestTypeName.trim() || !requestTypeDescription.trim() || !requestTypeCategory.trim()) {
                              throw new Error("Completa codigo, nombre, categoria y descripcion");
                            }

                            const result = requestTypeId
                              ? await updateRequestType({
                                  actorEmail: user.email,
                                  id: requestTypeId,
                                  name: requestTypeName.trim(),
                                  description: requestTypeDescription.trim(),
                                  category: requestTypeCategory.trim(),
                                  themeColor: requestTypeColor.trim() || "#0b5ed7"
                                })
                              : await createRequestType({
                                  actorEmail: user.email,
                                  code: requestTypeCode.trim(),
                                  name: requestTypeName.trim(),
                                  description: requestTypeDescription.trim(),
                                  category: requestTypeCategory.trim(),
                                  themeColor: requestTypeColor.trim() || "#0b5ed7"
                                });

                            setRequestTypes(result.requestTypes);
                            setInfo(requestTypeId ? "Tipo actualizado." : "Tipo creado.");
                            resetRequestTypeForm();
                          })
                        }
                        style={{ borderRadius: 999, backgroundColor: busy ? "#94a3b8" : "#0b5ed7", paddingHorizontal: 12, paddingVertical: 9 }}
                      >
                        <Text style={{ color: "white", fontWeight: "700" }}>{requestTypeId ? "Actualizar" : "Crear"}</Text>
                      </Pressable>
                      {requestTypeId ? (
                        <Pressable
                          onPress={() =>
                            withBusy(async () => {
                              if (!user?.email || !requestTypeId) {
                                return;
                              }
                              if (typeof window !== "undefined" && !window.confirm("Se eliminara este tipo de solicitud. Continuar?")) {
                                return;
                              }
                              const result = await deleteRequestType({ actorEmail: user.email, id: requestTypeId });
                              setRequestTypes(result.requestTypes);
                              setInfo("Tipo eliminado.");
                              resetRequestTypeForm();
                            })
                          }
                          style={{ borderRadius: 999, borderWidth: 1, borderColor: "#fecdd3", backgroundColor: "#fff1f2", paddingHorizontal: 12, paddingVertical: 9 }}
                        >
                          <Text style={{ color: "#be123c", fontWeight: "700" }}>Eliminar</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                </View>
              ) : (
                <View style={{ gap: 8 }}>
                  {visibleCatalogItems.map((item) => (
                    <Pressable
                      key={item.id}
                      onPress={() => {
                        setCatalogItemId(item.id);
                        setCatalogLabel(item.item_label);
                        setCatalogValue(item.item_value);
                        setCatalogSort(String(item.sort_order));
                      }}
                      style={({ hovered, pressed }) => ({
                        borderRadius: 18,
                        borderWidth: 1,
                        borderColor: catalogItemId === item.id ? "#0b5ed7" : "#d7e4f2",
                        backgroundColor: catalogItemId === item.id ? "#eef5ff" : pressed ? "#eff6ff" : hovered ? "#f8fbff" : "#f9fbff",
                        padding: 10
                      })}
                    >
                      <Text style={{ color: "#001534", fontWeight: "700" }}>{item.item_label}</Text>
                      <Text style={{ marginTop: 2, color: "#475569" }}>{item.item_value}</Text>
                    </Pressable>
                  ))}

                  <View style={{ borderRadius: 18, borderWidth: 1, borderColor: "#d7e4f2", backgroundColor: "#f9fbff", padding: 10, gap: 8 }}>
                    <Field value={catalogLabel} onChange={setCatalogLabel} placeholder="Etiqueta" />
                    <Field value={catalogValue} onChange={setCatalogValue} placeholder="Valor" />
                    <Field value={catalogSort} onChange={setCatalogSort} placeholder="Orden" />

                    <Pressable
                      onPress={() =>
                        withBusy(async () => {
                          if (!user?.email || !catalogLabel.trim() || !catalogValue.trim()) {
                            throw new Error("Etiqueta y valor son obligatorios");
                          }

                          const sort = Number(catalogSort || "10");
                          const result = catalogItemId
                            ? await updateCatalogItem({
                                actorEmail: user.email,
                                id: catalogItemId,
                                catalogKey: activeCatalogKey,
                                itemLabel: catalogLabel.trim(),
                                itemValue: catalogValue.trim(),
                                sortOrder: Number.isFinite(sort) ? sort : 10
                              })
                            : await addCatalogItem({
                                actorEmail: user.email,
                                catalogKey: activeCatalogKey,
                                itemLabel: catalogLabel.trim(),
                                itemValue: catalogValue.trim(),
                                sortOrder: Number.isFinite(sort) ? sort : 10
                              });

                          setCatalogItems(result.items);
                          setCatalogItemId(null);
                          setCatalogLabel("");
                          setCatalogValue("");
                          setInfo(catalogItemId ? "Catalogo actualizado." : "Catalogo agregado.");
                        })
                      }
                      style={{ alignSelf: "flex-start", borderRadius: 999, backgroundColor: busy ? "#94a3b8" : "#0b5ed7", paddingHorizontal: 12, paddingVertical: 9 }}
                    >
                      <Text style={{ color: "white", fontWeight: "700" }}>{catalogItemId ? "Actualizar" : "Agregar"}</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          </View>
        ) : null}
        {section === "workflows" ? (
          <View style={{ flexDirection: isWide ? "row" : "column", gap: 10 }}>
            <View style={{ flex: isWide ? 0.82 : undefined, borderRadius: 24, borderWidth: 1, borderColor: "#bfd2e7", backgroundColor: "white", padding: 12, gap: 8 }}>
              {requestTypes.map((item) => {
                const active = workflowTypeId === item.id;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => setWorkflowTypeId(item.id)}
                    style={({ hovered, pressed }) => ({
                      borderRadius: 18,
                      borderWidth: 1,
                      borderColor: active ? "#8ebdff" : "#d7e4f2",
                      backgroundColor: active ? "#eef5ff" : pressed ? "#eff6ff" : hovered ? "#f8fbff" : "#f9fbff",
                      padding: 10
                    })}
                  >
                    <Text style={{ color: "#001534", fontWeight: "700" }}>{item.name}</Text>
                    <Text style={{ marginTop: 3, color: "#475569" }}>{item.description}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={{ flex: isWide ? 1.18 : undefined, borderRadius: 24, borderWidth: 1, borderColor: "#bfd2e7", backgroundColor: "white", padding: 12, gap: 8 }}>
              <Text style={{ color: "#001534", fontSize: 20, fontWeight: "700" }}>{selectedRequestType?.name ?? "Sin tipo seleccionado"}</Text>

              <View style={{ borderRadius: 18, borderWidth: 1, borderColor: "#d7e4f2", backgroundColor: "#f9fbff", padding: 10, gap: 8 }}>
                <Text style={{ color: "#1e3a5f", fontWeight: "700" }}>Secuencia actual</Text>
                {activeWorkflowSteps.map((step, index) => (
                  <View key={`${step.id}-${index}`} style={{ borderRadius: 14, borderWidth: 1, borderColor: "#d7e4f2", backgroundColor: "white", padding: 9 }}>
                    <Text style={{ color: "#001534", fontWeight: "700" }}>{step.label}</Text>
                    <Text style={{ color: "#475569", marginTop: 2 }}>{step.description}</Text>
                    <View style={{ marginTop: 6, flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                      <Pressable
                        onPress={() => {
                          const target = index - 1;
                          if (target < 0) return;
                          setWorkflowCodes((current) => {
                            const next = [...current];
                            [next[index], next[target]] = [next[target], next[index]];
                            return next;
                          });
                        }}
                        style={{ borderRadius: 999, borderWidth: 1, borderColor: "#bfd2e7", backgroundColor: "white", paddingHorizontal: 8, paddingVertical: 5 }}
                      ><Text style={{ color: "#1e3a5f", fontSize: 12 }}>Subir</Text></Pressable>

                      <Pressable
                        onPress={() => {
                          const target = index + 1;
                          if (target >= activeWorkflowSteps.length) return;
                          setWorkflowCodes((current) => {
                            const next = [...current];
                            [next[index], next[target]] = [next[target], next[index]];
                            return next;
                          });
                        }}
                        style={{ borderRadius: 999, borderWidth: 1, borderColor: "#bfd2e7", backgroundColor: "white", paddingHorizontal: 8, paddingVertical: 5 }}
                      ><Text style={{ color: "#1e3a5f", fontSize: 12 }}>Bajar</Text></Pressable>

                      <Pressable
                        onPress={() => setWorkflowCodes((current) => current.filter((code) => code !== step.code))}
                        style={{ borderRadius: 999, borderWidth: 1, borderColor: "#fecdd3", backgroundColor: "#fff1f2", paddingHorizontal: 8, paddingVertical: 5 }}
                      ><Text style={{ color: "#be123c", fontSize: 12 }}>Quitar</Text></Pressable>
                    </View>
                  </View>
                ))}
              </View>

              <View style={{ borderRadius: 18, borderWidth: 1, borderColor: "#d7e4f2", backgroundColor: "#f9fbff", padding: 10, gap: 8 }}>
                <Text style={{ color: "#1e3a5f", fontWeight: "700" }}>Agregar paso</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {availableWorkflowSteps.map((step) => (
                    <Pressable key={step.id} onPress={() => setWorkflowCodes((current) => [...current, step.code])} style={{ borderRadius: 999, borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "white", paddingHorizontal: 9, paddingVertical: 5 }}>
                      <Text style={{ color: "#334155", fontSize: 12 }}>{step.code}</Text>
                    </Pressable>
                  ))}
                </View>
                <Pressable
                  onPress={() =>
                    withBusy(async () => {
                      if (!user?.email || !selectedRequestType || workflowCodes.length === 0) {
                        throw new Error("Selecciona tipo y pasos");
                      }
                      const result = await updateRequestTypeWorkflow({
                        actorEmail: user.email,
                        id: selectedRequestType.id,
                        stepCodes: workflowCodes
                      });
                      setRequestTypes(result.requestTypes);
                      setInfo("Workflow guardado.");
                    })
                  }
                  style={{ alignSelf: "flex-start", borderRadius: 999, backgroundColor: busy ? "#94a3b8" : "#0b5ed7", paddingHorizontal: 12, paddingVertical: 9 }}
                >
                  <Text style={{ color: "white", fontWeight: "700" }}>Guardar workflow</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}
        {section === "steps" ? (
          <View style={{ flexDirection: isWide ? "row" : "column", gap: 10 }}>
            <View style={{ flex: isWide ? 0.82 : undefined, borderRadius: 24, borderWidth: 1, borderColor: "#bfd2e7", backgroundColor: "white", padding: 12, gap: 8 }}>
              <View style={{ borderRadius: 18, borderWidth: 1, borderColor: "#d7e4f2", backgroundColor: "#f9fbff", padding: 10, gap: 8 }}>
                <Text style={{ color: "#001534", fontWeight: "700" }}>Crear nuevo paso</Text>
                <Field value={createStepCode} onChange={(value) => setCreateStepCode(value.toUpperCase())} placeholder="Codigo" />
                <Field value={createStepLabel} onChange={setCreateStepLabel} placeholder="Etiqueta" />
                <Field value={createStepDescription} onChange={setCreateStepDescription} placeholder="Descripcion" multiline />
                <Field value={createStepScope} onChange={setCreateStepScope} placeholder="Scope" editable={createStepRouting === "scope"} />
                <Field value={createStepSortOrder} onChange={setCreateStepSortOrder} placeholder="Orden" />
                <Field value={createStepResponsibleName} onChange={setCreateStepResponsibleName} placeholder="Responsable nombre" />
                <Field value={createStepResponsibleEmail} onChange={setCreateStepResponsibleEmail} placeholder="Responsable correo" />
                <Field value={createStepResponsibleTitle} onChange={setCreateStepResponsibleTitle} placeholder="Responsable cargo" />

                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  <Pressable onPress={() => setCreateStepKind((value) => (value === "approval" ? "fulfillment" : "approval"))} style={{ borderRadius: 999, borderWidth: 1, borderColor: "#bfd2e7", backgroundColor: "white", paddingHorizontal: 10, paddingVertical: 6 }}>
                    <Text style={{ color: "#1e3a5f", fontWeight: "700" }}>Tipo: {createStepKind}</Text>
                  </Pressable>
                  <Pressable onPress={() => setCreateStepRouting((value) => (value === "scope" ? "department" : "scope"))} style={{ borderRadius: 999, borderWidth: 1, borderColor: "#bfd2e7", backgroundColor: "white", paddingHorizontal: 10, paddingVertical: 6 }}>
                    <Text style={{ color: "#1e3a5f", fontWeight: "700" }}>Ruteo: {createStepRouting}</Text>
                  </Pressable>
                </View>

                <Pressable
                  onPress={() =>
                    withBusy(async () => {
                      if (!user?.email || !createStepCode.trim() || !createStepLabel.trim() || !createStepDescription.trim()) {
                        throw new Error("Completa codigo, etiqueta y descripcion");
                      }
                      if (createStepRouting === "scope" && !createStepScope.trim()) {
                        throw new Error("Scope requerido para ruteo scope");
                      }

                      const result = await createWorkflowStep({
                        actorEmail: user.email,
                        code: createStepCode.trim(),
                        label: createStepLabel.trim(),
                        description: createStepDescription.trim(),
                        kind: createStepKind,
                        routing: createStepRouting,
                        scope: createStepRouting === "scope" ? createStepScope.trim() : null,
                        sortOrder: Number(createStepSortOrder || "999"),
                        responsibleName: createStepResponsibleName.trim() || undefined,
                        responsibleEmail: createStepResponsibleEmail.trim().toLowerCase() || undefined,
                        responsibleTitle: createStepResponsibleTitle.trim() || undefined
                      });

                      setSteps(result.steps);
                      setSelectedStepId(result.created?.id ?? "");
                      setCreateStepCode("");
                      setCreateStepLabel("");
                      setCreateStepDescription("");
                      setCreateStepKind("approval");
                      setCreateStepRouting("scope");
                      setCreateStepScope("CUSTOM");
                      setCreateStepSortOrder("999");
                      setCreateStepResponsibleName("");
                      setCreateStepResponsibleEmail("");
                      setCreateStepResponsibleTitle("");
                      setInfo("Paso creado.");
                    })
                  }
                  style={{ alignSelf: "flex-start", borderRadius: 999, backgroundColor: busy ? "#94a3b8" : "#0b5ed7", paddingHorizontal: 12, paddingVertical: 9 }}
                >
                  <Text style={{ color: "white", fontWeight: "700" }}>Crear paso</Text>
                </Pressable>
              </View>

              {sortedSteps.map((step) => (
                <Pressable key={step.id} onPress={() => setSelectedStepId(step.id)} style={({ hovered, pressed }) => ({ borderRadius: 18, borderWidth: 1, borderColor: selectedStepId === step.id ? "#8ebdff" : "#d7e4f2", backgroundColor: selectedStepId === step.id ? "#eef5ff" : pressed ? "#eff6ff" : hovered ? "#f8fbff" : "#f9fbff", padding: 10 })}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: "#001534", fontWeight: "700" }}>{step.label}</Text>
                      <Text style={{ marginTop: 2, color: "#475569" }}>{step.description}</Text>
                    </View>
                    <View style={{ gap: 4 }}>
                      <Badge text={step.active ? "Activo" : "Inactivo"} tone={step.active ? "active" : "muted"} />
                      <Badge text={`${stepUsageCount(step.code, requestTypes)} flujos`} />
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>

            <View style={{ flex: isWide ? 1.18 : undefined, borderRadius: 24, borderWidth: 1, borderColor: "#bfd2e7", backgroundColor: "white", padding: 12, gap: 8 }}>
              {selectedStep ? (
                <>
                  <Text style={{ color: "#001534", fontSize: 20, fontWeight: "700" }}>{selectedStep.label}</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    <Badge text={selectedStep.kind} />
                    <Badge text={routingLabel(selectedStep)} />
                    <Badge text={selectedStep.active ? "Activo" : "Inactivo"} tone={selectedStep.active ? "active" : "muted"} />
                  </View>

                  <Field value={stepLabel} onChange={setStepLabel} placeholder="Etiqueta" />
                  <Field value={stepDescription} onChange={setStepDescription} placeholder="Descripcion" multiline />
                  <Field value={stepSortOrder} onChange={setStepSortOrder} placeholder="Orden" />
                  <Field value={stepResponsibleName} onChange={setStepResponsibleName} placeholder="Responsable nombre" />
                  <Field value={stepResponsibleEmail} onChange={setStepResponsibleEmail} placeholder="Responsable correo" />
                  <Field value={stepResponsibleTitle} onChange={setStepResponsibleTitle} placeholder="Responsable cargo" />
                  <Pressable onPress={() => setStepActive((value) => !value)} style={{ alignSelf: "flex-start", borderRadius: 999, borderWidth: 1, borderColor: "#bfd2e7", backgroundColor: "white", paddingHorizontal: 10, paddingVertical: 7 }}>
                    <Text style={{ color: "#1e3a5f", fontWeight: "700" }}>Activo: {stepActive ? "Si" : "No"}</Text>
                  </Pressable>

                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    <Pressable
                      onPress={() =>
                        withBusy(async () => {
                          if (!user?.email || !selectedStep || !stepLabel.trim() || !stepDescription.trim()) {
                            throw new Error("Etiqueta y descripcion obligatorias");
                          }

                          const result = await updateWorkflowStep({
                            actorEmail: user.email,
                            id: selectedStep.id,
                            label: stepLabel.trim(),
                            description: stepDescription.trim(),
                            active: stepActive,
                            sortOrder: Number(stepSortOrder || "0"),
                            responsibleName: stepResponsibleName.trim() || undefined,
                            responsibleEmail: stepResponsibleEmail.trim().toLowerCase() || undefined,
                            responsibleTitle: stepResponsibleTitle.trim() || undefined,
                            clearResponsible: false
                          });

                          setSteps(result.steps);
                          setInfo("Paso actualizado.");
                        })
                      }
                      style={{ borderRadius: 999, backgroundColor: busy ? "#94a3b8" : "#0b5ed7", paddingHorizontal: 12, paddingVertical: 9 }}
                    >
                      <Text style={{ color: "white", fontWeight: "700" }}>Guardar paso</Text>
                    </Pressable>

                    <Pressable
                      onPress={() =>
                        withBusy(async () => {
                          if (!user?.email || !selectedStep) {
                            return;
                          }
                          if (typeof window !== "undefined" && !window.confirm(`Eliminar el paso ${selectedStep.label}?`)) {
                            return;
                          }

                          const result = await deleteWorkflowStep({ actorEmail: user.email, id: selectedStep.id });
                          setSteps(result.steps);
                          setRequestTypes(result.requestTypes);
                          setSelectedStepId(result.steps[0]?.id ?? "");
                          setInfo("Paso eliminado.");
                        })
                      }
                      style={{ borderRadius: 999, borderWidth: 1, borderColor: "#fecdd3", backgroundColor: "#fff1f2", paddingHorizontal: 12, paddingVertical: 9 }}
                    >
                      <Text style={{ color: "#be123c", fontWeight: "700" }}>Eliminar</Text>
                    </Pressable>

                    <Pressable
                      onPress={() =>
                        withBusy(async () => {
                          if (!user?.email || !selectedStep) {
                            return;
                          }

                          const result = await updateWorkflowStep({
                            actorEmail: user.email,
                            id: selectedStep.id,
                            label: stepLabel.trim() || selectedStep.label,
                            description: stepDescription.trim() || selectedStep.description,
                            active: stepActive,
                            sortOrder: Number(stepSortOrder || String(selectedStep.sort_order)),
                            clearResponsible: true
                          });

                          setSteps(result.steps);
                          setInfo("Responsable limpiado.");
                        })
                      }
                      style={{ borderRadius: 999, borderWidth: 1, borderColor: "#fde68a", backgroundColor: "#fffbeb", paddingHorizontal: 12, paddingVertical: 9 }}
                    >
                      <Text style={{ color: "#b45309", fontWeight: "700" }}>Limpiar responsable</Text>
                    </Pressable>
                  </View>

                  <View style={{ borderRadius: 16, borderWidth: 1, borderColor: "#d7e4f2", backgroundColor: "#f9fbff", padding: 10 }}>
                    <Text style={{ color: "#1e3a5f", fontWeight: "700" }}>Uso actual</Text>
                    <View style={{ marginTop: 6, flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                      {relatedTypesForSelectedStep.map((item) => (
                        <View key={`${selectedStep.code}-${item.code}`} style={{ borderRadius: 999, borderWidth: 1, borderColor: "#d7e4f2", backgroundColor: "white", paddingHorizontal: 9, paddingVertical: 5 }}>
                          <Text style={{ color: "#1e3a5f", fontSize: 12 }}>{item.name}</Text>
                        </View>
                      ))}
                      {relatedTypesForSelectedStep.length === 0 ? <Text style={{ color: "#475569" }}>Sin uso en workflows.</Text> : null}
                    </View>
                  </View>
                </>
              ) : (
                <Text style={{ color: "#475569" }}>No hay pasos disponibles.</Text>
              )}
            </View>
          </View>
        ) : null}

        {section === "admins" ? (
          <View style={{ borderRadius: 24, borderWidth: 1, borderColor: "#bfd2e7", backgroundColor: "white", padding: 12, gap: 8 }}>
            <Field value={adminName} onChange={setAdminName} placeholder="Nombre" />
            <Field value={adminEmail} onChange={setAdminEmail} placeholder="Correo" />
            <Pressable
              onPress={() =>
                withBusy(async () => {
                  if (!user?.email || !adminName.trim() || !adminEmail.trim()) {
                    throw new Error("Nombre y correo obligatorios");
                  }

                  const result = await addAdminUser({
                    actorEmail: user.email,
                    fullName: adminName.trim(),
                    email: adminEmail.trim().toLowerCase()
                  });

                  setAdmins(result.admins);
                  setAdminName("");
                  setAdminEmail("");
                  setInfo("Administrador agregado.");
                })
              }
              style={{ alignSelf: "flex-start", borderRadius: 999, backgroundColor: busy ? "#94a3b8" : "#0b5ed7", paddingHorizontal: 12, paddingVertical: 9 }}
            >
              <Text style={{ color: "white", fontWeight: "700" }}>Agregar administrador</Text>
            </Pressable>

            {admins.map((item) => (
              <View key={item.id} style={{ borderRadius: 16, borderWidth: 1, borderColor: "#d7e4f2", backgroundColor: "#f9fbff", padding: 10 }}>
                <Text style={{ color: "#001534", fontWeight: "700" }}>{item.full_name}</Text>
                <Text style={{ color: "#475569", marginTop: 2 }}>{item.email}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {section === "mobile" ? (
          <View style={{ borderRadius: 24, borderWidth: 1, borderColor: "#bfd2e7", backgroundColor: "white", padding: 12, gap: 8 }}>
            {lines.length === 0 ? <Text style={{ color: "#475569" }}>No hay lineas aprobadas por GG.</Text> : null}
            {lines.map((request) => {
              const beneficiaries = getBeneficiaries(request);
              return (
                <View key={request.id} style={{ borderRadius: 18, borderWidth: 1, borderColor: "#d7e4f2", backgroundColor: "#f9fbff", padding: 10 }}>
                  <Text style={{ color: "#64748b", fontSize: 11, textTransform: "uppercase", letterSpacing: 1.2 }}>{request.ticket_code}</Text>
                  <Text style={{ marginTop: 2, color: "#001534", fontWeight: "700" }}>{request.subject}</Text>
                  <Text style={{ marginTop: 3, color: "#1e3a5f" }}>{request.requester_name} | {request.department}</Text>
                  <View style={{ marginTop: 6, gap: 6 }}>
                    {beneficiaries.map((beneficiary, index) => (
                      <View key={`${request.id}-${beneficiary}-${index}`} style={{ borderRadius: 14, borderWidth: 1, borderColor: "#d7e4f2", backgroundColor: "white", padding: 8 }}>
                        <Text style={{ color: "#001534", fontWeight: "700" }}>{beneficiary}</Text>
                        <View style={{ marginTop: 6, flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                          <Pressable onPress={() => router.push(`/requests/${request.id}/responsiva?beneficiary=${encodeURIComponent(beneficiary)}` as never)} style={{ borderRadius: 999, backgroundColor: "#0b5ed7", paddingHorizontal: 10, paddingVertical: 7 }}>
                            <Text style={{ color: "white", fontWeight: "700", fontSize: 12 }}>Carta responsiva</Text>
                          </Pressable>
                          <Pressable onPress={() => router.push(`/request/${request.id}` as never)} style={{ borderRadius: 999, borderWidth: 1, borderColor: "#bfd2e7", backgroundColor: "white", paddingHorizontal: 10, paddingVertical: 7 }}>
                            <Text style={{ color: "#1e3a5f", fontWeight: "700", fontSize: 12 }}>Ver solicitud</Text>
                          </Pressable>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}
      </View>
    </AppShell>
  );
}
