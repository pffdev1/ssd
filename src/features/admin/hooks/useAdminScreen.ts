import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { useWindowDimensions } from "react-native";
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
import { AdminUser, CatalogItem, RequestItem, RequestType, WorkflowStepTemplate } from "@/src/lib/types";
import {
  buildWorkflowCodesToPersist,
  getAdditionalWorkflowCodes,
  isManagerWorkflowStepCode,
  resolveManagerWorkflowStepCode
} from "@/src/lib/workflow";
import {
  AdminSection,
  catalogViews,
  CatalogView,
  CatalogViewKey
} from "@/src/features/admin/lib/config";
import { buildRouteCount, routingLabel, stepUsageCount } from "@/src/features/admin/lib/selectors";

const MANAGER_FALLBACK_STEP_CODE = "IMMEDIATE_LEAD";
const MANAGER_FALLBACK_SCOPE = "REQUESTER_MANAGER";

function readErrorMessage(value: unknown) {
  if (value instanceof Error) {
    return value.message;
  }

  return String(value ?? "");
}

type AdminScreenUiState = {
  isWide: boolean;
  loading: boolean;
  isAdmin: boolean;
  error: string | null;
  info: string | null;
  section: AdminSection;
  setSection: (section: AdminSection) => void;
};

type AdminOverviewState = {
  routeCount: number;
  departmentCount: number;
  requestTypeCount: number;
  adminCount: number;
  approvedLinesCount: number;
  onOpenWorkflows: () => void;
  onOpenCatalogs: () => void;
};

type AdminCatalogsSectionState = {
  busy: boolean;
  catalogViews: CatalogView[];
  activeCatalogKey: CatalogViewKey;
  activeCatalogMode: "request-types" | "catalog";
  requestTypes: RequestType[];
  requestTypeId: string | null;
  requestTypeCode: string;
  requestTypeName: string;
  requestTypeCategory: string;
  requestTypeDescription: string;
  requestTypeColor: string;
  visibleCatalogItems: CatalogItem[];
  catalogItemId: string | null;
  catalogLabel: string;
  catalogValue: string;
  catalogSort: string;
  onSelectCatalogView: (view: CatalogView) => void;
  onSelectRequestType: (item: RequestType) => void;
  onRequestTypeCodeChange: (value: string) => void;
  onRequestTypeNameChange: (value: string) => void;
  onRequestTypeCategoryChange: (value: string) => void;
  onRequestTypeDescriptionChange: (value: string) => void;
  onRequestTypeColorChange: (value: string) => void;
  onSaveRequestType: () => void | Promise<void>;
  onDeleteRequestType: () => void | Promise<void>;
  onSelectCatalogItem: (item: CatalogItem) => void;
  onCatalogLabelChange: (value: string) => void;
  onCatalogValueChange: (value: string) => void;
  onCatalogSortChange: (value: string) => void;
  onSaveCatalogItem: () => void | Promise<void>;
};

type AdminWorkflowsSectionState = {
  busy: boolean;
  requestTypes: RequestType[];
  workflowTypeId: string;
  selectedRequestTypeName: string | null;
  activeWorkflowSteps: WorkflowStepTemplate[];
  availableWorkflowSteps: WorkflowStepTemplate[];
  onSelectWorkflowType: (requestTypeId: string) => void;
  onMoveStepUp: (index: number) => void;
  onMoveStepDown: (index: number) => void;
  onRemoveStep: (stepCode: string) => void;
  onAddStep: (stepCode: string) => void;
  onSave: () => void | Promise<void>;
};

