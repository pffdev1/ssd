create extension if not exists pgcrypto;

create table if not exists request_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text not null,
  category text not null,
  theme_color text not null,
  fields jsonb not null default '[]'::jsonb,
  workflow jsonb not null default '{}'::jsonb,
  requires_general_management boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists org_units (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  unit_type text not null,
  parent_id uuid references org_units(id) on delete set null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists employee_profiles (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text,
  title text not null,
  org_unit_id uuid references org_units(id) on delete set null,
  reports_to_profile_id uuid references employee_profiles(id) on delete set null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists approvers (
  id uuid primary key default gen_random_uuid(),
  department text,
  org_unit_id uuid references org_units(id) on delete set null,
  scope text not null,
  role_code text not null,
  full_name text not null,
  email text not null,
  title text not null,
  assignment_role text not null default 'PRIMARY',
  sort_order integer not null default 100,
  created_at timestamptz not null default now()
);

create table if not exists admin_users (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null unique,
  created_by_email text,
  created_at timestamptz not null default now()
);

create table if not exists user_roles (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  role_code text not null,
  created_by_email text,
  created_at timestamptz not null default now()
);

create table if not exists catalog_items (
  id uuid primary key default gen_random_uuid(),
  catalog_key text not null,
  item_label text not null,
  item_value text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists workflow_step_templates (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  description text not null,
  kind text not null,
  routing text not null,
  scope text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists requests (
  id uuid primary key default gen_random_uuid(),
  request_type_id uuid not null references request_types(id),
  ticket_code text not null unique,
  status text not null,
  requester_name text not null,
  requester_email text not null,
  department text not null,
  beneficiary_name text,
  subject text not null,
  justification text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists request_steps (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests(id) on delete cascade,
  sequence integer not null,
  role_code text not null,
  label text not null,
  kind text not null,
  approver_name text not null,
  approver_email text not null,
  department text,
  status text not null,
  decision text,
  comments text,
  acted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists request_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests(id) on delete cascade,
  event_type text not null,
  actor_name text not null,
  actor_email text not null,
  notes text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_requests_status on requests(status);
create index if not exists idx_requests_department on requests(department);
create index if not exists idx_request_steps_request_id on request_steps(request_id);
create index if not exists idx_request_steps_status on request_steps(status);
create index if not exists idx_admin_users_email on admin_users(email);
create index if not exists idx_user_roles_email on user_roles(email);
create index if not exists idx_org_units_parent on org_units(parent_id, sort_order);
create index if not exists idx_employee_profiles_org_unit on employee_profiles(org_unit_id, sort_order, full_name);
create index if not exists idx_approvers_route on approvers(scope, role_code, department, sort_order);
create index if not exists idx_approvers_org_unit on approvers(org_unit_id, assignment_role, sort_order);
create index if not exists idx_workflow_step_templates_active on workflow_step_templates(active, sort_order);
create unique index if not exists idx_user_roles_unique on user_roles(email, role_code);
create unique index if not exists idx_catalog_items_unique on catalog_items(catalog_key, item_value);
create unique index if not exists idx_approvers_assignment on approvers(coalesce(department, ''), scope, role_code, lower(email));
create unique index if not exists idx_employee_profiles_email_unique on employee_profiles(lower(email)) where email is not null;
