import { createHash } from "crypto";
import { PoolClient, QueryResult } from "pg";
import { query, withTransaction } from "../db";
import { notifyRequestCreated, notifyRequestUpdated } from "./notifications";
import {
  AdminUserRecord,
  ApproverRecord,
  CatalogItemRecord,
  EmployeeProfileRecord,
  OrgUnitRecord,
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
    code: "IMMEDIATE_LEAD",
    label: "Aprobacion de Jefatura Inmediata",
    description: "Deriva la solicitud al supervisor o jefatura principal del departamento seleccionado.",
    kind: "approval",
    routing: "requester_unit",
    scope: null,
    sort_order: 5,
    active: true
  },
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

async function getOrgUnits(client?: PoolClient, activeOnly = true) {
  const sql = `select *
     from org_units
     ${activeOnly ? "where active = true" : ""}
     order by sort_order asc, name asc`;

  if (client) {
    const result = await client.query<OrgUnitRecord>(sql);
    return result.rows;
  }

  const result = await query<OrgUnitRecord>(sql);
  return result.rows;
}

async function getDepartmentOrgUnits(client?: PoolClient) {
  const sql = `select *
     from org_units
     where active = true
       and unit_type = 'departamento'
     order by sort_order asc, name asc`;

  if (client) {
    const result = await client.query<OrgUnitRecord>(sql);
    return result.rows;
  }

  const result = await query<OrgUnitRecord>(sql);
  return result.rows;
}

async function getEmployeeProfiles(client?: PoolClient, activeOnly = true) {
  const sql = `select
      employee_profiles.*,
      units.name as org_unit_name,
      supervisor.full_name as reports_to_name
    from employee_profiles
    left join org_units units on units.id = employee_profiles.org_unit_id
    left join employee_profiles supervisor on supervisor.id = employee_profiles.reports_to_profile_id
    ${activeOnly ? "where employee_profiles.active = true" : ""}
    order by employee_profiles.sort_order asc, employee_profiles.full_name asc`;

  if (client) {
    const result = await client.query<EmployeeProfileRecord>(sql);
    return result.rows;
  }

  const result = await query<EmployeeProfileRecord>(sql);
  return result.rows;
}

async function getEmployeeProfileByEmail(email: string, client?: PoolClient) {
  if (!email.trim()) {
    return null;
  }

  const sql = `select
      employee_profiles.*,
      units.name as org_unit_name,
      supervisor.full_name as reports_to_name
    from employee_profiles
    left join org_units units on units.id = employee_profiles.org_unit_id
    left join employee_profiles supervisor on supervisor.id = employee_profiles.reports_to_profile_id
    where employee_profiles.active = true
      and lower(employee_profiles.email) = lower($1)
    limit 1`;

  if (client) {
    const result = await client.query<EmployeeProfileRecord>(sql, [normalizeEmail(email)]);
    return result.rows[0] ?? null;
  }

  const result = await query<EmployeeProfileRecord>(sql, [normalizeEmail(email)]);
  return result.rows[0] ?? null;
}

async function getEmployeeProfileById(id: string, client?: PoolClient) {
  const sql = `select
      employee_profiles.*,
      units.name as org_unit_name,
      supervisor.full_name as reports_to_name
    from employee_profiles
    left join org_units units on units.id = employee_profiles.org_unit_id
    left join employee_profiles supervisor on supervisor.id = employee_profiles.reports_to_profile_id
    where employee_profiles.id = $1
    limit 1`;

  if (client) {
    const result = await client.query<EmployeeProfileRecord>(sql, [id]);
    return result.rows[0] ?? null;
  }

  const result = await query<EmployeeProfileRecord>(sql, [id]);
  return result.rows[0] ?? null;
}

async function getOrgUnitById(id: string, client?: PoolClient) {
  const sql = `select *
     from org_units
     where id = $1
     limit 1`;

  if (client) {
    const result = await client.query<OrgUnitRecord>(sql, [id]);
    return result.rows[0] ?? null;
  }

  const result = await query<OrgUnitRecord>(sql, [id]);
  return result.rows[0] ?? null;
}

