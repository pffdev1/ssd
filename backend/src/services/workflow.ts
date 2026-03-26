import { createHash } from "crypto";
import { PoolClient, QueryResult } from "pg";
import { query, withTransaction } from "../db";
import { notifyRequestCreated, notifyRequestUpdated } from "./notifications";
import {
  AdminUserRecord,
  ApproverRecord,
  CatalogItemRecord,
  PendingApprovalItem,
  RequestDetailRecord,
  RequestEventRecord,
  RequestListItem,
  RequestStepRecord,
  RequestTypeRecord,
  UserRoleRecord,
  WorkflowStepTemplateRecord
} from "../types/domain";

interface CreateRequestInput {
  requestTypeCode: string;
  requesterName: string;
  requesterEmail: string;
  requesterManagerEmail?: string;
  requesterManagerName?: string;
  requesterManagerTitle?: string;
  department: string;
  beneficiaryName?: string;
  subject: string;
  justification: string;
  payload: Record<string, unknown>;
}

interface StepAssignment {
  sequence: number;
  label: string;
  roleCode: string;
  kind: "approval" | "fulfillment";
  approverName: string;
  approverEmail: string;
  department: string | null;
  status: "pending" | "queued";
  metadata: Record<string, unknown>;
}

const restrictedRequestTypes = new Set(["PERSONNEL_REQUEST", "TERMINATION_REQUEST"]);

const mutableFieldCatalogMap: Record<string, Record<string, string>> = {
  IT_ASSET_REQUEST: {
    tipoActivo: "IT_ASSET_TYPE"
  },
  MOBILE_LINE_REQUEST: {
    planSugerido: "MOBILE_PLAN"
  }
};

type WorkflowStepTemplateSeed = Omit<WorkflowStepTemplateRecord, "id" | "created_at">;

const defaultWorkflowStepTemplates: WorkflowStepTemplateSeed[] = [
  {
    code: "AREA_MANAGER",
    label: "Aprobacion de Gerencia de Area",
    description: "Deriva la solicitud al responsable del departamento seleccionado.",
    kind: "approval",
    routing: "department",
    scope: null,
    sort_order: 10,
    active: true
  },
  {
    code: "HR_REVIEW",
    label: "Revision y validacion RRHH",
    description: "Validacion laboral, documental y de politica interna.",
    kind: "approval",
    routing: "scope",
    scope: "HR",
    sort_order: 20,
    active: true
  },
  {
    code: "FINANCE_REVIEW",
    label: "Revision presupuestaria",
    description: "Control financiero y disponibilidad presupuestaria.",
    kind: "approval",
    routing: "scope",
    scope: "FINANCE",
    sort_order: 30,
    active: true
  },
  {
    code: "IT_REVIEW",
    label: "Validacion tecnica TI",
    description: "Revisa viabilidad tecnica, estandar y soporte.",
    kind: "approval",
    routing: "scope",
    scope: "IT",
    sort_order: 40,
    active: true
  },
  {
    code: "GG_APPROVAL",
    label: "Autorizacion de Gerencia General",
    description: "Autorizacion ejecutiva final.",
    kind: "approval",
    routing: "scope",
    scope: "GG",
    sort_order: 50,
    active: true
  },
  {
    code: "IT_OFFBOARDING",
    label: "Ejecucion de offboarding TI",
    description: "Baja de accesos, resguardo de activos y cierre tecnico.",
    kind: "fulfillment",
    routing: "scope",
    scope: "IT",
    sort_order: 60,
    active: true
  },
  {
    code: "PROCUREMENT",
    label: "Gestion de compras locales",
    description: "Ejecucion operativa de compra y coordinacion con proveedor.",
    kind: "fulfillment",
    routing: "scope",
    scope: "PROCUREMENT",
    sort_order: 65,
    active: true
  },
  {
    code: "IT_DELIVERY",
    label: "Ejecucion y entrega TI",
    description: "Configuracion, carta responsiva y entrega final.",
    kind: "fulfillment",
    routing: "scope",
    scope: "IT",
    sort_order: 70,
    active: true
  }
];

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function toUtcDateParts(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  return {
    year,
    month,
    day
  };
}

function calculateInclusiveDays(startDate: string, endDate: string) {
  const start = toUtcDateParts(startDate);
  const end = toUtcDateParts(endDate);

  if (!start || !end) {
    throw new Error("Debes indicar una fecha de inicio y fin validas");
  }

  const startUtc = Date.UTC(start.year, start.month - 1, start.day);
  const endUtc = Date.UTC(end.year, end.month - 1, end.day);

  if (endUtc < startUtc) {
    throw new Error("La fecha de fin no puede ser menor que la fecha de inicio");
  }

  return Math.floor((endUtc - startUtc) / 86_400_000) + 1;
}

function normalizeRequestPayload(requestTypeCode: string, payload: Record<string, unknown>) {
  const normalizedPayload = {
    ...payload
  };

  if (requestTypeCode === "VACATION_REQUEST") {
    const diasTomados = calculateInclusiveDays(String(payload.fechaInicio ?? ""), String(payload.fechaFin ?? ""));
    delete normalizedPayload.planCobertura;
    delete normalizedPayload.diasSolicitados;
    normalizedPayload.diasTomados = diasTomados;
  }

  return normalizedPayload;
}

async function ensureDefaultWorkflowStepTemplates(client?: PoolClient) {
  const sql = `insert into workflow_step_templates (code, label, description, kind, routing, scope, sort_order, active)
    values ($1, $2, $3, $4, $5, $6, $7, $8)
    on conflict (code) do update
      set label = excluded.label,
          description = excluded.description,
          kind = excluded.kind,
          routing = excluded.routing,
          scope = excluded.scope,
          sort_order = excluded.sort_order,
          active = excluded.active`;

  for (const template of defaultWorkflowStepTemplates) {
    const params = [
      template.code,
      template.label,
      template.description,
      template.kind,
      template.routing,
      template.scope,
      template.sort_order,
      template.active
    ];

    if (client) {
      await client.query(sql, params);
      continue;
    }

    await query(sql, params);
  }
}

