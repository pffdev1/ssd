import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, Text, TextInput, View, useWindowDimensions } from "react-native";
import { createRequest, getApproverProfile, getCatalog, getRequests, getUserRoles } from "@/src/lib/api";
import { stringifyBeneficiaries } from "@/src/lib/beneficiaries";
import { formatDateTimePanama } from "@/src/lib/datetime";
import { filterRequestTypesForUser } from "@/src/lib/requestTypes";
import { getStatusLabel } from "@/src/lib/status";
import { buildCurrentUser } from "@/src/lib/user";
import {
  getAdditionalWorkflowSteps,
  REQUESTER_MANAGER_VIRTUAL_STEP_CODE
} from "@/src/lib/workflow";
import { useSession } from "@/src/context/SessionContext";
import { AppUser, CatalogResponse, FormFieldDefinition, RequestItem, RequestType } from "@/src/lib/types";
import { AppShell } from "@/src/components/AppShell";
import { ScreenSkeletonCard } from "@/src/components/Skeleton";

function parseDateParts(value: string) {
  const normalized = value.trim();
  const isoMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return {
      year: Number(isoMatch[1]),
      month: Number(isoMatch[2]),
      day: Number(isoMatch[3])
    };
  }

  const slashMatch = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (slashMatch) {
    return {
      year: Number(slashMatch[3]),
      month: Number(slashMatch[2]),
      day: Number(slashMatch[1])
    };
  }

  return null;
}

function calculateInclusiveDays(startDate: string, endDate: string) {
  const start = parseDateParts(startDate);
  const end = parseDateParts(endDate);

  if (!start || !end) {
    return null;
  }

  const startUtc = Date.UTC(start.year, start.month - 1, start.day);
  const endUtc = Date.UTC(end.year, end.month - 1, end.day);

  if (endUtc < startUtc) {
    return null;
  }

  return Math.floor((endUtc - startUtc) / 86_400_000) + 1;
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

function suggestDepartment(departments: string[], profileDepartment?: string) {
  if (!profileDepartment?.trim()) {
    return "";
  }

  const normalizedProfile = normalizeText(profileDepartment);
  const exactMatch = departments.find((item) => normalizeText(item) === normalizedProfile);

  if (exactMatch) {
    return exactMatch;
  }

  const partialMatch = departments.find((item) => {
    const normalizedItem = normalizeText(item);
    return normalizedItem.includes(normalizedProfile) || normalizedProfile.includes(normalizedItem);
  });

  return partialMatch ?? "";
}

function buildInitialFormValues(selectedType: RequestType | null, requesterName: string): Record<string, string> {
  if (!selectedType) {
    return {};
  }

  if (selectedType.code === "VACATION_REQUEST") {
    return {
      colaborador: requesterName
    };
  }

  return {};
}

function isValidCalendarDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function normalizeDateInputValue(rawValue: string) {
  const trimmedValue = rawValue.trim();

  if (!trimmedValue) {
    return "";
  }

  const isoParts = parseDateParts(trimmedValue);
  if (isoParts && isValidCalendarDate(isoParts.year, isoParts.month, isoParts.day)) {
    return trimmedValue;
  }

  const slashMatch = trimmedValue.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!slashMatch) {
    return trimmedValue;
  }

  const day = Number(slashMatch[1]);
  const month = Number(slashMatch[2]);
  const year = Number(slashMatch[3]);

  if (!isValidCalendarDate(year, month, day)) {
    return trimmedValue;
  }

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function maskDateDisplayInput(rawValue: string) {
  const digits = rawValue.replace(/\D/g, "").slice(0, 8);

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }

  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function toDisplayDate(rawValue: string) {
  const normalized = rawValue.trim();

  if (!normalized) {
    return "";
  }

  const parts = parseDateParts(normalized);
  if (!parts || !isValidCalendarDate(parts.year, parts.month, parts.day)) {
    return maskDateDisplayInput(normalized);
  }

  return `${String(parts.day).padStart(2, "0")}/${String(parts.month).padStart(2, "0")}/${String(parts.year).padStart(4, "0")}`;
}

function toIsoDateValue(rawValue: string) {
  const normalized = normalizeDateInputValue(rawValue);
  const parts = parseDateParts(normalized);

  if (!parts || !isValidCalendarDate(parts.year, parts.month, parts.day)) {
    return "";
  }

  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function formatDatePreview(value: string) {
  const parts = parseDateParts(value);
  if (!parts || !isValidCalendarDate(parts.year, parts.month, parts.day)) {
    return null;
  }

  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12));
  return new Intl.DateTimeFormat("es-PA", {
    dateStyle: "long",
    timeZone: "America/Panama"
  }).format(date);
}

