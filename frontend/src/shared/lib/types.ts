export interface FieldOption {
  option: string;
}

export interface FormFieldDefinition {
  name: string;
  label: string;
  type: "text" | "email" | "textarea" | "date" | "number" | "dropdown" | "radio";
  placeholder?: string;
  required?: boolean;
  helpText?: string;
  options?: FieldOption[];
}

export interface RequestType {
  id: string;
  code: string;
  name: string;
  description: string;
  category: string;
  theme_color: string;
  fields: FormFieldDefinition[];
  workflow: {
    steps: Array<{
      code: string;
      label: string;
      kind: "approval" | "fulfillment";
      routing: "department" | "scope" | "requester_unit";
      scope?: string;
    }>;
  };
  requires_general_management: boolean;
  active: boolean;
}

export interface RequestItem {
  id: string;
  ticket_code: string;
  status: string;
  requester_name: string;
  requester_email: string;
  department: string;
  beneficiary_name: string | null;
  subject: string;
  justification: string;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  request_type_code: string;
  request_type_name: string;
  category: string;
}

export interface RequestStep {
  id: string;
  sequence: number;
  role_code: string;
  label: string;
  kind: "approval" | "fulfillment";
  approver_name: string;
  approver_email: string;
  department: string | null;
  status: string;
  decision: string | null;
  comments: string | null;
  acted_at: string | null;
  metadata: Record<string, unknown>;
}

export interface RequestDetail extends RequestItem {
  steps: RequestStep[];
  events: Array<{
    id: string;
    event_type: string;
    actor_name: string;
    actor_email: string;
    notes: string;
    payload: Record<string, unknown>;
    created_at: string;
  }>;
}

export interface AppUser {
  name: string;
  email: string;
  isAdmin?: boolean;
  isApprover?: boolean;
  canManagePeopleFlows?: boolean;
  roleLabels?: string[];
  userRoleCodes?: string[];
}

export interface ApproverProfile {
  id: string;
  department: string | null;
  org_unit_id?: string | null;
  scope: string;
  role_code: string;
  full_name: string;
  email: string;
  title: string;
  assignment_role?: string;
  sort_order: number;
}

export interface ApproverAssignment {
  id: string;
  department: string | null;
  org_unit_id?: string | null;
  scope: string;
  role_code: string;
  full_name: string;
  email: string;
  title: string;
  assignment_role?: "PRIMARY" | "BACKUP";
  sort_order: number;
}

export interface OrgUnit {
  id: string;
  name: string;
  unit_type: "company" | "division" | "gerencia" | "jefatura" | "departamento";
  parent_id: string | null;
  sort_order: number;
  active: boolean;
  created_at: string;
}

export interface EmployeeProfile {
  id: string;
  full_name: string;
  email: string | null;
  title: string;
  org_unit_id: string | null;
  reports_to_profile_id: string | null;
  reports_to_name?: string | null;
  org_unit_name?: string | null;
  sort_order: number;
  active: boolean;
  created_at: string;
}

export interface PendingApprovalItem extends RequestItem {
  step_id: string;
  step_label: string;
  step_kind: "approval" | "fulfillment";
  step_sequence: number;
  approver_name: string;
  approver_email: string;
  step_status: string;
  step_created_at: string;
}

export interface CatalogResponse {
  requestTypes: RequestType[];
  departments: string[];
  approvers: Array<{
    id: string;
    department: string | null;
    org_unit_id?: string | null;
    scope: string;
    role_code: string;
    full_name: string;
    email: string;
    title: string;
    assignment_role?: "PRIMARY" | "BACKUP";
    sort_order: number;
  }>;
}

export interface DashboardResponse {
  metrics: Array<{ status: string; total: string }>;
  byType: Array<{ name: string; total: string }>;
  pendingByApprover: Array<{ approver_name: string; pending: string }>;
  recentRequests: RequestItem[];
}

export interface AdminUser {
  id: string;
  full_name: string;
  email: string;
  created_by_email: string | null;
  created_at: string;
}

export interface UserRoleAssignment {
  id: string;
  full_name: string;
  email: string;
  role_code: string;
  created_by_email: string | null;
  created_at: string;
}

export interface CatalogItem {
  id: string;
  catalog_key: string;
  item_label: string;
  item_value: string;
  sort_order: number;
  active: boolean;
  created_at: string;
}

export interface WorkflowStepTemplate {
  id: string;
  code: string;
  label: string;
  description: string;
  kind: "approval" | "fulfillment";
  routing: "department" | "scope" | "requester_unit";
  scope: string | null;
  sort_order: number;
  active: boolean;
  created_at: string;
}
