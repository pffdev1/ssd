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
  UserRoleAssignment,
  WorkflowStepTemplate
} from "./types";

function getServerBaseUrl() {
  return process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";
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
