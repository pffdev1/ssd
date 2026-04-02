import {
  AdminUser,
  ApproverAssignment,
  ApproverProfile,
  CatalogItem,
  CatalogResponse,
  DashboardResponse,
  PendingApprovalItem,
  RequestDetail,
  RequestItem,
  RequestType,
  UserRoleAssignment,
  WorkflowStepTemplate
} from "./types";

function getServerBaseUrl() {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  if (process.env.EXPO_PUBLIC_SUPABASE_URL) {
    return `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/api`;
  }

  return "http://localhost:54321/functions/v1/api";
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${getServerBaseUrl()}${path}`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`API request failed for ${path}`);
  }

  return response.json();
}

async function sendJson<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${getServerBaseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {})
    }
  });

  const payload = (await response.json().catch(() => ({}))) as T & { message?: string };

  if (!response.ok) {
    throw new Error(payload.message ?? `API request failed for ${path}`);
  }

  return payload as T;
}

export async function getCatalog() {
  return fetchJson<CatalogResponse>("/catalog");
}

export async function getDashboard() {
  return fetchJson<DashboardResponse>("/dashboard");
}

export async function getDashboardForActor(actorEmail: string) {
  return fetchJson<DashboardResponse>(`/dashboard?actorEmail=${encodeURIComponent(actorEmail)}`);
}

export async function getRequests(requesterEmail?: string, actorEmail?: string) {
  const search = new URLSearchParams();

  if (requesterEmail) {
    search.set("requesterEmail", requesterEmail);
  }

  if (actorEmail) {
    search.set("actorEmail", actorEmail);
  }

  const query = search.toString() ? `?${search.toString()}` : "";
  return fetchJson<RequestItem[]>(`/requests${query}`);
}

export async function getRequest(id: string, actorEmail?: string) {
  const query = actorEmail ? `?actorEmail=${encodeURIComponent(actorEmail)}` : "";
  return fetchJson<RequestDetail>(`/requests/${id}${query}`);
}

export async function getApproverInbox(email: string) {
  return fetchJson<PendingApprovalItem[]>(`/requests/inbox?email=${encodeURIComponent(email)}`);
}

export async function getApproverProfile(email: string) {
  return fetchJson<ApproverProfile[]>(`/approvers/profile?email=${encodeURIComponent(email)}`);
}

export async function checkAdmin(email: string) {
  return fetchJson<{ isAdmin: boolean }>(`/admins/check?email=${encodeURIComponent(email)}`);
}

export async function getAdminUsers(actorEmail: string) {
  return fetchJson<AdminUser[]>(`/admins?actorEmail=${encodeURIComponent(actorEmail)}`);
}

export async function getCatalogItems(actorEmail: string) {
  return fetchJson<CatalogItem[]>(`/admin/catalog-items?actorEmail=${encodeURIComponent(actorEmail)}`);
}

export async function getApprovedMobileLines(actorEmail: string) {
  return fetchJson<RequestItem[]>(`/admin/mobile-lines?actorEmail=${encodeURIComponent(actorEmail)}`);
}

export async function getUserRoles(email: string) {
  return fetchJson<UserRoleAssignment[]>(`/users/roles?email=${encodeURIComponent(email)}`);
}

export async function getAllUserRoles(actorEmail: string) {
  return fetchJson<UserRoleAssignment[]>(`/admin/user-roles?actorEmail=${encodeURIComponent(actorEmail)}`);
}

export async function getAdminApprovers(actorEmail: string) {
  return fetchJson<ApproverAssignment[]>(`/admin/approvers?actorEmail=${encodeURIComponent(actorEmail)}`);
}

export async function getWorkflowSteps(actorEmail: string) {
  return fetchJson<WorkflowStepTemplate[]>(`/admin/workflow-steps?actorEmail=${encodeURIComponent(actorEmail)}`);
}

export async function createRequest(input: {
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
}) {
  return sendJson<{ requestId: string; ticketCode: string; status: string }>("/requests", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function decideRequestStep(
  requestId: string,
  stepId: string,
  input: {
    decision: "approve" | "reject" | "complete";
    comments?: string;
    actorName: string;
    actorEmail: string;
  }
) {
  return sendJson<{ requestId: string; status: string }>(`/requests/${requestId}/steps/${stepId}/decision`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function addAdminUser(input: {
  actorEmail: string;
  fullName: string;
  email: string;
}) {
  return sendJson<{ created: AdminUser; admins: AdminUser[] }>("/admins", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function addUserRole(input: {
  actorEmail: string;
  fullName: string;
  email: string;
  roleCode: string;
}) {
  return sendJson<{ created: UserRoleAssignment; roles: UserRoleAssignment[] }>("/admin/user-roles", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function addCatalogItem(input: {
  actorEmail: string;
  catalogKey: string;
  itemLabel: string;
  itemValue: string;
  sortOrder: number;
}) {
  return sendJson<{ created: CatalogItem; items: CatalogItem[] }>("/admin/catalog-items", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function updateCatalogItem(input: {
  actorEmail: string;
  id: string;
  catalogKey: string;
  itemLabel: string;
  itemValue: string;
  sortOrder: number;
}) {
  return sendJson<{ updated: CatalogItem; items: CatalogItem[] }>(`/admin/catalog-items/${input.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      actorEmail: input.actorEmail,
      catalogKey: input.catalogKey,
      itemLabel: input.itemLabel,
      itemValue: input.itemValue,
      sortOrder: input.sortOrder
    })
  });
}