async function getOrgUnitByName(name: string, client?: PoolClient) {
  const sql = `select *
     from org_units
     where name = $1
     limit 1`;

  if (client) {
    const result = await client.query<OrgUnitRecord>(sql, [name.trim()]);
    return result.rows[0] ?? null;
  }

  const result = await query<OrgUnitRecord>(sql, [name.trim()]);
  return result.rows[0] ?? null;
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

async function getApproverByOrgUnit(orgUnitId: string, roleCode: string, client: PoolClient): Promise<ApproverRecord | null> {
  const result = await client.query<ApproverRecord>(
    `select *
     from approvers
     where org_unit_id = $1
       and role_code = $2
     order by case when assignment_role = 'PRIMARY' then 0 else 1 end asc, sort_order asc, created_at asc
     limit 1`,
    [orgUnitId, roleCode]
  );

  return result.rows[0] ?? null;
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

async function resolveRequesterUnitApprover(input: {
  requesterEmail: string;
  department: string;
  roleCode: string;
  client: PoolClient;
}) {
  const departmentUnit = await getOrgUnitByName(input.department, input.client);
  let currentUnitId: string | null = departmentUnit?.id ?? null;

  while (currentUnitId) {
    const approver = await getApproverByOrgUnit(currentUnitId, input.roleCode, input.client);

    if (approver && normalizeEmail(approver.email) !== normalizeEmail(input.requesterEmail)) {
      return approver;
    }

    const currentUnit = await getOrgUnitById(currentUnitId, input.client);
    currentUnitId = currentUnit?.parent_id ?? null;
  }

  const departmentFallback = await input.client.query<ApproverRecord>(
    `select *
     from approvers
     where department = $1
       and role_code = $2
     order by case when assignment_role = 'PRIMARY' then 0 else 1 end asc, sort_order asc, created_at asc
     limit 1`,
    [input.department, input.roleCode]
  );

  if ((departmentFallback.rowCount ?? 0) > 0) {
    const approver = departmentFallback.rows[0];

    if (normalizeEmail(approver.email) !== normalizeEmail(input.requesterEmail)) {
      return approver;
    }
  }

  return null;
}

async function buildStepAssignments(
  requestType: RequestTypeRecord,
  department: string,
  requesterEmail: string,
  client: PoolClient
): Promise<StepAssignment[]> {
  const assignments: StepAssignment[] = [];

  for (let index = 0; index < requestType.workflow.steps.length; index += 1) {
    const template = requestType.workflow.steps[index];
    let approver: ApproverRecord | null;

    if (template.routing === "department") {
      approver = await getApproverByDepartment(department, template.code, client);
    } else if (template.routing === "requester_unit") {
      approver = await resolveRequesterUnitApprover({
        requesterEmail,
        department,
        roleCode: template.code,
        client
      });
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
    throw new Error("No se pudo resolver ningun aprobador para este workflow. Revisa el organigrama y sus responsables.");
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
    const steps = await buildStepAssignments(requestType, normalizedDepartment, input.requesterEmail, client);
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
  routing: "department" | "scope" | "requester_unit";
  scope?: string | null;
  sortOrder?: number;
}) {
  const normalizedCode = normalizeWorkflowStepCode(input.code);
  const allowedKinds = new Set(["approval", "fulfillment"]);
  const allowedRoutings = new Set(["department", "scope", "requester_unit"]);

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

  if (normalizedRouting === "scope" && !normalizedScope) {
    throw new Error("Debes indicar un scope para los pasos por alcance");
  }

  const result = await query<WorkflowStepTemplateRecord>(
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

  return result.rows[0];
}

async function buildWorkflowDefinition(stepCodes: string[], client?: PoolClient) {
  const normalizedCodes = stepCodes.map((code) => code.trim().toUpperCase()).filter(Boolean);

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
  const defaultStepCodes = ["IMMEDIATE_LEAD", "AREA_MANAGER"].filter((code) =>
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
     from approvers
     order by coalesce(department, scope), role_code asc, case when assignment_role = 'PRIMARY' then 0 else 1 end asc, sort_order asc, full_name asc`
  );

  return result.rows;
}

async function getWorkflowStepTemplates(client?: PoolClient, includeInactive = true) {
  await ensureDefaultWorkflowStepTemplates(client);

  const sql = `select *
     from workflow_step_templates
     ${includeInactive ? "" : "where active = true"}
     order by sort_order asc, label asc`;

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
  const orgDepartments = await getDepartmentOrgUnits();

  if (orgDepartments.length > 0) {
    return orgDepartments.map((item) => item.name);
  }

  const catalogDepartments = await getActiveCatalogItems("DEPARTMENT");

  if (catalogDepartments.length > 0) {
    return catalogDepartments.map((item) => item.item_value);
  }

  const result = await query<{ department: string }>(
    `select distinct department
     from approvers
     where department is not null
     order by department asc`
  );

  return result.rows.map((row: { department: string }) => row.department);
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

export async function listOrgUnits() {
  return getOrgUnits(undefined, true);
}

export async function listEmployeeProfiles() {
  return getEmployeeProfiles(undefined, true);
}

export async function getEmployeeDirectoryProfile(email: string) {
  return getEmployeeProfileByEmail(email);
}

export async function updateWorkflowStepTemplate(input: {
  id: string;
  label: string;
  description: string;
  active: boolean;
  sortOrder: number;
}) {
  const result = await query<WorkflowStepTemplateRecord>(
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

  return result.rows[0];
}

export async function removeWorkflowStepTemplate(id: string) {
  const currentResult = await query<WorkflowStepTemplateRecord>(
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

  const [workflowUsage, approverUsage] = await Promise.all([
    query<{ total: string }>(
      `select count(*)::text as total
       from request_types
       where exists (
         select 1
         from jsonb_array_elements(workflow -> 'steps') step
         where step ->> 'code' = $1
       )`,
      [current.code]
    ),
    query<{ total: string }>(
      `select count(*)::text as total
       from approvers
       where role_code = $1`,
      [current.code]
    )
  ]);

  if (Number(workflowUsage.rows[0]?.total ?? "0") > 0 || Number(approverUsage.rows[0]?.total ?? "0") > 0) {
    throw new Error("Primero debes quitar este paso de los workflows y de la matriz de aprobadores");
  }

  await query(`delete from workflow_step_templates where id = $1`, [id]);
}

export async function addApprover(input: {
  department: string | null;
  orgUnitId?: string | null;
  scope: string;
  roleCode: string;
  fullName: string;
  email: string;
  title: string;
  assignmentRole?: string;
}) {
  const normalizedDepartment = input.department?.trim() ? input.department.trim() : null;
  const normalizedOrgUnitId = input.orgUnitId?.trim() ? input.orgUnitId.trim() : null;
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

      const orgUnitResult = normalizedOrgUnitId
        ? await client.query<OrgUnitRecord>(
            `select *
             from org_units
             where id = $1
             limit 1`,
            [normalizedOrgUnitId]
          )
        : normalizedDepartment !== null
          ? await client.query<OrgUnitRecord>(
              `select *
               from org_units
               where name = $1
               limit 1`,
              [normalizedDepartment]
            )
          : { rows: [] as OrgUnitRecord[] };

      if (normalizedOrgUnitId && orgUnitResult.rows.length === 0) {
        throw new Error("La unidad organizacional indicada no existe");
      }

      if (assignmentRole === "PRIMARY") {
        await demotePrimaryApproversInGroup(client, normalizedScope, normalizedRoleCode, normalizedDepartment);
      }

    const nextSortOrder = Number(currentMax.rows[0]?.max_sort ?? "0") + 10;

    const result = await client.query<ApproverRecord>(
      `insert into approvers (department, org_unit_id, scope, role_code, full_name, email, title, assignment_role, sort_order)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       on conflict ((coalesce(department, '')), scope, role_code, lower(email)) do update
         set full_name = excluded.full_name,
             title = excluded.title,
             org_unit_id = excluded.org_unit_id,
             assignment_role = excluded.assignment_role
       returning *`,
      [
        normalizedDepartment,
        orgUnitResult.rows[0]?.id ?? null,
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
      await demotePrimaryApproversInGroup(client, current.scope, current.role_code, current.department, current.id);
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
      await demotePrimaryApproversInGroup(client, current.scope, current.role_code, current.department, current.id);
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

export async function addOrgUnit(input: {
  name: string;
  unitType: string;
  parentId?: string | null;
  sortOrder?: number;
}) {
  const result = await query<OrgUnitRecord>(
    `insert into org_units (name, unit_type, parent_id, sort_order, active)
     values ($1, $2, $3, $4, true)
     on conflict (name) do update
       set unit_type = excluded.unit_type,
           parent_id = excluded.parent_id,
           sort_order = excluded.sort_order,
           active = true
     returning *`,
    [input.name.trim(), input.unitType.trim().toLowerCase(), input.parentId ?? null, input.sortOrder ?? 999]
  );

  return result.rows[0];
}

export async function updateOrgUnit(input: {
  id: string;
  name: string;
  unitType: string;
  parentId?: string | null;
  sortOrder?: number;
}) {
  if (input.parentId === input.id) {
    throw new Error("Una unidad no puede ser su propio padre");
  }

  const result = await query<OrgUnitRecord>(
    `update org_units
     set name = $2,
         unit_type = $3,
         parent_id = $4,
         sort_order = $5,
         active = true
     where id = $1
     returning *`,
    [input.id, input.name.trim(), input.unitType.trim().toLowerCase(), input.parentId ?? null, input.sortOrder ?? 999]
  );

  if (result.rowCount === 0) {
    throw new Error("Unidad organizacional no encontrada");
  }

  await query(
    `update approvers
     set department = $2
     where org_unit_id = $1`,
    [input.id, input.name.trim()]
  );

  return result.rows[0];
}

export async function addEmployeeProfile(input: {
  fullName: string;
  email?: string | null;
  title: string;
  orgUnitId: string;
  reportsToProfileId?: string | null;
  sortOrder?: number;
}) {
  const orgUnit = await getOrgUnitById(input.orgUnitId);

  if (!orgUnit) {
    throw new Error("La unidad organizacional indicada no existe");
  }

  if (input.reportsToProfileId) {
    const supervisor = await query<EmployeeProfileRecord>(
      `select *
       from employee_profiles
       where id = $1
       limit 1`,
      [input.reportsToProfileId]
    );

    if (supervisor.rowCount === 0) {
      throw new Error("El supervisor indicado no existe");
    }
  }

  const normalizedEmail = input.email?.trim() ? normalizeEmail(input.email) : null;
  const result = await query<EmployeeProfileRecord>(
    `insert into employee_profiles (full_name, email, title, org_unit_id, reports_to_profile_id, sort_order, active)
     values ($1, $2, $3, $4, $5, $6, true)
     returning *`,
    [
      input.fullName.trim(),
      normalizedEmail,
      input.title.trim(),
      input.orgUnitId,
      input.reportsToProfileId ?? null,
      input.sortOrder ?? 999
    ]
  );

  return result.rows[0];
}

export async function updateEmployeeProfile(input: {
  id: string;
  fullName: string;
  email?: string | null;
  title: string;
  orgUnitId: string;
  reportsToProfileId?: string | null;
  sortOrder?: number;
}) {
  if (input.reportsToProfileId === input.id) {
    throw new Error("Un colaborador no puede reportarse a si mismo");
  }

  const orgUnit = await getOrgUnitById(input.orgUnitId);

  if (!orgUnit) {
    throw new Error("La unidad organizacional indicada no existe");
  }

  if (input.reportsToProfileId) {
    const supervisor = await query<EmployeeProfileRecord>(
      `select *
       from employee_profiles
       where id = $1
       limit 1`,
      [input.reportsToProfileId]
    );

    if (supervisor.rowCount === 0) {
      throw new Error("El supervisor indicado no existe");
    }
  }

  const normalizedEmail = input.email?.trim() ? normalizeEmail(input.email) : null;
  const result = await query<EmployeeProfileRecord>(
    `update employee_profiles
     set full_name = $2,
         email = $3,
         title = $4,
         org_unit_id = $5,
         reports_to_profile_id = $6,
         sort_order = $7,
         active = true
     where id = $1
     returning *`,
    [
      input.id,
      input.fullName.trim(),
      normalizedEmail,
      input.title.trim(),
      input.orgUnitId,
      input.reportsToProfileId ?? null,
      input.sortOrder ?? 999
    ]
  );

  if (result.rowCount === 0) {
    throw new Error("Colaborador no encontrado");
  }

  return result.rows[0];
}

export async function removeEmployeeProfile(id: string) {
  await query(
    `update employee_profiles
     set reports_to_profile_id = null
     where reports_to_profile_id = $1`,
    [id]
  );

  const result = await query<EmployeeProfileRecord>(
    `delete from employee_profiles
     where id = $1
     returning *`,
    [id]
  );

  if (result.rowCount === 0) {
    throw new Error("Colaborador no encontrado");
  }

  return result.rows[0];
}