type AdminStepsSectionState = {
  busy: boolean;
  sortedSteps: WorkflowStepTemplate[];
  selectedStepId: string;
  selectedStep: WorkflowStepTemplate | null;
  createStepCode: string;
  createStepLabel: string;
  createStepDescription: string;
  createStepKind: "approval" | "fulfillment";
  createStepRouting: "department" | "scope";
  createStepScope: string;
  createStepSortOrder: string;
  createStepResponsibleName: string;
  createStepResponsibleEmail: string;
  createStepResponsibleTitle: string;
  stepLabel: string;
  stepDescription: string;
  stepActive: boolean;
  stepSortOrder: string;
  stepResponsibleName: string;
  stepResponsibleEmail: string;
  stepResponsibleTitle: string;
  relatedTypesForSelectedStep: RequestType[];
  onCreateStepCodeChange: (value: string) => void;
  onCreateStepLabelChange: (value: string) => void;
  onCreateStepDescriptionChange: (value: string) => void;
  onCreateStepScopeChange: (value: string) => void;
  onCreateStepSortOrderChange: (value: string) => void;
  onCreateStepResponsibleNameChange: (value: string) => void;
  onCreateStepResponsibleEmailChange: (value: string) => void;
  onCreateStepResponsibleTitleChange: (value: string) => void;
  onToggleCreateStepKind: () => void;
  onToggleCreateStepRouting: () => void;
  onCreateStep: () => void | Promise<void>;
  onSelectStep: (stepId: string) => void;
  onStepLabelChange: (value: string) => void;
  onStepDescriptionChange: (value: string) => void;
  onStepSortOrderChange: (value: string) => void;
  onStepResponsibleNameChange: (value: string) => void;
  onStepResponsibleEmailChange: (value: string) => void;
  onStepResponsibleTitleChange: (value: string) => void;
  onToggleStepActive: () => void;
  onSaveStep: () => void | Promise<void>;
  onDeleteStep: () => void | Promise<void>;
  onClearResponsible: () => void | Promise<void>;
  getStepUsageCount: (stepCode: string) => number;
  getRoutingLabel: (step: Pick<WorkflowStepTemplate, "routing" | "scope">) => string;
};

type AdminAdminsSectionState = {
  busy: boolean;
  adminName: string;
  adminEmail: string;
  admins: AdminUser[];
  onAdminNameChange: (value: string) => void;
  onAdminEmailChange: (value: string) => void;
  onAddAdmin: () => void | Promise<void>;
};

type AdminMobileSectionState = {
  lines: RequestItem[];
  onOpenResponsiva: (requestId: string, beneficiary: string) => void;
  onOpenRequest: (requestId: string) => void;
};

export type UseAdminScreenState = {
  ui: AdminScreenUiState;
  overview: AdminOverviewState;
  sections: {
    catalogs: AdminCatalogsSectionState;
    workflows: AdminWorkflowsSectionState;
    steps: AdminStepsSectionState;
    admins: AdminAdminsSectionState;
    mobile: AdminMobileSectionState;
  };
};