function mapRequestCreationErrorMessage(submitError: unknown) {
  const fallbackMessage = "No se pudo crear la solicitud.";
  const sourceMessage = submitError instanceof Error ? submitError.message : fallbackMessage;
  const normalized = sourceMessage.toUpperCase();

  if (normalized.includes("IMMEDIATE_LEAD")) {
    return "Se detecto un workflow legacy (IMMEDIATE_LEAD) sin aprobador. Solicita a un administrador sanear workflows desde Admin > Workflows y guardar ese tipo sin pasos adicionales si aplica modo solo jefatura.";
  }

  return sourceMessage || fallbackMessage;
}

const webResizableMultilineStyle = Platform.OS === "web" ? ({ resize: "vertical" } as const) : {};

function FieldInput({
  field,
  value,
  onChange
}: {
  field: FormFieldDefinition;
  value: string;
  onChange: (nextValue: string) => void;
}) {
  if (field.type === "textarea") {
    return (
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={field.placeholder}
        multiline
        style={{
          borderWidth: 1,
          borderColor: "#d6e4f2",
          borderRadius: 16,
          paddingHorizontal: 14,
          paddingVertical: 12,
          minHeight: 100,
          maxHeight: 360,
          textAlignVertical: "top",
          backgroundColor: "#fbfdff",
          ...webResizableMultilineStyle
        }}
      />
    );
  }

  if (field.type === "date") {
    const displayValue = toDisplayDate(value);
    const isoValue = toIsoDateValue(value);
    const preview = formatDatePreview(value);

    return (
      <View style={{ gap: 6 }}>
        {Platform.OS === "web" ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <TextInput
              value={displayValue}
              onChangeText={(nextValue) => onChange(maskDateDisplayInput(nextValue))}
              placeholder={field.placeholder ?? "DD/MM/AAAA"}
              keyboardType="numbers-and-punctuation"
              autoCapitalize="none"
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: "#d6e4f2",
                borderRadius: 16,
                paddingHorizontal: 14,
                paddingVertical: 11,
                backgroundColor: "#fbfdff"
              }}
            />
            <input
              type="date"
              value={isoValue}
              aria-label={`Seleccionar ${field.label}`}
              onChange={(event) => onChange(toDisplayDate((event.target as HTMLInputElement).value))}
              style={{
                border: "1px solid #d6e4f2",
                borderRadius: 16,
                padding: "11px 14px",
                backgroundColor: "#fbfdff",
                color: "#0f172a",
                fontFamily: "inherit",
                fontSize: 14
              }}
            />
          </View>
        ) : (
          <TextInput
            value={displayValue}
            onChangeText={(nextValue) => onChange(maskDateDisplayInput(nextValue))}
            placeholder={field.placeholder ?? "DD/MM/AAAA"}
            keyboardType="numbers-and-punctuation"
            autoCapitalize="none"
            style={{
              borderWidth: 1,
              borderColor: "#d6e4f2",
              borderRadius: 16,
              paddingHorizontal: 14,
              paddingVertical: 11,
              backgroundColor: "#fbfdff"
            }}
          />
        )}
        <Text style={{ color: preview ? "#1e3a5f" : "#64748b", fontSize: 12 }}>
          {preview ? `Fecha seleccionada: ${preview}` : "Formato sugerido: DD/MM/AAAA."}
        </Text>
      </View>
    );
  }

  const optionValues = (field.options ?? [])
    .map((option) => option.option?.trim())
    .filter((option): option is string => Boolean(option));
  const hasSelectableOptions =
    optionValues.length > 0 ||
    field.type === "dropdown" ||
    field.type === "radio";

  if (hasSelectableOptions) {
    const placeholderText = field.placeholder || `Selecciona ${field.label.toLowerCase()}`;

    if (Platform.OS === "web") {
      return (
        <View style={{ position: "relative" }}>
          <select
            value={value}
            onChange={(event) => onChange((event.target as HTMLSelectElement).value)}
            style={{
              width: "100%",
              border: "1px solid #d6e4f2",
              borderRadius: 16,
              padding: "11px 40px 11px 14px",
              backgroundColor: "#fbfdff",
              color: "#0f172a",
              fontFamily: "inherit",
              fontSize: 14,
              appearance: "none",
              outline: "none"
            }}
          >
            <option value="">{placeholderText}</option>
            {optionValues.map((optionValue) => (
              <option key={optionValue} value={optionValue}>
                {optionValue}
              </option>
            ))}
          </select>
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              right: 14,
              top: 0,
              bottom: 0,
              justifyContent: "center"
            }}
          >
            <Text style={{ color: "#64748b", fontSize: 15 }}>⌄</Text>
          </View>
        </View>
      );
    }

    return (
      <View style={{ gap: 8 }}>
        {optionValues.map((optionValue) => {
          const active = optionValue === value;

          return (
            <Pressable
              key={optionValue}
              onPress={() => onChange(optionValue)}
              style={({ hovered, pressed }) => ({
                borderWidth: 1,
                borderColor: active ? "#3b82f6" : "#d6e4f2",
                backgroundColor: active ? "#eaf3ff" : pressed ? "#f5f9ff" : hovered ? "#f5f9ff" : "#fbfdff",
                borderRadius: 16,
                paddingVertical: 11,
                paddingHorizontal: 14
              })}
            >
              <Text style={{ color: "#0f172a" }}>{optionValue}</Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={field.placeholder}
      keyboardType={field.type === "number" ? "numeric" : field.type === "email" ? "email-address" : "default"}
      style={{
        borderWidth: 1,
        borderColor: "#d6e4f2",
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingVertical: 11,
        backgroundColor: "#fbfdff"
      }}
    />
  );
}

export default function SolicitudPorCodigoScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= 1240;
  const { code } = useLocalSearchParams<{ code: string }>();
  const { user, isAdmin } = useSession();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [selectedTypeCode, setSelectedTypeCode] = useState(code ?? "");

  const [department, setDepartment] = useState("");
  const [subject, setSubject] = useState("");
  const [justification, setJustification] = useState("");
  const [payload, setPayload] = useState<Record<string, string>>({});

  useEffect(() => {
    setSelectedTypeCode(code ?? "");
  }, [code]);

  useEffect(() => {
    let active = true;

    async function loadWorkspace() {
      if (!user?.email) {
        if (active) {
          setLoading(false);
        }
        return;
      }

      const startedAt = Date.now();

      try {
        const [nextCatalog, nextRequests, approverProfiles, userRoles] = await Promise.all([
          getCatalog(),
          getRequests(undefined, user.email),
          getApproverProfile(user.email),
          getUserRoles(user.email)
        ]);

        if (!active) {
          return;
        }

        const builtUser = buildCurrentUser(user.name, user.email, Boolean(isAdmin), approverProfiles, userRoles, {
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

        setCatalog(nextCatalog);
        setRequests(nextRequests);
        setCurrentUser(builtUser);
        setError(null);
      } catch {
        if (!active) {
          return;
        }
        setError("No se pudo cargar el catalogo de solicitudes.");
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
    }

    void loadWorkspace();

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

  const visibleRequestTypes = useMemo(() => {
    if (!catalog) {
      return [];
    }

    const filteredTypes = filterRequestTypesForUser(catalog.requestTypes, currentUser);

    if (code) {
      const matchedType = filteredTypes.find((type) => type.code === code);
      return matchedType ? [matchedType] : [];
    }

    return filteredTypes;
  }, [catalog, code, currentUser?.canManagePeopleFlows, currentUser?.isAdmin]);

  const groupedRequestTypes = useMemo(() => {
    return visibleRequestTypes.reduce<Record<string, RequestType[]>>((accumulator, type) => {
      if (!accumulator[type.category]) {
        accumulator[type.category] = [];
      }
      accumulator[type.category].push(type);
      return accumulator;
    }, {});
  }, [visibleRequestTypes]);

  const selectedType = useMemo(() => {
    if (code) {
      return visibleRequestTypes.find((type) => type.code === code) ?? null;
    }

    return visibleRequestTypes.find((type) => type.code === selectedTypeCode) ?? visibleRequestTypes[0] ?? null;
  }, [code, selectedTypeCode, visibleRequestTypes]);

  const suggestedDepartment = useMemo(() => {
    return suggestDepartment(catalog?.departments ?? [], currentUser?.department);
  }, [catalog?.departments, currentUser?.department]);

  useEffect(() => {
    if (!selectedType) {
      return;
    }

    setPayload(buildInitialFormValues(selectedType, user?.name ?? ""));
    setSubject(selectedType.name);
    setDepartment(suggestedDepartment);
    setError(null);
    setSuccessMessage(null);
  }, [selectedType?.code, suggestedDepartment, user?.name]);

  const visibleFields = useMemo(() => {
    if (!selectedType) {
      return [];
    }

    const nextFields = selectedType.fields
      .filter((field) => {
        if (selectedType.code !== "VACATION_REQUEST") {
          return true;
        }

        return !["diasSolicitados", "diasTomados", "planCobertura"].includes(field.name);
      })
      .map((field) => {
        if (["beneficiario", "beneficiarioActivo"].includes(field.name)) {
          return {
            ...field,
            label: field.name === "beneficiarioActivo" ? "Beneficiario(s) final(es)" : "Beneficiario(s) de la linea",
            type: "textarea" as const,
            placeholder: "Escribe uno o varios beneficiarios. Puedes separarlos por linea, coma o punto y coma."
          };
        }

        return field;
      });

    if (selectedType.code !== "VACATION_REQUEST") {
      return nextFields;
    }

    const collaboratorField = nextFields.find((field) => field.name === "colaborador") ?? {
      name: "colaborador",
      label: "Colaborador",
      type: "text" as const,
      required: true,
      placeholder: "Nombre del colaborador que tomara la ausencia"
    };
    const otherFields = nextFields.filter((field) => field.name !== "colaborador");

    return [collaboratorField, ...otherFields];
  }, [selectedType]);

  const routeSteps = useMemo(() => {
    if (!selectedType) {
      return [];
    }

    const workflowSteps = Array.isArray(selectedType.workflow?.steps) ? selectedType.workflow.steps : [];
    const withoutManager = getAdditionalWorkflowSteps(workflowSteps);

    return [
      {
        code: REQUESTER_MANAGER_VIRTUAL_STEP_CODE,
        label: "Aprobacion de Jefatura Inmediata",
        kind: "approval" as const,
        routing: "scope" as const,
        scope: "REQUESTER_MANAGER"
      },
      ...withoutManager
    ];
  }, [selectedType]);

  const departmentStepAssignments = useMemo(() => {
    if (!selectedType || !catalog || !currentUser) {
      return [];
    }

    const baseSteps = getAdditionalWorkflowSteps(selectedType.workflow.steps);

    const managerApprover = currentUser.managerEmail
      ? {
          full_name: currentUser.managerName ?? "Jefatura inmediata",
          email: currentUser.managerEmail,
          title: currentUser.managerTitle ?? "Jefatura inmediata"
        }
      : null;

    const managerStep = {
      step: {
        code: REQUESTER_MANAGER_VIRTUAL_STEP_CODE,
        label: "Aprobacion de Jefatura Inmediata",
        kind: "approval" as const,
        routing: "scope" as const,
        scope: "REQUESTER_MANAGER"
      },
      approver: managerApprover,
      isSelf: managerApprover ? managerApprover.email.trim().toLowerCase() === currentUser.email.trim().toLowerCase() : false
    };

    const mappedDepartmentSteps = baseSteps
      .filter((step) => step.routing === "department")
      .map((step) => {
        const approver = catalog.approvers
          .filter((item) => item.department === department && item.role_code === step.code)
          .sort((a, b) => a.sort_order - b.sort_order)[0];

        const resolvedApprover = approver
          ? {
              full_name: approver.full_name,
              email: approver.email,
              title: approver.title
            }
          : null;

        return {
          step,
          approver: resolvedApprover,
          isSelf: resolvedApprover ? resolvedApprover.email.trim().toLowerCase() === currentUser.email.trim().toLowerCase() : false
        };
      });

    return [managerStep, ...mappedDepartmentSteps];
  }, [catalog, currentUser, department, selectedType]);

  const vacationDays = useMemo(() => {
    if (selectedType?.code !== "VACATION_REQUEST") {
      return null;
    }

    return calculateInclusiveDays(payload.fechaInicio ?? "", payload.fechaFin ?? "");
  }, [payload.fechaFin, payload.fechaInicio, selectedType?.code]);

  async function handleSubmit() {
    if (!selectedType || !user) {
      return;
    }

    if (!department.trim() || !subject.trim() || !justification.trim()) {
      setError("Departamento, asunto y justificacion son obligatorios.");
      return;
    }

    for (const field of visibleFields) {
      if (field.required && !(payload[field.name] ?? "").trim()) {
        setError(`El campo ${field.label} es obligatorio.`);
        return;
      }
    }

    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const normalizedPayload = {
        ...payload
      };

      for (const field of visibleFields) {
        if (field.type !== "date") {
          continue;
        }

        const normalizedDateValue = normalizeDateInputValue(normalizedPayload[field.name] ?? "");
        normalizedPayload[field.name] = normalizedDateValue;

        if (normalizedDateValue && !parseDateParts(normalizedDateValue)) {
          throw new Error(`El campo ${field.label} debe usar formato AAAA-MM-DD o DD/MM/AAAA.`);
        }
      }

      if (selectedType.code === "VACATION_REQUEST") {
        const normalizedVacationDays = calculateInclusiveDays(normalizedPayload.fechaInicio ?? "", normalizedPayload.fechaFin ?? "");
        if (normalizedVacationDays === null) {
          throw new Error("Completa una fecha de inicio y fin valida para calcular los dias tomados.");
        }

        delete normalizedPayload.diasSolicitados;
        delete normalizedPayload.planCobertura;
        normalizedPayload.diasTomados = String(normalizedVacationDays);
      }

      const created = await createRequest({
        requestTypeCode: selectedType.code,
        requesterName: user.name,
        requesterEmail: user.email,
        requesterManagerEmail: currentUser?.managerEmail ?? user.managerEmail,
        requesterManagerName: currentUser?.managerName ?? user.managerName,
        requesterManagerTitle: currentUser?.managerTitle ?? user.managerTitle,
        department: department.trim(),
        subject: subject.trim(),
        justification: justification.trim(),
        beneficiaryName: stringifyBeneficiaries(normalizedPayload),
        payload: normalizedPayload
      });

      setSuccessMessage(`Solicitud creada con ticket ${created.ticketCode}.`);
      setJustification("");
      setPayload(buildInitialFormValues(selectedType, user.name));
    } catch (submitError) {
      setError(mapRequestCreationErrorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  const baseTitle = selectedType ? selectedType.name : "Nueva solicitud";
  const singleTypeView = Boolean(code) || visibleRequestTypes.length <= 1;

  return (
    <AppShell
      title={`SSD | ${baseTitle}`}
      subtitle="Flujo individual de solicitud con formulario, aprobaciones y trazabilidad orientados al tipo seleccionado."
    >
      {loading ? <ScreenSkeletonCard rows={7} /> : null}

      {!loading && !selectedType ? (
        <View style={{ backgroundColor: "white", borderRadius: 30, borderWidth: 1, borderColor: "#bfd2e7", padding: 16 }}>
          <Text style={{ color: "#0f2440", fontWeight: "700" }}>Tipo no encontrado</Text>
          <Text style={{ marginTop: 6, color: "#475569" }}>No se encontro el tipo de solicitud.</Text>
        </View>
      ) : null}

      {!loading && selectedType ? (
        <View style={{ flexDirection: isWide ? "row" : "column", alignItems: "flex-start", gap: 12 }}>
          {!singleTypeView ? (
            <View
              style={{
                flex: isWide ? 0.95 : undefined,
                alignSelf: "stretch",
                backgroundColor: "white",
                borderRadius: 30,
                borderWidth: 1,
                borderColor: "#bfd2e7",
                padding: 16
              }}
            >
              <Text style={{ color: "#1f406b", fontSize: 11, letterSpacing: 2.2, textTransform: "uppercase" }}>
                Catalogo de solicitudes
              </Text>
              <Text style={{ marginTop: 6, color: "#001534", fontSize: 24, fontWeight: "700" }}>Solicitudes disponibles</Text>
              <Text style={{ marginTop: 6, color: "#1e3a5f", lineHeight: 22 }}>
                Selecciona un flujo para ver formulario y ruta de aprobacion.
              </Text>

              <View style={{ marginTop: 10, gap: 8 }}>
                {Object.entries(groupedRequestTypes).map(([category, types]) => (
                  <View key={category} style={{ gap: 6 }}>
                    <Text style={{ color: "#64748b", fontSize: 11, letterSpacing: 1.6, textTransform: "uppercase" }}>
                      {category}
                    </Text>
                    {types.map((type) => {
                      const active = selectedType.code === type.code;

                      return (
                        <Pressable
                          key={type.code}
                          onPress={() => {
                            setSelectedTypeCode(type.code);
                            router.replace(`/solicitudes/${encodeURIComponent(type.code)}` as never);
                          }}
                          style={({ hovered, pressed }) => ({
                            borderRadius: 20,
                            borderWidth: 1,
                            borderColor: active ? "#9cb8d6" : "#d7e4f2",
                            backgroundColor: active ? "#eaf6ff" : pressed ? "#eff6ff" : hovered ? "#eff6ff" : "#f5faff",
                            padding: 12
                          })}
                        >
                          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                            <View style={{ flex: 1 }}>
                              <Text style={{ color: "#001534", fontWeight: "700", fontSize: 16 }}>{type.name}</Text>
                              <Text style={{ color: "#1e3a5f", marginTop: 5, lineHeight: 20 }}>{type.description}</Text>
                            </View>
                            <View style={{ width: 4, borderRadius: 999, backgroundColor: type.theme_color || "#0b5ed7", minHeight: 36 }} />
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <View style={{ flex: isWide ? 1.2 : undefined, alignSelf: "stretch", gap: 12 }}>
            <View style={{ backgroundColor: "white", borderRadius: 30, borderWidth: 1, borderColor: "#bfd2e7", padding: 16 }}>
            <Text style={{ color: "#1f406b", fontSize: 12, letterSpacing: 2, textTransform: "uppercase" }}>Nueva solicitud</Text>
            <Text style={{ marginTop: 8, color: "#0f2440", fontSize: 21, fontWeight: "700" }}>{selectedType.name}</Text>
            <Text style={{ marginTop: 6, color: "#475569" }}>{selectedType.description}</Text>
            {selectedType.requires_general_management ? (
              <View style={{ marginTop: 10, alignSelf: "flex-start", borderRadius: 999, borderWidth: 1, borderColor: "#9cb8d6", backgroundColor: "#eaf6ff", paddingHorizontal: 12, paddingVertical: 6 }}>
                <Text style={{ color: "#1e3a5f", fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase" }}>
                  Incluye aprobacion GG
                </Text>
              </View>
            ) : null}
          </View>

          <View style={{ backgroundColor: "white", borderRadius: 30, borderWidth: 1, borderColor: "#bfd2e7", padding: 16, gap: 10 }}>
            <Text style={{ fontWeight: "700", color: "#0f2440", fontSize: 16 }}>Datos generales</Text>
            <View style={{ gap: 6 }}>
              <Text style={{ color: "#334155", fontWeight: "600" }}>Solicitante</Text>
              <View style={{ borderWidth: 1, borderColor: "#d7e4f2", borderRadius: 12, backgroundColor: "#f5faff", paddingHorizontal: 12, paddingVertical: 10 }}>
                <Text style={{ color: "#0f2440" }}>{user.name}</Text>
              </View>
            </View>

            <View style={{ gap: 6 }}>
              <Text style={{ color: "#334155", fontWeight: "600" }}>Correo corporativo</Text>
              <View style={{ borderWidth: 1, borderColor: "#d7e4f2", borderRadius: 12, backgroundColor: "#f5faff", paddingHorizontal: 12, paddingVertical: 10 }}>
                <Text style={{ color: "#0f2440" }}>{user.email}</Text>
              </View>
            </View>

            <View style={{ gap: 6 }}>
              <Text style={{ color: "#334155", fontWeight: "600" }}>Jefatura inmediata (Entra)</Text>
              <View style={{ borderWidth: 1, borderColor: "#d7e4f2", borderRadius: 12, backgroundColor: "#f5faff", paddingHorizontal: 12, paddingVertical: 10 }}>
                <Text style={{ color: "#0f2440", fontWeight: "700" }}>
                  {user.managerName ?? "Jefatura inmediata"}
                </Text>
                <Text style={{ marginTop: 2, color: "#1e3a5f" }}>{user.managerEmail ?? "No disponible"}</Text>
                {user.managerTitle ? <Text style={{ marginTop: 2, color: "#475569" }}>{user.managerTitle}</Text> : null}
              </View>
            </View>

            <View style={{ gap: 6 }}>
              <Text style={{ color: "#334155", fontWeight: "600" }}>Departamento</Text>
              {Platform.OS === "web" ? (
                <View style={{ position: "relative" }}>
                  <select
                    value={department}
                    onChange={(event) => setDepartment((event.target as HTMLSelectElement).value)}
                    style={{
                      width: "100%",
                      border: "1px solid #d6e4f2",
                      borderRadius: 16,
                      padding: "11px 40px 11px 14px",
                      backgroundColor: "#fbfdff",
                      color: "#0f172a",
                      fontFamily: "inherit",
                      fontSize: 14,
                      appearance: "none",
                      outline: "none"
                    }}
                  >
                    <option value="">Selecciona un departamento</option>
                    {(catalog?.departments ?? []).map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                  <View
                    pointerEvents="none"
                    style={{
                      position: "absolute",
                      right: 14,
                      top: 0,
                      bottom: 0,
                      justifyContent: "center"
                    }}
                  >
                    <Text style={{ color: "#64748b", fontSize: 15 }}>⌄</Text>
                  </View>
                </View>
              ) : (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {(catalog?.departments ?? []).map((item) => (
                    <Pressable
                      key={item}
                      onPress={() => setDepartment(item)}
                      style={({ hovered, pressed }) => ({
                        borderWidth: 1,
                        borderColor: department === item ? "#3b82f6" : "#d6e4f2",
                        borderRadius: 999,
                        paddingHorizontal: 11,
                        paddingVertical: 5,
                        backgroundColor:
                          department === item ? "#eaf3ff" : pressed ? "#f5f9ff" : hovered ? "#f5f9ff" : "#fbfdff"
                      })}
                    >
                      <Text style={{ fontSize: 12, color: department === item ? "#1e3a8a" : "#334155" }}>{item}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            <View style={{ gap: 6 }}>
              <Text style={{ color: "#334155", fontWeight: "600" }}>Asunto</Text>
              <TextInput
                value={subject}
                onChangeText={setSubject}
                placeholder="Asunto ejecutivo de la solicitud"
                style={{ borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "white" }}
              />
            </View>

            <View style={{ gap: 6 }}>
              <Text style={{ color: "#334155", fontWeight: "600" }}>Justificacion general</Text>
              <TextInput
                value={justification}
                onChangeText={setJustification}
                placeholder="Explica el impacto operativo y urgencia"
                multiline
                style={{
                  borderWidth: 1,
                  borderColor: "#cbd5e1",
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  minHeight: 110,
                  maxHeight: 360,
                  textAlignVertical: "top",
                  backgroundColor: "white",
                  ...webResizableMultilineStyle
                }}
              />
            </View>
          </View>

          <View style={{ backgroundColor: "white", borderRadius: 30, borderWidth: 1, borderColor: "#bfd2e7", padding: 16, gap: 12 }}>
            <Text style={{ fontWeight: "700", color: "#0f2440", fontSize: 16 }}>Campos del formulario</Text>
            {visibleFields.map((field) => (
              <View key={field.name} style={{ gap: 6 }}>
                <Text style={{ color: "#334155", fontWeight: "600" }}>
                  {field.label}
                  {field.required ? " *" : ""}
                </Text>
                <FieldInput
                  field={field}
                  value={payload[field.name] ?? ""}
                  onChange={(nextValue) =>
                    setPayload((current) => ({
                      ...current,
                      [field.name]: nextValue
                    }))
                  }
                />
              </View>
            ))}
          </View>

          <View style={{ backgroundColor: "white", borderRadius: 30, borderWidth: 1, borderColor: "#bfd2e7", padding: 16, gap: 8 }}>
            <Text style={{ color: "#1f406b", fontSize: 12, letterSpacing: 2, textTransform: "uppercase" }}>Ruta de aprobacion</Text>
            {routeSteps.length === 0 ? (
              <Text style={{ color: "#475569" }}>No hay pasos configurados para este tipo de solicitud.</Text>
            ) : (
              routeSteps.map((step, index) => (
                <View key={`${step.code}-${index}`} style={{ borderWidth: 1, borderColor: "#d7e4f2", borderRadius: 12, padding: 10, backgroundColor: "#f9fbff" }}>
                  <Text style={{ color: "#0f2440", fontWeight: "700" }}>
                    {index + 1}. {step.label}
                  </Text>
                  <Text style={{ color: "#64748b", marginTop: 4, fontSize: 12 }}>
                    {step.kind === "approval" ? "Aprobacion" : "Ejecucion"} -{" "}
                    {step.routing === "department" ? "Por departamento" : step.scope ?? "Scope"}
                  </Text>
                  {(() => {
                    const preview = departmentStepAssignments.find((item) => item.step.code === step.code);

                    if (step.code === REQUESTER_MANAGER_VIRTUAL_STEP_CODE) {
                      if (preview?.approver) {
                        return (
                          <Text style={{ color: "#1e3a5f", marginTop: 6 }}>
                            SSD usara tu jefatura inmediata: {preview.approver.full_name}.
                          </Text>
                        );
                      }

                      return (
                        <Text style={{ color: "#64748b", marginTop: 6 }}>
                          No se detecto jefatura en Entra. El flujo continuara con pasos adicionales.
                        </Text>
                      );
                    }

                    if (step.routing !== "department" || !department) {
                      return null;
                    }

                    if (preview?.isSelf) {
                      return (
                        <Text style={{ color: "#7c2d12", marginTop: 6 }}>
                          Autoomitido por autoaprobacion al coincidir con solicitante.
                        </Text>
                      );
                    }

                    if (preview?.approver) {
                      return (
                        <Text style={{ color: "#1e3a5f", marginTop: 6 }}>
                          Responsable: {preview.approver.full_name}
                        </Text>
                      );
                    }

                    return (
                      <Text style={{ color: "#7c2d12", marginTop: 6 }}>
                        Responsable pendiente por configurar para {department}.
                      </Text>
                    );
                  })()}
                </View>
              ))
            )}
          </View>

            {selectedType.code === "VACATION_REQUEST" ? (
              <View style={{ borderRadius: 16, borderWidth: 1, borderColor: "#d7e4f2", backgroundColor: "#f5faff", padding: 12 }}>
                <Text style={{ color: "#334155", fontWeight: "600" }}>Dias tomados</Text>
                <Text style={{ color: "#0f2440", marginTop: 6 }}>
                  {vacationDays === null
                    ? "Completa fecha de inicio y fin para calcular automaticamente los dias."
                    : `${vacationDays} dia${vacationDays === 1 ? "" : "s"}`}
                </Text>
              </View>
            ) : null}

          {error ? <Text style={{ color: "#b91c1c" }}>{error}</Text> : null}
          {successMessage ? <Text style={{ color: "#047857" }}>{successMessage}</Text> : null}

          <Pressable
            onPress={handleSubmit}
            disabled={submitting}
            style={{
              backgroundColor: submitting ? "#94a3b8" : "#1e3a5f",
              borderRadius: 999,
              paddingVertical: 12,
              alignItems: "center",
              alignSelf: "flex-start",
              paddingHorizontal: 18
            }}
          >
            <Text style={{ color: "white", fontWeight: "700" }}>{submitting ? "Registrando..." : "Crear solicitud"}</Text>
          </Pressable>
          </View>

          <View style={{ flex: isWide ? 0.85 : undefined, alignSelf: "stretch", gap: 12 }}>
            <View style={{ backgroundColor: "white", borderRadius: 30, borderWidth: 1, borderColor: "#bfd2e7", padding: 16 }}>
              <Text style={{ color: "#1f406b", fontSize: 11, letterSpacing: 2.2, textTransform: "uppercase" }}>
                Perfil de acceso
              </Text>
              <Text style={{ marginTop: 6, color: "#001534", fontSize: 22, fontWeight: "700" }}>Tu visibilidad actual</Text>
              <View style={{ marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {(currentUser?.roleLabels?.length ? currentUser.roleLabels : ["Colaborador"]).map((role) => (
                  <View key={role} style={{ borderRadius: 999, borderWidth: 1, borderColor: "#d7e4f2", backgroundColor: "#f5faff", paddingHorizontal: 10, paddingVertical: 6 }}>
                    <Text style={{ color: "#334155", fontWeight: "600", fontSize: 12 }}>{role}</Text>
                  </View>
                ))}
              </View>
              {!currentUser?.canManagePeopleFlows ? (
                <Text style={{ marginTop: 10, color: "#475569", lineHeight: 22 }}>
                  Los flujos de personal y desvinculacion solo se muestran para jefaturas, RRHH o administradores.
                </Text>
              ) : null}
            </View>

            <View style={{ backgroundColor: "white", borderRadius: 30, borderWidth: 1, borderColor: "#bfd2e7", padding: 16, gap: 8 }}>
              <Text style={{ color: "#1f406b", fontSize: 11, letterSpacing: 2.2, textTransform: "uppercase" }}>
                Solicitudes recientes
              </Text>
              {requests.slice(0, 5).map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => router.push(`/requests/${item.id}`)}
                  style={({ hovered, pressed }) => ({
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: "#d7e4f2",
                    backgroundColor: pressed ? "#eaf6ff" : hovered ? "#eaf6ff" : "#f5faff",
                    padding: 12
                  })}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: "#64748b", fontSize: 11, letterSpacing: 1.3, textTransform: "uppercase" }}>
                        {item.ticket_code}
                      </Text>
                      <Text style={{ color: "#001534", marginTop: 3, fontWeight: "700", fontSize: 18 }}>
                        {item.subject}
                      </Text>
                      <Text style={{ marginTop: 6, color: "#1e3a5f" }}>{item.requester_name}</Text>
                    </View>
                    <View style={{ borderRadius: 999, borderWidth: 1, borderColor: "#bfdbfe", backgroundColor: "#eff6ff", paddingHorizontal: 10, paddingVertical: 5 }}>
                      <Text style={{ color: "#1e3a8a", fontWeight: "700", fontSize: 12 }}>{getStatusLabel(item.status)}</Text>
                    </View>
                  </View>
                  <Text style={{ color: "#64748b", marginTop: 8, fontSize: 12 }}>
                    {item.department} | {formatDateTimePanama(item.created_at)}
                  </Text>
                </Pressable>
              ))}
              {requests.length === 0 ? (
                <View style={{ borderRadius: 20, borderWidth: 1, borderColor: "#d7e4f2", backgroundColor: "#f5faff", padding: 12 }}>
                  <Text style={{ color: "#475569" }}>No hay solicitudes recientes.</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      ) : null}
    </AppShell>
  );
}