function normalizeWorkflowStepCode(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeRequestTypeCode(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeAssignmentRole(value: string | null | undefined) {
  return value?.trim().toUpperCase() === "BACKUP" ? "BACKUP" : "PRIMARY";
}

function buildDigitalSignature(input: {
  requestId: string;
  stepId: string;
  actorName: string;
  actorEmail: string;
  decision: "approve" | "reject" | "complete";
}) {
  const signedAt = new Date().toISOString();
  const normalizedEmail = normalizeEmail(input.actorEmail);
  const signatureSeed = `${input.requestId}|${input.stepId}|${normalizedEmail}|${input.decision}|${signedAt}`;
  const digest = createHash("sha256").update(signatureSeed).digest("hex").slice(0, 24).toUpperCase();

  return {
    signatureId: `SSD-SIG-${digest}`,
    signerName: input.actorName,
    signerEmail: normalizedEmail,
    decision: input.decision,
    signedAt,
    provider: "SSD_CORPORATE_SESSION",
    algorithm: "SHA-256",
    digest
  };
}

function canManagePeopleFlows(admin: boolean, profiles: ApproverRecord[], userRoles: UserRoleRecord[]) {
  if (admin) {
    return true;
  }

  if (userRoles.some((role) => ["MANAGER", "HR", "GENERAL_MANAGEMENT"].includes(role.role_code))) {
    return true;
  }

  return profiles.some((profile) => {
    const normalizedTitle = profile.title.toLowerCase();
    return (
      profile.scope === "HR" ||
      profile.department === "Recursos Humanos" ||
      profile.role_code === "AREA_MANAGER" ||
      normalizedTitle.includes("gerente") ||
      normalizedTitle.includes("gerencia") ||
      normalizedTitle.includes("jefe") ||
      normalizedTitle.includes("directora") ||
      normalizedTitle.includes("director")
    );
  });
}

function applyCatalogOptions(requestTypes: RequestTypeRecord[], catalogItems: CatalogItemRecord[]) {
  const grouped = catalogItems.reduce<Record<string, CatalogItemRecord[]>>((accumulator, item) => {
    const key = item.catalog_key;
    if (!accumulator[key]) {
      accumulator[key] = [];
    }
    accumulator[key].push(item);
    return accumulator;
  }, {});

  return requestTypes.map((requestType) => {
    const fieldMap = mutableFieldCatalogMap[requestType.code];

    if (!fieldMap) {
      return requestType;
    }

    return {
      ...requestType,
      fields: requestType.fields.map((field) => {
        const catalogKey = fieldMap[field.name];

        if (!catalogKey) {
          return field;
        }

        const options = (grouped[catalogKey] ?? []).map((item) => ({
          option: item.item_value
        }));

        return {
          ...field,
          options
        };
      })
    };
  });
}

async function getActiveCatalogItems(catalogKey?: string, client?: PoolClient) {
  const sql = `select *
     from catalog_items
     where active = true
     ${catalogKey ? "and catalog_key = $1" : ""}
     order by catalog_key asc, sort_order asc, item_label asc`;

  if (client) {
    const result = catalogKey
      ? await client.query<CatalogItemRecord>(sql, [catalogKey])
      : await client.query<CatalogItemRecord>(sql);
    return result.rows;
  }

  const result = catalogKey ? await query<CatalogItemRecord>(sql, [catalogKey]) : await query<CatalogItemRecord>(sql);
  return result.rows;
}

async function demotePrimaryApproversInGroup(
  client: PoolClient,
  scope: string,
  roleCode: string,
  department: string | null,
  exceptId?: string
) {
  const params: unknown[] = [scope, roleCode, department];
  const exceptClause = exceptId ? "and id <> $4" : "";

  if (exceptId) {
    params.push(exceptId);
  }

  await client.query(
    `update approvers
     set assignment_role = 'BACKUP'
     where scope = $1
       and role_code = $2
       and coalesce(department, '') = coalesce($3, '')
       and assignment_role = 'PRIMARY'
       ${exceptClause}`,
    params
  );
}

async function hasBackupInGroup(
  client: PoolClient,
  scope: string,
  roleCode: string,
  department: string | null,
  exceptId?: string
) {
  const params: unknown[] = [scope, roleCode, department];
  const exceptClause = exceptId ? "and id <> $4" : "";

  if (exceptId) {
    params.push(exceptId);
  }

  const result = await client.query<{ total: string }>(
    `select count(*)::text as total
     from approvers
     where scope = $1
       and role_code = $2
       and coalesce(department, '') = coalesce($3, '')
       and assignment_role = 'BACKUP'
       ${exceptClause}`,
    params
  );

  return Number(result.rows[0]?.total ?? "0") > 0;
}

async function hasPrimaryInGroup(
  client: PoolClient,
  scope: string,
  roleCode: string,
  department: string | null,
  exceptId?: string
) {
  const params: unknown[] = [scope, roleCode, department];
  const exceptClause = exceptId ? "and id <> $4" : "";

  if (exceptId) {
    params.push(exceptId);
  }

  const result = await client.query<{ total: string }>(
    `select count(*)::text as total
     from approvers
     where scope = $1
       and role_code = $2
       and coalesce(department, '') = coalesce($3, '')
       and assignment_role = 'PRIMARY'
       ${exceptClause}`,
    params
  );

  return Number(result.rows[0]?.total ?? "0") > 0;
}

async function assertRequesterCanCreate(requestTypeCode: string, requesterEmail: string) {
  if (!restrictedRequestTypes.has(requestTypeCode)) {
    return;
  }

  const [admin, profiles, userRoles] = await Promise.all([
    isAdminUser(requesterEmail),
    getApproverProfile(requesterEmail),
    getUserRoles(requesterEmail)
  ]);

  if (!canManagePeopleFlows(admin, profiles, userRoles)) {
    throw new Error("No tienes permisos para registrar este tipo de solicitud");
  }
}

function normalizeStatusFromStep(step: StepAssignment): string {
  if (step.kind === "fulfillment") {
    return "in_fulfillment";
  }

  switch (step.roleCode) {
    case "AREA_MANAGER":
      return "pending_area_approval";
    case "GG_APPROVAL":
      return "pending_general_management";
    case "HR_REVIEW":
      return "pending_hr";
    case "FINANCE_REVIEW":
      return "pending_finance";
    case "IT_REVIEW":
      return "pending_it";
    default:
      return "pending_review";
  }
}

async function getRequestTypeByCode(code: string, client?: PoolClient): Promise<RequestTypeRecord> {
  let result: QueryResult<RequestTypeRecord>;

  if (client) {
    result = await client.query<RequestTypeRecord>(
      `select *
       from request_types
       where code = $1 and active = true`,
      [code]
    );
  } else {
    result = await query<RequestTypeRecord>(
      `select *
       from request_types
       where code = $1 and active = true`,
      [code]
    );
  }

  if (result.rowCount === 0) {
    throw new Error(`Request type not found: ${code}`);
  }

  const catalogItems = await getActiveCatalogItems(undefined, client);
  return applyCatalogOptions([result.rows[0]], catalogItems)[0];
}

async function getApproverByDepartment(department: string, roleCode: string, client: PoolClient): Promise<ApproverRecord> {
  const result = await client.query<ApproverRecord>(
    `select *
     from approvers
     where role_code = $2
       and department = $1
     order by case when assignment_role = 'PRIMARY' then 0 else 1 end asc, sort_order asc, created_at asc
     limit 1`,
    [department, roleCode]
  );

  if (result.rowCount === 0) {
    throw new Error(`No hay aprobador configurado para el paso ${roleCode} en el departamento ${department}`);
  }

  return result.rows[0];
}

async function getScopedApprover(scope: string, roleCode: string, client: PoolClient): Promise<ApproverRecord> {
  const result = await client.query<ApproverRecord>(
    `select *
     from approvers
     where scope = $1
       and role_code = $2
     order by case when assignment_role = 'PRIMARY' then 0 else 1 end asc, sort_order asc, created_at asc
     limit 1`,
    [scope, roleCode]
  );

  if (result.rowCount === 0) {
    throw new Error(`No approver configured for scope=${scope} role=${roleCode}`);
  }

  return result.rows[0];
}

async function getGlobalStepApprover(roleCode: string, client: PoolClient): Promise<ApproverRecord | null> {
  const result = await client.query<ApproverRecord>(
    `select *
     from approvers
     where scope = 'AREA'
       and role_code = $1
       and department is null
     order by case when assignment_role = 'PRIMARY' then 0 else 1 end asc, sort_order asc, created_at asc
     limit 1`,
    [roleCode]
  );

  return result.rows[0] ?? null;
}

function buildDefaultManagerStepAssignment(input: {
  requesterEmail: string;
  requesterManagerEmail?: string;
  requesterManagerName?: string;
  requesterManagerTitle?: string;
  department: string;
}): StepAssignment | null {
  const normalizedRequesterEmail = normalizeEmail(input.requesterEmail);
  const normalizedManagerEmail = input.requesterManagerEmail ? normalizeEmail(input.requesterManagerEmail) : null;

  if (!normalizedManagerEmail || normalizedManagerEmail === normalizedRequesterEmail) {
    return null;
  }

  return {
    sequence: 1,
    label: "Aprobacion de Jefatura Inmediata",
    roleCode: "IMMEDIATE_LEAD",
    kind: "approval",
    approverName: input.requesterManagerName?.trim() || normalizedManagerEmail,
    approverEmail: normalizedManagerEmail,
    department: input.department,
    status: "pending",
    metadata: {
      scope: "REQUESTER_MANAGER",
      title: input.requesterManagerTitle?.trim() || "Jefatura inmediata",
      source: "microsoft_entra_manager"
    }
  };
}

async function buildStepAssignments(
  requestType: RequestTypeRecord,
  department: string,
  requesterEmail: string,
  requesterManagerEmail: string | undefined,
  requesterManagerName: string | undefined,
  requesterManagerTitle: string | undefined,
  client: PoolClient
): Promise<StepAssignment[]> {
  const assignments: StepAssignment[] = [];

  const managerStep = buildDefaultManagerStepAssignment({
    requesterEmail,
    requesterManagerEmail,
    requesterManagerName,
    requesterManagerTitle,
    department
  });

  if (managerStep) {
    assignments.push(managerStep);
  }

  for (let index = 0; index < requestType.workflow.steps.length; index += 1) {
    const template = requestType.workflow.steps[index];

    if (template.code === "IMMEDIATE_LEAD") {
      continue;
    }

    let approver: ApproverRecord | null;

    if (template.routing === "department") {
      try {
        approver = await getApproverByDepartment(department, template.code, client);
      } catch {
        approver = await getGlobalStepApprover(template.code, client);
      }
    } else {
      approver = await getScopedApprover(template.scope ?? template.code, template.code, client);
    }

    if (!approver) {
      continue;
    }

    if (normalizeEmail(approver.email) === normalizeEmail(requesterEmail)) {
      continue;
    }

    const previousAssignment = assignments.at(-1);

    if (previousAssignment && normalizeEmail(previousAssignment.approverEmail) === normalizeEmail(approver.email)) {
      continue;
    }

    assignments.push({
      sequence: assignments.length + 1,
      label: template.label,
      roleCode: template.code,
      kind: template.kind,
      approverName: approver.full_name,
      approverEmail: approver.email,
      department: approver.department,
      status: assignments.length === 0 ? "pending" : "queued",
      metadata: {
        scope: approver.scope,
        title: approver.title
      }
    });
  }

  if (assignments.length === 0) {
    throw new Error(
      "No se pudo resolver ningun aprobador para este workflow. Verifica que el usuario tenga manager en Entra o define pasos extra con responsables."
    );
  }

  return assignments;
}

async function createTicketCode(client: PoolClient): Promise<string> {
  const result = await client.query<{ next_value: string }>(
    `select lpad((count(*) + 1)::text, 5, '0') as next_value
     from requests`
  );

  const year = new Date().getFullYear();
  return `SSD-${year}-${result.rows[0].next_value}`;
}

export async function createRequest(input: CreateRequestInput) {
  if (!input.department.trim()) {
    throw new Error("Debes seleccionar un departamento");
  }

  await assertRequesterCanCreate(input.requestTypeCode, input.requesterEmail);

  const created = await withTransaction(async (client) => {
    const normalizedDepartment = input.department.trim();
    const requestType = await getRequestTypeByCode(input.requestTypeCode, client);
    const normalizedPayload = normalizeRequestPayload(input.requestTypeCode, input.payload);
    const ticketCode = await createTicketCode(client);
    const steps = await buildStepAssignments(
      requestType,
      normalizedDepartment,
      input.requesterEmail,
      input.requesterManagerEmail,
      input.requesterManagerName,
      input.requesterManagerTitle,
      client
    );
    const initialStatus = normalizeStatusFromStep(steps[0]);

    const requestResult = await client.query<{ id: string; ticket_code: string }>(
      `insert into requests (
        request_type_id,
        ticket_code,
        status,
        requester_name,
        requester_email,
        department,
        beneficiary_name,
        subject,
        justification,
        payload
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
      returning id, ticket_code`,
      [
        requestType.id,
        ticketCode,
        initialStatus,
        input.requesterName,
        input.requesterEmail,
        normalizedDepartment,
        input.beneficiaryName ?? null,
        input.subject,
        input.justification,
        JSON.stringify(normalizedPayload)
      ]
    );

    const request = requestResult.rows[0];

    for (const step of steps) {
      await client.query(
        `insert into request_steps (
          request_id,
          sequence,
          role_code,
          label,
          kind,
          approver_name,
          approver_email,
          department,
          status,
          metadata
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)`,
        [
          request.id,
          step.sequence,
          step.roleCode,
          step.label,
          step.kind,
          step.approverName,
          step.approverEmail,
          step.department,
          step.status,
          JSON.stringify(step.metadata)
        ]
      );
    }

    await client.query(
      `insert into request_events (
        request_id,
        event_type,
        actor_name,
        actor_email,
        notes,
        payload
      ) values ($1, 'REQUEST_CREATED', $2, $3, $4, $5::jsonb)`,
      [
        request.id,
        input.requesterName,
        input.requesterEmail,
        `Solicitud registrada para ${requestType.name}`,
        JSON.stringify({
          ticketCode,
          requestType: requestType.code
        })
      ]
    );

    return {
      id: request.id,
      ticketCode: request.ticket_code
    };
  });

  const requestDetail = await getRequestById(created.id);

  if (requestDetail) {
    await notifyRequestCreated(requestDetail);
  }

  return created;
}

export async function listRequestTypes() {
  const result = await query<RequestTypeRecord>(
    `select *
     from request_types
     where active = true
     order by name asc`
  );

  const catalogItems = await getActiveCatalogItems();
  return applyCatalogOptions(result.rows, catalogItems);
}

export async function listWorkflowStepTemplates() {
  return getWorkflowStepTemplates(undefined, true);
}

export async function createWorkflowStepTemplate(input: {
  code: string;
  label: string;
  description: string;
  kind: "approval" | "fulfillment";
  routing: "department" | "scope";
  scope?: string | null;
  sortOrder?: number;
  responsibleName?: string;
  responsibleEmail?: string;
  responsibleTitle?: string;
}) {
  const normalizedCode = normalizeWorkflowStepCode(input.code);
  const allowedKinds = new Set(["approval", "fulfillment"]);
  const allowedRoutings = new Set(["department", "scope"]);

  if (!normalizedCode) {
    throw new Error("El codigo del paso es requerido");
  }

  if (!allowedKinds.has(input.kind)) {
    throw new Error("Tipo de paso invalido");
  }

  if (!allowedRoutings.has(input.routing)) {
    throw new Error("Ruteo del paso invalido");
  }

  const normalizedRouting = input.routing;
  const normalizedKind = input.kind;
  const normalizedScope =
    normalizedRouting === "scope" ? (input.scope?.trim().toUpperCase() ? input.scope.trim().toUpperCase() : null) : null;
  const hasResponsibleFields = [
    input.responsibleName?.trim(),
    input.responsibleEmail?.trim(),
    input.responsibleTitle?.trim()
  ].filter(Boolean).length;

  if (normalizedRouting === "scope" && !normalizedScope) {
    throw new Error("Debes indicar un scope para los pasos por alcance");
  }

  if (hasResponsibleFields > 0 && hasResponsibleFields < 3) {
    throw new Error("Para asignar responsable del paso debes completar nombre, correo y cargo.");
  }

  return withTransaction(async (client) => {
    const result = await client.query<WorkflowStepTemplateRecord>(
      `insert into workflow_step_templates (code, label, description, kind, routing, scope, sort_order, active)
       values ($1, $2, $3, $4, $5, $6, $7, true)
       returning *`,
      [
        normalizedCode,
        input.label.trim(),
        input.description.trim(),
        normalizedKind,
        normalizedRouting,
        normalizedScope,
        input.sortOrder ?? 999
      ]
    );

    const created = result.rows[0];
    const hasResponsible =
      Boolean(input.responsibleName?.trim()) && Boolean(input.responsibleEmail?.trim()) && Boolean(input.responsibleTitle?.trim());

    if (hasResponsible) {
      await upsertWorkflowStepResponsible(client, created, {
        fullName: input.responsibleName!.trim(),
        email: input.responsibleEmail!.trim(),
        title: input.responsibleTitle!.trim()
      });
    }

    const refreshed = await getWorkflowStepTemplates(client, true);
    return refreshed.find((step) => step.id === created.id) ?? created;
  });
}

async function buildWorkflowDefinition(stepCodes: string[], client?: PoolClient) {
  const normalizedCodes = stepCodes
    .map((code) => code.trim().toUpperCase())
    .filter((code) => Boolean(code) && code !== "IMMEDIATE_LEAD");

  if (normalizedCodes.length === 0) {
    throw new Error("Debes mantener al menos un paso en el workflow");
  }

  if (new Set(normalizedCodes).size !== normalizedCodes.length) {
    throw new Error("No se permiten pasos duplicados en el workflow");
  }

  const templateMap = new Map(
    (await getWorkflowStepTemplates(client, true)).map((template) => [
      template.code,
      {
        code: template.code,
        label: template.label,
        kind: template.kind,
        routing: template.routing,
        scope: template.scope ?? undefined
      }
    ])
  );

  const steps = normalizedCodes.map((code) => {
    const template = templateMap.get(code);

    if (!template) {
      throw new Error(`Paso no permitido en el workflow: ${code}`);
    }

    return {
      ...template
    };
  });

  if (steps.length === 0) {
    throw new Error("Debes mantener al menos un paso adicional al de jefatura inmediata");
  }

  return {
    steps,
    requiresGeneralManagement: normalizedCodes.includes("GG_APPROVAL")
  };
}

export async function createRequestType(input: {
  code: string;
  name: string;
  description: string;
  category: string;
  themeColor: string;
}) {
  const normalizedCode = normalizeRequestTypeCode(input.code);

  if (!normalizedCode) {
    throw new Error("El codigo de la solicitud es requerido");
  }

  if (!input.name.trim() || !input.description.trim() || !input.category.trim() || !input.themeColor.trim()) {
    throw new Error("Nombre, descripcion, categoria y color son requeridos");
  }

  const activeTemplates = await getWorkflowStepTemplates(undefined, false);
  const defaultStepCodes = ["AREA_MANAGER"].filter((code) =>
    activeTemplates.some((template) => template.code === code)
  );
  const effectiveDefaultStepCodes = defaultStepCodes.length > 0 ? defaultStepCodes : activeTemplates.slice(0, 1).map((template) => template.code);

  if (effectiveDefaultStepCodes.length === 0) {
    throw new Error("Debes tener al menos un paso activo para crear un tipo de solicitud");
  }

  const workflow = await buildWorkflowDefinition(effectiveDefaultStepCodes);

  const result = await query<RequestTypeRecord>(
    `insert into request_types (code, name, description, category, theme_color, fields, workflow, requires_general_management, active)
     values ($1, $2, $3, $4, $5, '[]'::jsonb, $6::jsonb, $7, true)
     returning *`,
    [
      normalizedCode,
      input.name.trim(),
      input.description.trim(),
      input.category.trim(),
      input.themeColor.trim(),
      JSON.stringify({
        steps: workflow.steps
      }),
      workflow.requiresGeneralManagement
    ]
  );

  return result.rows[0];
}

export async function updateRequestType(input: {
  id: string;
  name: string;
  description: string;
  category: string;
  themeColor: string;
}) {
  const result = await query<RequestTypeRecord>(
    `update request_types
     set name = $2,
         description = $3,
         category = $4,
         theme_color = $5
     where id = $1
     returning *`,
    [input.id, input.name.trim(), input.description.trim(), input.category.trim(), input.themeColor.trim()]
  );

  if (result.rowCount === 0) {
    throw new Error("Tipo de solicitud no encontrado");
  }

  return result.rows[0];
}

export async function removeRequestType(id: string) {
  const usageResult = await query<{ total: string }>(
    `select count(*)::text as total
     from requests
     where request_type_id = $1`,
    [id]
  );

  if (Number(usageResult.rows[0]?.total ?? "0") > 0) {
    throw new Error("No puedes eliminar este tipo de solicitud porque ya tiene solicitudes registradas");
  }

  const result = await query<RequestTypeRecord>(
    `delete from request_types
     where id = $1
     returning *`,
    [id]
  );

  if (result.rowCount === 0) {
    throw new Error("Tipo de solicitud no encontrado");
  }

  return result.rows[0];
}

export async function updateRequestTypeWorkflow(input: { id: string; stepCodes: string[] }) {
  const workflow = await buildWorkflowDefinition(input.stepCodes);

  const result = await query<RequestTypeRecord>(
    `update request_types
     set workflow = $2::jsonb,
         requires_general_management = $3
     where id = $1
     returning *`,
    [
      input.id,
      JSON.stringify({
        steps: workflow.steps
      }),
      workflow.requiresGeneralManagement
    ]
  );

  if (result.rowCount === 0) {
    throw new Error("Tipo de solicitud no encontrado");
  }

  return result.rows[0];
}

export async function listApprovers() {
  const result = await query<ApproverRecord>(
    `select *
     from (
       select
         approvers.*,
         row_number() over (
           partition by coalesce(department, ''), scope, role_code
           order by case when assignment_role = 'PRIMARY' then 0 else 1 end asc, sort_order asc, full_name asc
         ) as rank_in_group
       from approvers
     ) grouped
     where rank_in_group <= 2
     order by coalesce(department, scope), role_code asc, case when assignment_role = 'PRIMARY' then 0 else 1 end asc, sort_order asc, full_name asc`
  );

  return result.rows;
}

async function getWorkflowStepTemplates(client?: PoolClient, includeInactive = true) {
  const sql = `select
      wst.*,
      apr.full_name as responsible_name,
      apr.email as responsible_email,
      apr.title as responsible_title
     from workflow_step_templates wst
     left join lateral (
       select full_name, email, title
       from approvers
       where role_code = wst.code
         and department is null
         and scope = case
           when wst.routing = 'scope' then coalesce(wst.scope, wst.code)
           else 'AREA'
         end
       order by case when assignment_role = 'PRIMARY' then 0 else 1 end asc, sort_order asc, created_at asc
       limit 1
     ) apr on true
     ${includeInactive ? "" : "where wst.active = true"}
     order by wst.sort_order asc, wst.label asc`;

  if (client) {
    const result = await client.query<WorkflowStepTemplateRecord>(sql);
    return result.rows;
  }

  const result = await query<WorkflowStepTemplateRecord>(sql);
  return result.rows;
}

async function listVisibleRequests(input: { actorEmail?: string; requesterEmail?: string }) {
  const params: string[] = [];
  const filters: string[] = [];

  if (input.actorEmail) {
    const actorIsAdmin = await isAdminUser(input.actorEmail);

    if (!actorIsAdmin) {
      params.push(normalizeEmail(input.actorEmail));
      filters.push(
        `(lower(r.requester_email) = lower($${params.length}) or exists (
          select 1
          from request_steps visibility_steps
          where visibility_steps.request_id = r.id
            and lower(visibility_steps.approver_email) = lower($${params.length})
        ))`
      );
    }
  }

  if (input.requesterEmail) {
    params.push(normalizeEmail(input.requesterEmail));
    filters.push(`lower(r.requester_email) = lower($${params.length})`);
  }

  const whereClause = filters.length > 0 ? `where ${filters.join(" and ")}` : "";
  const result = await query<RequestListItem>(
    `select
      r.id,
      r.ticket_code,
      r.status,
      r.requester_name,
      r.requester_email,
      r.department,
      r.beneficiary_name,
      r.subject,
      r.justification,
      r.payload,
      r.created_at,
      r.updated_at,
      rt.code as request_type_code,
      rt.name as request_type_name,
      rt.category
    from requests r
    inner join request_types rt on rt.id = r.request_type_id
    ${whereClause}
    order by r.created_at desc`,
    params
  );

  return result.rows;
}

export async function listRequests(requesterEmail?: string, actorEmail?: string) {
  return listVisibleRequests({ requesterEmail, actorEmail });
}

export async function getRequestById(id: string, actorEmail?: string) {
  const params: string[] = [id];
  let visibilityClause = "where r.id = $1";

  if (actorEmail) {
    const actorIsAdmin = await isAdminUser(actorEmail);

    if (!actorIsAdmin) {
      params.push(normalizeEmail(actorEmail));
      visibilityClause += ` and (
        lower(r.requester_email) = lower($2) or exists (
          select 1
          from request_steps visibility_steps
          where visibility_steps.request_id = r.id
            and lower(visibility_steps.approver_email) = lower($2)
        )
      )`;
    }
  }

  const requestResult = await query<RequestListItem>(
    `select
      r.id,
      r.ticket_code,
      r.status,
      r.requester_name,
      r.requester_email,
      r.department,
      r.beneficiary_name,
      r.subject,
      r.justification,
      r.payload,
      r.created_at,
      r.updated_at,
      rt.code as request_type_code,
      rt.name as request_type_name,
      rt.category
    from requests r
    inner join request_types rt on rt.id = r.request_type_id
    ${visibilityClause}`,
    params
  );

  if (requestResult.rowCount === 0) {
    return null;
  }

  const stepsResult = await query<RequestStepRecord>(
    `select *
     from request_steps
     where request_id = $1
     order by sequence asc`,
    [id]
  );

  const eventsResult = await query<RequestEventRecord>(
    `select *
     from request_events
     where request_id = $1
     order by created_at asc`,
    [id]
  );

  const detail: RequestDetailRecord = {
    ...requestResult.rows[0],
    steps: stepsResult.rows,
    events: eventsResult.rows
  };

  return detail;
}

function nextRequestStatusFromStep(step: RequestStepRecord | StepAssignment | undefined): string {
  if (!step) {
    return "completed";
  }

  if (step.kind === "fulfillment") {
    return "in_fulfillment";
  }

  const roleCode = "role_code" in step ? step.role_code : step.roleCode;

  switch (roleCode) {
    case "AREA_MANAGER":
      return "pending_area_approval";
    case "GG_APPROVAL":
      return "pending_general_management";
    case "HR_REVIEW":
      return "pending_hr";
    case "FINANCE_REVIEW":
      return "pending_finance";
    case "IT_REVIEW":
      return "pending_it";
    default:
      return "pending_review";
  }
}

export async function actOnStep(
  requestId: string,
  stepId: string,
  input: {
    decision: "approve" | "reject" | "complete";
    comments?: string;
    actorName: string;
    actorEmail: string;
  }
) {
  const updatedRequest = await withTransaction(async (client) => {
    const stepResult = await client.query<RequestStepRecord>(
      `select *
       from request_steps
       where id = $1 and request_id = $2
       limit 1`,
      [stepId, requestId]
    );

    if (stepResult.rowCount === 0) {
      throw new Error("Step not found for request");
    }

    const currentStep = stepResult.rows[0];

    if (currentStep.status !== "pending") {
      throw new Error("Only the pending step can receive a decision");
    }

    if (currentStep.approver_email.toLowerCase() !== input.actorEmail.toLowerCase()) {
      throw new Error("This step can only be processed by the assigned approver");
    }

    if (currentStep.kind === "approval" && input.decision === "complete") {
      throw new Error("Approval steps only accept approve or reject");
    }

    if (currentStep.kind === "fulfillment" && input.decision === "approve") {
      throw new Error("Fulfillment steps should be completed or rejected");
    }

    const mappedStatus = input.decision === "reject" ? "rejected" : input.decision === "complete" ? "completed" : "approved";
    const digitalSignature = buildDigitalSignature({
      requestId,
      stepId,
      actorName: input.actorName,
      actorEmail: input.actorEmail,
      decision: input.decision
    });
    const nextMetadata = {
      ...(currentStep.metadata ?? {}),
      digitalSignature
    };

    await client.query(
      `update request_steps
       set status = $1,
           decision = $2,
           comments = $3,
           acted_at = now(),
           metadata = $4::jsonb
       where id = $5`,
      [mappedStatus, input.decision, input.comments ?? null, JSON.stringify(nextMetadata), stepId]
    );

    if (input.decision === "reject") {
      await client.query(
        `update requests
         set status = 'rejected',
             updated_at = now()
         where id = $1`,
        [requestId]
      );

      await client.query(
        `insert into request_events (
          request_id,
          event_type,
          actor_name,
          actor_email,
          notes,
          payload
        ) values ($1, 'STEP_REJECTED', $2, $3, $4, $5::jsonb)`,
        [
          requestId,
          input.actorName,
          input.actorEmail,
          `${currentStep.label} rechazado`,
          JSON.stringify({
            stepId,
            comments: input.comments ?? null,
            digitalSignature
          })
        ]
      );

      return getRequestById(requestId);
    }

    const nextStepResult = await client.query<RequestStepRecord>(
      `select *
       from request_steps
       where request_id = $1
         and sequence > $2
       order by sequence asc
       limit 1`,
      [requestId, currentStep.sequence]
    );

    if (nextStepResult.rowCount === 0) {
      await client.query(
        `update requests
         set status = $2,
             updated_at = now()
         where id = $1`,
        [requestId, input.decision === "complete" ? "completed" : "approved"]
      );
    } else {
      const nextStep = nextStepResult.rows[0];

      await client.query(
        `update request_steps
         set status = 'pending'
         where id = $1`,
        [nextStep.id]
      );

      await client.query(
        `update requests
         set status = $2,
             updated_at = now()
         where id = $1`,
        [requestId, nextRequestStatusFromStep(nextStep)]
      );
    }

    await client.query(
      `insert into request_events (
        request_id,
        event_type,
        actor_name,
        actor_email,
        notes,
        payload
      ) values ($1, 'STEP_UPDATED', $2, $3, $4, $5::jsonb)`,
      [
        requestId,
        input.actorName,
        input.actorEmail,
        `${currentStep.label} marcado como ${mappedStatus}`,
        JSON.stringify({
          stepId,
          decision: input.decision,
          comments: input.comments ?? null,
          digitalSignature
        })
      ]
    );

    return getRequestById(requestId);
  });

  if (updatedRequest) {
    await notifyRequestUpdated(updatedRequest);
  }

  return updatedRequest;
}

export async function getDashboardData(actorEmail?: string) {
  const visibleRequests = await listVisibleRequests({ actorEmail });
  const visibleIds = visibleRequests.map((request) => request.id);

  if (visibleIds.length === 0) {
    return {
      metrics: [],
      byType: [],
      pendingByApprover: [],
      recentRequests: []
    };
  }

  const statsResult = await query<{ status: string; total: string }>(
    `select status, count(*)::text as total
     from requests
     where id = any($1::uuid[])
     group by status`,
    [visibleIds]
  );

  const typeResult = await query<{ name: string; total: string }>(
    `select rt.name, count(*)::text as total
     from requests r
     inner join request_types rt on rt.id = r.request_type_id
     where r.id = any($1::uuid[])
     group by rt.name
     order by count(*) desc, rt.name asc`,
    [visibleIds]
  );

  const pendingSteps = await query<{ approver_name: string; pending: string }>(
    `select approver_name, count(*)::text as pending
     from request_steps
     where status = 'pending'
       and request_id = any($1::uuid[])
     group by approver_name
     order by pending desc, approver_name asc`,
    [visibleIds]
  );

  return {
    metrics: statsResult.rows,
    byType: typeResult.rows,
    pendingByApprover: pendingSteps.rows,
    recentRequests: visibleRequests.slice(0, 6)
  };
}

export async function getDepartments() {
  const catalogDepartments = await getActiveCatalogItems("DEPARTMENT");
  const result = await query<{ department: string }>(
    `select distinct department
     from approvers
     where department is not null
     order by department asc`
  );
  const catalogValues = catalogDepartments.map((item) => item.item_value.trim()).filter(Boolean);
  const approverValues = result.rows.map((row: { department: string }) => row.department.trim()).filter(Boolean);
  const merged = Array.from(new Set([...catalogValues, ...approverValues]));
  merged.sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
  return merged;
}

export async function listPendingApprovals(approverEmail: string) {
  const result = await query<PendingApprovalItem>(
    `select
      r.id,
      r.ticket_code,
      r.status,
      r.requester_name,
      r.requester_email,
      r.department,
      r.beneficiary_name,
      r.subject,
      r.justification,
      r.payload,
      r.created_at,
      r.updated_at,
      rt.code as request_type_code,
      rt.name as request_type_name,
      rt.category,
      rs.id as step_id,
      rs.label as step_label,
      rs.kind as step_kind,
      rs.sequence as step_sequence,
      rs.approver_name,
      rs.approver_email,
      rs.status as step_status,
      rs.created_at as step_created_at
    from request_steps rs
    inner join requests r on r.id = rs.request_id
    inner join request_types rt on rt.id = r.request_type_id
    where rs.status = 'pending'
      and lower(rs.approver_email) = lower($1)
    order by r.created_at asc`,
    [approverEmail]
  );

  return result.rows;
}

export async function listApprovedMobileLineRequests() {
  const result = await query<RequestListItem>(
    `select
      r.id,
      r.ticket_code,
      r.status,
      r.requester_name,
      r.requester_email,
      r.department,
      r.beneficiary_name,
      r.subject,
      r.justification,
      r.payload,
      r.created_at,
      r.updated_at,
      rt.code as request_type_code,
      rt.name as request_type_name,
      rt.category
    from requests r
    inner join request_types rt on rt.id = r.request_type_id
    where rt.code = 'MOBILE_LINE_REQUEST'
      and exists (
        select 1
        from request_steps gg
        where gg.request_id = r.id
          and gg.role_code = 'GG_APPROVAL'
          and gg.status = 'approved'
      )
    order by r.updated_at desc, r.created_at desc`
  );

  return result.rows;
}

export async function getApproverProfile(email: string) {
  const result = await query<ApproverRecord>(
    `select *
     from approvers
     where lower(email) = lower($1)
     order by case when assignment_role = 'PRIMARY' then 0 else 1 end asc, sort_order asc, full_name asc`,
    [email]
  );

  return result.rows;
}

export async function listAdminUsers() {
  const result = await query<AdminUserRecord>(
    `select *
     from admin_users
     order by full_name asc, email asc`
  );

  return result.rows;
}

export async function listUserRoles() {
  const result = await query<UserRoleRecord>(
    `select *
     from user_roles
     order by full_name asc, email asc, role_code asc`
  );

  return result.rows;
}

export async function listCatalogItems() {
  return getActiveCatalogItems();
}

async function upsertWorkflowStepResponsible(
  client: PoolClient,
  step: Pick<WorkflowStepTemplateRecord, "code" | "routing" | "scope">,
  input: {
    fullName: string;
    email: string;
    title: string;
  }
) {
  const normalizedScope = step.routing === "scope" ? (step.scope ?? step.code) : "AREA";
  const normalizedRoleCode = step.code.trim().toUpperCase();
  const normalizedEmail = normalizeEmail(input.email);

  await client.query(
    `delete from approvers
     where scope = $1
       and role_code = $2
       and department is null`,
    [normalizedScope, normalizedRoleCode]
  );

  await client.query(
    `insert into approvers (department, scope, role_code, full_name, email, title, assignment_role, sort_order)
     values (null, $1, $2, $3, $4, $5, 'PRIMARY', 10)
     on conflict ((coalesce(department, '')), scope, role_code, lower(email)) do update
       set full_name = excluded.full_name,
           title = excluded.title,
           assignment_role = 'PRIMARY',
           sort_order = 10`,
    [normalizedScope, normalizedRoleCode, input.fullName.trim(), normalizedEmail, input.title.trim()]
  );
}

async function clearWorkflowStepResponsible(
  client: PoolClient,
  step: Pick<WorkflowStepTemplateRecord, "code" | "routing" | "scope">
) {
  const normalizedScope = step.routing === "scope" ? (step.scope ?? step.code) : "AREA";
  await client.query(
    `delete from approvers
     where scope = $1
       and role_code = $2
       and department is null`,
    [normalizedScope, step.code]
  );
}

export async function updateWorkflowStepTemplate(input: {
  id: string;
  label: string;
  description: string;
  active: boolean;
  sortOrder: number;
  responsibleName?: string;
  responsibleEmail?: string;
  responsibleTitle?: string;
  clearResponsible?: boolean;
}) {
  return withTransaction(async (client) => {
    const result = await client.query<WorkflowStepTemplateRecord>(
      `update workflow_step_templates
       set label = $2,
           description = $3,
           active = $4,
           sort_order = $5
       where id = $1
       returning *`,
      [input.id, input.label.trim(), input.description.trim(), input.active, input.sortOrder]
    );

    if (result.rowCount === 0) {
      throw new Error("Paso no encontrado");
    }

    const step = result.rows[0];

    const requestTypesResult = await client.query<{ id: string; workflow: RequestTypeRecord["workflow"] }>(
      `select id, workflow
       from request_types
       where exists (
         select 1
         from jsonb_array_elements(workflow -> 'steps') step_json
         where step_json ->> 'code' = $1
       )`,
      [step.code]
    );

    for (const requestType of requestTypesResult.rows) {
      const currentSteps = Array.isArray(requestType.workflow?.steps) ? requestType.workflow.steps : [];
      const nextSteps = currentSteps.map((workflowStep) =>
        workflowStep.code === step.code
          ? {
              ...workflowStep,
              label: input.label.trim()
            }
          : workflowStep
      );

      await client.query(
        `update request_types
         set workflow = $2::jsonb
         where id = $1`,
        [
          requestType.id,
          JSON.stringify({
            steps: nextSteps
          })
        ]
      );
    }
    const hasResponsibleFields = [
      input.responsibleName?.trim(),
      input.responsibleEmail?.trim(),
      input.responsibleTitle?.trim()
    ].filter(Boolean).length;
    const hasResponsible =
      Boolean(input.responsibleName?.trim()) && Boolean(input.responsibleEmail?.trim()) && Boolean(input.responsibleTitle?.trim());

    if (!input.clearResponsible && hasResponsibleFields > 0 && hasResponsibleFields < 3) {
      throw new Error("Para asignar responsable del paso debes completar nombre, correo y cargo.");
    }

    if (input.clearResponsible) {
      await clearWorkflowStepResponsible(client, step);
    } else if (hasResponsible) {
      await upsertWorkflowStepResponsible(client, step, {
        fullName: input.responsibleName!.trim(),
        email: input.responsibleEmail!.trim(),
        title: input.responsibleTitle!.trim()
      });
    }

    const refreshed = await getWorkflowStepTemplates(client, true);
    return refreshed.find((current) => current.id === step.id) ?? step;
  });
}

export async function removeWorkflowStepTemplate(id: string) {
  await withTransaction(async (client) => {
    const currentResult = await client.query<WorkflowStepTemplateRecord>(
      `select *
       from workflow_step_templates
       where id = $1
       limit 1`,
      [id]
    );

    if (currentResult.rowCount === 0) {
      throw new Error("Paso no encontrado");
    }

    const current = currentResult.rows[0];

    const requestTypesResult = await client.query<{ id: string; code: string; workflow: RequestTypeRecord["workflow"] }>(
      `select id, code, workflow
       from request_types
       where exists (
         select 1
         from jsonb_array_elements(workflow -> 'steps') step
         where step ->> 'code' = $1
       )`,
      [current.code]
    );

    for (const requestType of requestTypesResult.rows) {
      const existingSteps = Array.isArray(requestType.workflow?.steps) ? requestType.workflow.steps : [];
      const filteredSteps = existingSteps.filter((step) => step.code !== current.code);

      if (filteredSteps.length === 0) {
        throw new Error(
          `No se puede eliminar ${current.code} porque el workflow ${requestType.code} quedaria sin pasos. Agrega otro paso antes de eliminarlo.`
        );
      }

      const requiresGeneralManagement = filteredSteps.some((step) => step.code === "GG_APPROVAL");

      await client.query(
        `update request_types
         set workflow = $2::jsonb,
             requires_general_management = $3
         where id = $1`,
        [
          requestType.id,
          JSON.stringify({
            steps: filteredSteps
          }),
          requiresGeneralManagement
        ]
      );
    }

    await client.query(`delete from approvers where role_code = $1`, [current.code]);
    await client.query(`delete from workflow_step_templates where id = $1`, [id]);
  });
}

export async function addApprover(input: {
  department: string | null;
  scope: string;
  roleCode: string;
  fullName: string;
  email: string;
  title: string;
  assignmentRole?: string;
}) {
  const normalizedDepartment = input.department?.trim() ? input.department.trim() : null;
  const normalizedScope = input.scope.trim().toUpperCase();
  const normalizedRoleCode = input.roleCode.trim().toUpperCase();
  const normalizedEmail = normalizeEmail(input.email);
  const assignmentRole = normalizeAssignmentRole(input.assignmentRole);

  return withTransaction(async (client) => {
    const currentMax = await client.query<{ max_sort: string | null }>(
      `select coalesce(max(sort_order), 0)::text as max_sort
       from approvers
       where scope = $1
         and role_code = $2
         and coalesce(department, '') = coalesce($3, '')`,
      [normalizedScope, normalizedRoleCode, normalizedDepartment]
    );

      if (assignmentRole === "PRIMARY") {
        const hasExistingPrimary = await hasPrimaryInGroup(client, normalizedScope, normalizedRoleCode, normalizedDepartment);
        const hasExistingBackup = await hasBackupInGroup(client, normalizedScope, normalizedRoleCode, normalizedDepartment);

        if (hasExistingPrimary && hasExistingBackup) {
          throw new Error("Esta ruta ya tiene principal y respaldo. Edita uno existente en lugar de agregar un tercero.");
        }

        await demotePrimaryApproversInGroup(client, normalizedScope, normalizedRoleCode, normalizedDepartment);
      } else {
        const hasExistingBackup = await hasBackupInGroup(client, normalizedScope, normalizedRoleCode, normalizedDepartment);

        if (hasExistingBackup) {
          throw new Error("Solo se permite un respaldo por ruta.");
        }
      }

    const nextSortOrder = Number(currentMax.rows[0]?.max_sort ?? "0") + 10;

    const result = await client.query<ApproverRecord>(
      `insert into approvers (department, scope, role_code, full_name, email, title, assignment_role, sort_order)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       on conflict ((coalesce(department, '')), scope, role_code, lower(email)) do update
         set full_name = excluded.full_name,
             title = excluded.title,
             assignment_role = excluded.assignment_role
       returning *`,
      [
        normalizedDepartment,
        normalizedScope,
        normalizedRoleCode,
        input.fullName.trim(),
        normalizedEmail,
        input.title.trim(),
        assignmentRole,
        nextSortOrder
      ]
    );

    if (assignmentRole === "PRIMARY") {
      await demotePrimaryApproversInGroup(client, normalizedScope, normalizedRoleCode, normalizedDepartment, result.rows[0].id);
    }

    return result.rows[0];
  });
}

export async function removeApprover(id: string) {
  await withTransaction(async (client) => {
    const currentResult = await client.query<ApproverRecord>(
      `select *
       from approvers
       where id = $1
       limit 1`,
      [id]
    );

    if (currentResult.rowCount === 0) {
      return;
    }

    const current = currentResult.rows[0];

    await client.query(`delete from approvers where id = $1`, [id]);

    if (current.assignment_role === "PRIMARY") {
      const backupResult = await client.query<ApproverRecord>(
        `select *
         from approvers
         where scope = $1
           and role_code = $2
           and coalesce(department, '') = coalesce($3, '')
         order by sort_order asc, created_at asc
         limit 1`,
        [current.scope, current.role_code, current.department]
      );

      if ((backupResult.rowCount ?? 0) > 0) {
        await client.query(
          `update approvers
           set assignment_role = 'PRIMARY'
           where id = $1`,
          [backupResult.rows[0].id]
        );
      }
    }
  });
}

export async function updateApprover(input: {
  id: string;
  fullName: string;
  email: string;
  title: string;
  assignmentRole?: string;
}) {
  return withTransaction(async (client) => {
    const currentResult = await client.query<ApproverRecord>(
      `select *
       from approvers
       where id = $1
       limit 1`,
      [input.id]
    );

    if (currentResult.rowCount === 0) {
      throw new Error("Aprobador no encontrado");
    }

    const current = currentResult.rows[0];
    const assignmentRole = normalizeAssignmentRole(input.assignmentRole ?? current.assignment_role);

    if (assignmentRole === "PRIMARY") {
      const hasExistingBackup = await hasBackupInGroup(client, current.scope, current.role_code, current.department, current.id);
      const hasExistingPrimary = await hasPrimaryInGroup(client, current.scope, current.role_code, current.department, current.id);

      if (hasExistingPrimary && hasExistingBackup) {
        throw new Error("Esta ruta ya tiene principal y respaldo. Edita uno existente en lugar de agregar un tercero.");
      }

      await demotePrimaryApproversInGroup(client, current.scope, current.role_code, current.department, current.id);
    } else {
      const hasExistingBackup = await hasBackupInGroup(client, current.scope, current.role_code, current.department, current.id);

      if (hasExistingBackup) {
        throw new Error("Solo se permite un respaldo por ruta.");
      }
    }

    const result = await client.query<ApproverRecord>(
      `update approvers
       set full_name = $2,
           email = lower($3),
           title = $4,
           assignment_role = $5
       where id = $1
       returning *`,
      [input.id, input.fullName.trim(), input.email.trim(), input.title.trim(), assignmentRole]
    );

    return result.rows[0];
  });
}

export async function setApproverAssignmentRole(input: { id: string; assignmentRole: string }) {
  return withTransaction(async (client) => {
    const currentResult = await client.query<ApproverRecord>(
      `select *
       from approvers
       where id = $1
       limit 1`,
      [input.id]
    );

    if (currentResult.rowCount === 0) {
      throw new Error("Aprobador no encontrado");
    }

    const current = currentResult.rows[0];
    const nextRole = normalizeAssignmentRole(input.assignmentRole);

    if (nextRole === "PRIMARY") {
      const hasExistingBackup = await hasBackupInGroup(client, current.scope, current.role_code, current.department, current.id);
      const hasExistingPrimary = await hasPrimaryInGroup(client, current.scope, current.role_code, current.department, current.id);

      if (hasExistingPrimary && hasExistingBackup) {
        throw new Error("Esta ruta ya tiene principal y respaldo. Edita uno existente en lugar de agregar un tercero.");
      }

      await demotePrimaryApproversInGroup(client, current.scope, current.role_code, current.department, current.id);
    } else {
      const hasExistingBackup = await hasBackupInGroup(client, current.scope, current.role_code, current.department, current.id);

      if (hasExistingBackup) {
        throw new Error("Solo se permite un respaldo por ruta.");
      }
    }

    const result = await client.query<ApproverRecord>(
      `update approvers
       set assignment_role = $2
       where id = $1
       returning *`,
      [input.id, nextRole]
    );

    return result.rows[0];
  });
}

export async function moveApprover(input: { id: string; direction: "up" | "down" }) {
  return withTransaction(async (client) => {
    const currentResult = await client.query<ApproverRecord>(
      `select *
       from approvers
       where id = $1
       limit 1`,
      [input.id]
    );

    if (currentResult.rowCount === 0) {
      throw new Error("Aprobador no encontrado");
    }

    const current = currentResult.rows[0];
    const comparator = input.direction === "up" ? "<" : ">";
    const ordering = input.direction === "up" ? "desc" : "asc";

    const siblingResult = await client.query<ApproverRecord>(
      `select *
       from approvers
       where scope = $1
         and role_code = $2
         and coalesce(department, '') = coalesce($3, '')
         and sort_order ${comparator} $4
       order by sort_order ${ordering}, created_at ${ordering}
       limit 1`,
      [current.scope, current.role_code, current.department, current.sort_order]
    );

    if (siblingResult.rowCount === 0) {
      return current;
    }

    const sibling = siblingResult.rows[0];

    await client.query(`update approvers set sort_order = $1 where id = $2`, [sibling.sort_order, current.id]);
    await client.query(`update approvers set sort_order = $1 where id = $2`, [current.sort_order, sibling.id]);

    const refreshed = await client.query<ApproverRecord>(
      `select *
       from approvers
       where id = $1`,
      [current.id]
    );

    return refreshed.rows[0];
  });
}

export async function reorderApprovers(ids: string[]) {
  return withTransaction(async (client) => {
    if (ids.length < 2) {
      return listApprovers();
    }

    const result = await client.query<ApproverRecord>(
      `select *
       from approvers
       where id = any($1::uuid[])`,
      [ids]
    );

    if (result.rowCount !== ids.length) {
      throw new Error("No se pudieron cargar todos los aprobadores para reordenar");
    }

    const records = result.rows;
    const first = records[0];
    const sameGroup = records.every(
      (item) =>
        item.scope === first.scope &&
        item.role_code === first.role_code &&
        (item.department ?? "") === (first.department ?? "")
    );

    if (!sameGroup) {
      throw new Error("Solo se pueden reordenar aprobadores del mismo grupo");
    }

    for (let index = 0; index < ids.length; index += 1) {
      await client.query(`update approvers set sort_order = $1 where id = $2`, [(index + 1) * 10, ids[index]]);
    }

    const refreshed = await client.query<ApproverRecord>(
      `select *
       from approvers
       order by coalesce(department, scope), role_code asc, sort_order asc, full_name asc`
    );

    return refreshed.rows;
  });
}

export async function isAdminUser(email: string) {
  const result = await query<{ total: string }>(
    `select count(*)::text as total
     from admin_users
     where lower(email) = lower($1)`,
    [normalizeEmail(email)]
  );

  return Number(result.rows[0]?.total ?? "0") > 0;
}

export async function addAdminUser(input: {
  fullName: string;
  email: string;
  createdByEmail: string;
}) {
  const result = await query<AdminUserRecord>(
    `insert into admin_users (full_name, email, created_by_email)
     values ($1, lower($2), lower($3))
     on conflict (email) do update
       set full_name = excluded.full_name
     returning *`,
    [input.fullName, input.email, input.createdByEmail]
  );

  return result.rows[0];
}

export async function getUserRoles(email: string) {
  const result = await query<UserRoleRecord>(
    `select *
     from user_roles
     where lower(email) = lower($1)
     order by role_code asc`,
    [normalizeEmail(email)]
  );

  return result.rows;
}

export async function addUserRole(input: {
  fullName: string;
  email: string;
  roleCode: string;
  createdByEmail: string;
}) {
  const result = await query<UserRoleRecord>(
    `insert into user_roles (full_name, email, role_code, created_by_email)
     values ($1, lower($2), $3, lower($4))
     on conflict (email, role_code) do update
       set full_name = excluded.full_name
     returning *`,
    [input.fullName, input.email, input.roleCode, input.createdByEmail]
  );

  return result.rows[0];
}

export async function addCatalogItem(input: {
  catalogKey: string;
  itemLabel: string;
  itemValue: string;
  sortOrder?: number;
}) {
  const result = await query<CatalogItemRecord>(
    `insert into catalog_items (catalog_key, item_label, item_value, sort_order)
     values ($1, $2, $3, $4)
     on conflict (catalog_key, item_value) do update
       set item_label = excluded.item_label,
           sort_order = excluded.sort_order,
           active = true
     returning *`,
    [input.catalogKey, input.itemLabel, input.itemValue, input.sortOrder ?? 999]
  );

  return result.rows[0];
}

export async function updateCatalogItem(input: {
  id: string;
  catalogKey: string;
  itemLabel: string;
  itemValue: string;
  sortOrder?: number;
}) {
  const result = await query<CatalogItemRecord>(
    `update catalog_items
     set catalog_key = $2,
         item_label = $3,
         item_value = $4,
         sort_order = $5,
         active = true
     where id = $1
     returning *`,
    [input.id, input.catalogKey, input.itemLabel, input.itemValue, input.sortOrder ?? 999]
  );

  if (result.rowCount === 0) {
    throw new Error("Catalogo no encontrado");
  }

  return result.rows[0];
}