export function useAdminScreen(): UseAdminScreenState {
  const { width } = useWindowDimensions();
  const isWide = width >= 1220;
  const { user } = useSession();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [section, setSection] = useState<AdminSection>("overview");

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
    () =>
      catalogItems
        .filter((item) => item.catalog_key === "DEPARTMENT" && item.active)
        .map((item) => item.item_value),
    [catalogItems]
  );
  const visibleCatalogItems = useMemo(
    () =>
      catalogItems
        .filter((item) => item.catalog_key === activeCatalogKey)
        .sort((a, b) => a.sort_order - b.sort_order || a.item_label.localeCompare(b.item_label)),
    [catalogItems, activeCatalogKey]
  );
  const managerWorkflowStepCode = useMemo(
    () => resolveManagerWorkflowStepCode(sortedSteps),
    [sortedSteps]
  );
  const additionalWorkflowCodes = useMemo(() => getAdditionalWorkflowCodes(workflowCodes), [workflowCodes]);
  const activeWorkflowSteps = useMemo(
    () =>
      additionalWorkflowCodes
        .map((code) => sortedSteps.find((item) => item.code === code))
        .filter(Boolean) as WorkflowStepTemplate[],
    [additionalWorkflowCodes, sortedSteps]
  );
  const availableWorkflowSteps = useMemo(
    () =>
      sortedSteps.filter(
        (item) =>
          item.active &&
          !workflowCodes.includes(item.code) &&
          !isManagerWorkflowStepCode(item.code)
      ),
    [sortedSteps, workflowCodes]
  );
  const relatedTypesForSelectedStep = useMemo(() => {
    if (!selectedStep) {
      return [];
    }
    return requestTypes.filter((item) =>
      item.workflow.steps.some((step) => step.code === selectedStep.code)
    );
  }, [requestTypes, selectedStep]);
  const routeCount = useMemo(
    () => buildRouteCount(managedDepartments, steps),
    [managedDepartments, steps]
  );

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

    setWorkflowCodes(getAdditionalWorkflowCodes(selectedRequestType.workflow.steps.map((step) => step.code)));
  }, [selectedRequestType]);

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

  function moveWorkflowStep(fromIndex: number, toIndex: number) {
    setWorkflowCodes((current) => {
      if (toIndex < 0 || toIndex >= current.length) {
        return current;
      }

      const next = [...current];
      [next[fromIndex], next[toIndex]] = [next[toIndex], next[fromIndex]];
      return next;
    });
  }

  function removeWorkflowStep(stepCode: string) {
    setWorkflowCodes((current) => current.filter((code) => code !== stepCode));
  }

  function addWorkflowStep(stepCode: string) {
    setWorkflowCodes((current) => getAdditionalWorkflowCodes([...current, stepCode]));
  }

  async function ensureManagerWorkflowStepTemplate(actorEmail: string) {
    const resolvedFromCurrent = resolveManagerWorkflowStepCode(sortedSteps);
    if (resolvedFromCurrent) {
      return resolvedFromCurrent;
    }

    try {
      const created = await createWorkflowStep({
        actorEmail,
        code: MANAGER_FALLBACK_STEP_CODE,
        label: "Aprobacion de Jefatura Inmediata",
        description: "Aprobacion automatica de la jefatura inmediata del solicitante.",
        kind: "approval",
        routing: "scope",
        scope: MANAGER_FALLBACK_SCOPE,
        sortOrder: 5
      });

      setSteps(created.steps);
      return created.created.code;
    } catch (error) {
      const refreshedSteps = await getWorkflowSteps(actorEmail);
      setSteps(refreshedSteps);

      const resolvedFromRefresh = resolveManagerWorkflowStepCode(refreshedSteps);
      if (resolvedFromRefresh) {
        return resolvedFromRefresh;
      }

      const details = readErrorMessage(error);
      throw new Error(details || "No se pudo crear el paso de jefatura inmediata.");
    }
  }

  function saveWorkflow() {
    return withBusy(async () => {
      if (!user?.email || !selectedRequestType) {
        throw new Error("Selecciona un tipo de solicitud");
      }

      const validCodes = new Set(sortedSteps.map((step) => step.code.trim().toUpperCase()));
      const sanitizedAdditionalWorkflowCodes = additionalWorkflowCodes.filter((code) =>
        validCodes.has(code.trim().toUpperCase())
      );
      const persistence = buildWorkflowCodesToPersist(
        sanitizedAdditionalWorkflowCodes,
        managerWorkflowStepCode
      );

      let codesToPersist = persistence.stepCodes;
      if (codesToPersist.length === 0) {
        const managerStepCode = await ensureManagerWorkflowStepTemplate(user.email);
        codesToPersist = [managerStepCode];
      }

      let result;
      try {
        result = await updateRequestTypeWorkflow({
          actorEmail: user.email,
          id: selectedRequestType.id,
          stepCodes: codesToPersist
        });
      } catch (error) {
        const message = readErrorMessage(error);
        const requiresFallbackManagerStep =
          message.includes("Debes mantener al menos un paso") ||
          message.includes("Paso no permitido en el workflow");

        if (!requiresFallbackManagerStep) {
          throw error;
        }

        const managerStepCode = await ensureManagerWorkflowStepTemplate(user.email);
        result = await updateRequestTypeWorkflow({
          actorEmail: user.email,
          id: selectedRequestType.id,
          stepCodes: [managerStepCode]
        });
      }

      setRequestTypes(result.requestTypes);
      const baseMessage = persistence.managerOnlyMode
        ? "Workflow guardado sin pasos adicionales. Solo aprobara la jefatura inmediata."
        : "Workflow guardado.";
      const normalizedMessage =
        sanitizedAdditionalWorkflowCodes.length !== additionalWorkflowCodes.length
          ? `${baseMessage} Se omitieron pasos que no existen en catalogo.`
          : baseMessage;
      setInfo(normalizedMessage);
    });
  }

  function toggleCreateStepKind() {
    setCreateStepKind((value) => (value === "approval" ? "fulfillment" : "approval"));
  }

  function toggleCreateStepRouting() {
    setCreateStepRouting((value) => (value === "scope" ? "department" : "scope"));
  }

  function createStep() {
    return withBusy(async () => {
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
    });
  }

  function saveSelectedStep() {
    return withBusy(async () => {
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
    });
  }

  function deleteSelectedStep() {
    return withBusy(async () => {
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
    });
  }

  function clearSelectedStepResponsible() {
    return withBusy(async () => {
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
    });
  }

  function selectCatalogView(view: CatalogView) {
    setActiveCatalogKey(view.key);
    setInfo(null);

    if (view.mode === "request-types") {
      resetRequestTypeForm();
    }
  }

  function selectRequestTypeForEdit(item: RequestType) {
    setRequestTypeId(item.id);
    setRequestTypeCode(item.code);
    setRequestTypeName(item.name);
    setRequestTypeDescription(item.description);
    setRequestTypeCategory(item.category);
    setRequestTypeColor(item.theme_color);
  }

  function saveRequestTypeForm() {
    return withBusy(async () => {
      if (
        !user?.email ||
        !requestTypeCode.trim() ||
        !requestTypeName.trim() ||
        !requestTypeDescription.trim() ||
        !requestTypeCategory.trim()
      ) {
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
    });
  }

  function deleteSelectedRequestType() {
    return withBusy(async () => {
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
    });
  }

  function selectCatalogItemForEdit(item: CatalogItem) {
    setCatalogItemId(item.id);
    setCatalogLabel(item.item_label);
    setCatalogValue(item.item_value);
    setCatalogSort(String(item.sort_order));
  }

  function saveCatalogItemForm() {
    return withBusy(async () => {
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
      setCatalogSort("10");
      setInfo(catalogItemId ? "Catalogo actualizado." : "Catalogo agregado.");
    });
  }

  function addAdministrator() {
    return withBusy(async () => {
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
    });
  }

  function openRequestDetails(requestId: string) {
    router.push(`/requests/${requestId}` as never);
  }

  function openResponsiva(requestId: string, beneficiary: string) {
    router.push(`/requests/${requestId}/responsiva?beneficiary=${encodeURIComponent(beneficiary)}` as never);
  }

  return {
    ui: {
      isWide,
      loading,
      isAdmin,
      error,
      info,
      section,
      setSection
    },
    overview: {
      routeCount,
      departmentCount: managedDepartments.length,
      requestTypeCount: requestTypes.length,
      adminCount: admins.length,
      approvedLinesCount: lines.length,
      onOpenWorkflows: () => setSection("workflows"),
      onOpenCatalogs: () => setSection("catalogs")
    },
    sections: {
      catalogs: {
      busy,
      catalogViews,
      activeCatalogKey,
      activeCatalogMode: activeCatalogView.mode,
      requestTypes,
      requestTypeId,
      requestTypeCode,
      requestTypeName,
      requestTypeCategory,
      requestTypeDescription,
      requestTypeColor,
      visibleCatalogItems,
      catalogItemId,
      catalogLabel,
      catalogValue,
      catalogSort,
      onSelectCatalogView: selectCatalogView,
      onSelectRequestType: selectRequestTypeForEdit,
      onRequestTypeCodeChange: (value: string) => setRequestTypeCode(value.toUpperCase()),
      onRequestTypeNameChange: setRequestTypeName,
      onRequestTypeCategoryChange: setRequestTypeCategory,
      onRequestTypeDescriptionChange: setRequestTypeDescription,
      onRequestTypeColorChange: setRequestTypeColor,
      onSaveRequestType: saveRequestTypeForm,
      onDeleteRequestType: deleteSelectedRequestType,
      onSelectCatalogItem: selectCatalogItemForEdit,
      onCatalogLabelChange: setCatalogLabel,
      onCatalogValueChange: setCatalogValue,
      onCatalogSortChange: setCatalogSort,
      onSaveCatalogItem: saveCatalogItemForm
    },
      workflows: {
      busy,
      requestTypes,
      workflowTypeId,
      selectedRequestTypeName: selectedRequestType?.name ?? null,
      activeWorkflowSteps,
      availableWorkflowSteps,
      onSelectWorkflowType: setWorkflowTypeId,
      onMoveStepUp: (index: number) => moveWorkflowStep(index, index - 1),
      onMoveStepDown: (index: number) => moveWorkflowStep(index, index + 1),
      onRemoveStep: removeWorkflowStep,
      onAddStep: addWorkflowStep,
      onSave: saveWorkflow
    },
      steps: {
      busy,
      sortedSteps,
      selectedStepId,
      selectedStep,
      createStepCode,
      createStepLabel,
      createStepDescription,
      createStepKind,
      createStepRouting,
      createStepScope,
      createStepSortOrder,
      createStepResponsibleName,
      createStepResponsibleEmail,
      createStepResponsibleTitle,
      stepLabel,
      stepDescription,
      stepActive,
      stepSortOrder,
      stepResponsibleName,
      stepResponsibleEmail,
      stepResponsibleTitle,
      relatedTypesForSelectedStep,
      onCreateStepCodeChange: (value: string) => setCreateStepCode(value.toUpperCase()),
      onCreateStepLabelChange: setCreateStepLabel,
      onCreateStepDescriptionChange: setCreateStepDescription,
      onCreateStepScopeChange: setCreateStepScope,
      onCreateStepSortOrderChange: setCreateStepSortOrder,
      onCreateStepResponsibleNameChange: setCreateStepResponsibleName,
      onCreateStepResponsibleEmailChange: setCreateStepResponsibleEmail,
      onCreateStepResponsibleTitleChange: setCreateStepResponsibleTitle,
      onToggleCreateStepKind: toggleCreateStepKind,
      onToggleCreateStepRouting: toggleCreateStepRouting,
      onCreateStep: createStep,
      onSelectStep: setSelectedStepId,
      onStepLabelChange: setStepLabel,
      onStepDescriptionChange: setStepDescription,
      onStepSortOrderChange: setStepSortOrder,
      onStepResponsibleNameChange: setStepResponsibleName,
      onStepResponsibleEmailChange: setStepResponsibleEmail,
      onStepResponsibleTitleChange: setStepResponsibleTitle,
      onToggleStepActive: () => setStepActive((value) => !value),
      onSaveStep: saveSelectedStep,
      onDeleteStep: deleteSelectedStep,
      onClearResponsible: clearSelectedStepResponsible,
      getStepUsageCount: (stepCode: string) => stepUsageCount(stepCode, requestTypes),
      getRoutingLabel: routingLabel
    },
      admins: {
      busy,
      adminName,
      adminEmail,
      admins,
      onAdminNameChange: setAdminName,
      onAdminEmailChange: setAdminEmail,
      onAddAdmin: addAdministrator
    },
      mobile: {
      lines,
      onOpenResponsiva: openResponsiva,
      onOpenRequest: openRequestDetails
      }
    }
  };
}
