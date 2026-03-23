export type StepKind = "approval" | "fulfillment";

export interface FormFieldOption {
  option: string;
}

export interface FormFieldDefinition {
  name: string;
  label: string;
  type: "text" | "email" | "textarea" | "date" | "number" | "dropdown" | "radio";
  placeholder?: string;
  required?: boolean;
  helpText?: string;
  options?: FormFieldOption[];
}

export interface WorkflowStepTemplate {
  code: string;
  label: string;
  kind: StepKind;
  routing: "department" | "scope" | "requester_unit";
  scope?: string;
}

export interface RequestTypeRecord {
  id: string;
  code: string;
  name: string;
  description: string;
  category: string;
  theme_color: string;
  fields: FormFieldDefinition[];
  workflow: {
    steps: WorkflowStepTemplate[];
  };
  requires_general_management: boolean;
  active: boolean;
}

export interface CatalogItemRecord {
  id: string;
  catalog_key: string;
  item_label: string;
  item_value: string;
  sort_order: number;
  active: boolean;
  created_at: string;
}

export interface WorkflowStepTemplateRecord {
  id: string;
  code: string;
  label: string;
  description: string;
  kind: StepKind;
  routing: "department" | "scope" | "requester_unit";
  scope: string | null;
  sort_order: number;
  active: boolean;
  created_at: string;
}

export interface OrgUnitRecord {
  id: string;
  name: string;
  unit_type: string;
  parent_id: string | null;
  sort_order: number;
  active: boolean;
  created_at: string;
}

export interface EmployeeProfileRecord {
  id: string;
  full_name: string;
  email: string | null;
  title: string;
  org_unit_id: string | null;
  reports_to_profile_id: string | null;
  sort_order: number;
  active: boolean;
  created_at: string;
  org_unit_name?: string | null;
  reports_to_name?: string | null;
}

export interface ApproverRecord {
  id: string;
  department: string | null;
  org_unit_id: string | null;
  scope: string;
  role_code: string;
  full_name: string;
  email: string;
  title: string;
  assignment_role: string;
  sort_order: number;
}

export interface RequestListItem {
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

export interface RequestStepRecord {
  id: string;
  request_id: string;
  sequence: number;
  role_code: string;
  label: string;
  kind: StepKind;
  approver_name: string;
  approver_email: string;
  department: string | null;
  status: string;
  decision: string | null;
  comments: string | null;
  acted_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface RequestEventRecord {
  id: string;
  request_id: string;
  event_type: string;
  actor_name: string;
  actor_email: string;
  notes: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface RequestDetailRecord extends RequestListItem {
  steps: RequestStepRecord[];
  events: RequestEventRecord[];
}

export interface PendingApprovalItem extends RequestListItem {
  step_id: string;
  step_label: string;
  step_kind: StepKind;
  step_sequence: number;
  approver_name: string;
  approver_email: string;
  step_status: string;
  step_created_at: string;
}

export interface AdminUserRecord {
  id: string;
  full_name: string;
  email: string;
  created_by_email: string | null;
  created_at: string;
}

export interface UserRoleRecord {
  id: string;
  full_name: string;
  email: string;
  role_code: string;
  created_by_email: string | null;
  created_at: string;
}