export async function createRequestType(input: {
  actorEmail: string;
  code: string;
  name: string;
  description: string;
  category: string;
  themeColor: string;
}) {
  return sendJson<{ requestTypes: RequestType[] }>("/admin/request-types", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function updateRequestType(input: {
  actorEmail: string;
  id: string;
  name: string;
  description: string;
  category: string;
  themeColor: string;
}) {
  return sendJson<{ requestTypes: RequestType[] }>(`/admin/request-types/${input.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      actorEmail: input.actorEmail,
      name: input.name,
      description: input.description,
      category: input.category,
      themeColor: input.themeColor
    })
  });
}

export async function deleteRequestType(input: { actorEmail: string; id: string }) {
  return sendJson<{ requestTypes: RequestType[] }>(
    `/admin/request-types/${input.id}?actorEmail=${encodeURIComponent(input.actorEmail)}`,
    {
      method: "DELETE"
    }
  );
}

export async function updateRequestTypeWorkflow(input: {
  actorEmail: string;
  id: string;
  stepCodes: string[];
}) {
  return sendJson<{ requestTypes: RequestType[] }>(`/admin/request-types/${input.id}/workflow`, {
    method: "PATCH",
    body: JSON.stringify({
      actorEmail: input.actorEmail,
      stepCodes: input.stepCodes
    })
  });
}

export async function createWorkflowStep(input: {
  actorEmail: string;
  code: string;
  label: string;
  description: string;
  kind: "approval" | "fulfillment";
  routing: "department" | "scope";
  scope: string | null;
  sortOrder: number;
  responsibleName?: string;
  responsibleEmail?: string;
  responsibleTitle?: string;
}) {
  return sendJson<{ created: WorkflowStepTemplate; steps: WorkflowStepTemplate[] }>("/admin/workflow-steps", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function updateWorkflowStep(input: {
  actorEmail: string;
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
  return sendJson<{ updated: WorkflowStepTemplate; steps: WorkflowStepTemplate[] }>(`/admin/workflow-steps/${input.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      actorEmail: input.actorEmail,
      label: input.label,
      description: input.description,
      active: input.active,
      sortOrder: input.sortOrder,
      responsibleName: input.responsibleName,
      responsibleEmail: input.responsibleEmail,
      responsibleTitle: input.responsibleTitle,
      clearResponsible: input.clearResponsible ?? false
    })
  });
}

export async function deleteWorkflowStep(input: { actorEmail: string; id: string }) {
  return sendJson<{ steps: WorkflowStepTemplate[]; requestTypes: RequestType[] }>(
    `/admin/workflow-steps/${input.id}?actorEmail=${encodeURIComponent(input.actorEmail)}`,
    {
      method: "DELETE"
    }
  );
}

export async function addApprover(input: {
  actorEmail: string;
  fullName: string;
  email: string;
  title: string;
  scope: string;
  roleCode: string;
  department: string | null;
  assignmentRole: "PRIMARY" | "BACKUP";
}) {
  return sendJson<{ created: ApproverAssignment; approvers: ApproverAssignment[] }>("/admin/approvers", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function updateApprover(input: {
  actorEmail: string;
  id: string;
  fullName: string;
  email: string;
  title: string;
  assignmentRole: "PRIMARY" | "BACKUP";
}) {
  return sendJson<{ updated: ApproverAssignment; approvers: ApproverAssignment[] }>(`/admin/approvers/${input.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      actorEmail: input.actorEmail,
      fullName: input.fullName,
      email: input.email,
      title: input.title,
      assignmentRole: input.assignmentRole
    })
  });
}

export async function moveApprover(input: {
  actorEmail: string;
  id: string;
  direction: "up" | "down";
}) {
  return sendJson<{ approvers: ApproverAssignment[] }>(`/admin/approvers/${input.id}/move`, {
    method: "POST",
    body: JSON.stringify({
      actorEmail: input.actorEmail,
      direction: input.direction
    })
  });
}

export async function setApproverAssignmentRole(input: {
  actorEmail: string;
  id: string;
  assignmentRole: "PRIMARY" | "BACKUP";
}) {
  return sendJson<{ approvers: ApproverAssignment[] }>(`/admin/approvers/${input.id}/assignment-role`, {
    method: "POST",
    body: JSON.stringify({
      actorEmail: input.actorEmail,
      assignmentRole: input.assignmentRole
    })
  });
}

export async function removeApprover(input: { actorEmail: string; id: string }) {
  return sendJson<{ approvers: ApproverAssignment[] }>(
    `/admin/approvers/${input.id}?actorEmail=${encodeURIComponent(input.actorEmail)}`,
    {
      method: "DELETE"
    }
  );
}
