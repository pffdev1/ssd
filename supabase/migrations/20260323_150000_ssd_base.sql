create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null default '',
  title text not null default '',
  department text,
  avatar_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    lower(coalesce(new.email, new.raw_user_meta_data->>'email', new.raw_user_meta_data->>'preferred_username')),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(coalesce(new.email, ''), '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = excluded.full_name,
    avatar_url = excluded.avatar_url,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_auth_user();

create or replace function public.current_user_email()
returns text
language sql
stable
as $$
  select lower(
    coalesce(
      auth.jwt() ->> 'email',
      auth.jwt() ->> 'preferred_username',
      ''
    )
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.admin_users
    where lower(email) = public.current_user_email()
  );
$$;

create or replace function public.can_access_request(target_request_id uuid)
returns boolean
language sql
stable
as $$
  select
    public.is_admin()
    or exists (
      select 1
      from public.requests
      where id = target_request_id
        and lower(requester_email) = public.current_user_email()
    )
    or exists (
      select 1
      from public.request_steps
      where request_id = target_request_id
        and lower(approver_email) = public.current_user_email()
    );
$$;

create table if not exists public.request_types (
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

create table if not exists public.org_units (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  unit_type text not null,
  parent_id uuid references public.org_units(id) on delete set null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.employee_profiles (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text,
  title text not null,
  org_unit_id uuid references public.org_units(id) on delete set null,
  reports_to_profile_id uuid references public.employee_profiles(id) on delete set null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.approvers (
  id uuid primary key default gen_random_uuid(),
  department text,
  org_unit_id uuid references public.org_units(id) on delete set null,
  scope text not null,
  role_code text not null,
  full_name text not null,
  email text not null,
  title text not null,
  assignment_role text not null default 'PRIMARY',
  sort_order integer not null default 100,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null unique,
  created_by_email text,
  created_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  role_code text not null,
  created_by_email text,
  created_at timestamptz not null default now()
);

create table if not exists public.catalog_items (
  id uuid primary key default gen_random_uuid(),
  catalog_key text not null,
  item_label text not null,
  item_value text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.workflow_step_templates (
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

create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  request_type_id uuid not null references public.request_types(id),
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

drop trigger if exists trg_requests_updated_at on public.requests;
create trigger trg_requests_updated_at
before update on public.requests
for each row
execute function public.set_updated_at();

create table if not exists public.request_steps (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
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

create table if not exists public.request_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  event_type text not null,
  actor_name text not null,
  actor_email text not null,
  notes text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_requests_status on public.requests(status);
create index if not exists idx_requests_department on public.requests(department);
create index if not exists idx_request_steps_request_id on public.request_steps(request_id);
create index if not exists idx_request_steps_status on public.request_steps(status);
create index if not exists idx_admin_users_email on public.admin_users(email);
create index if not exists idx_user_roles_email on public.user_roles(email);
create index if not exists idx_org_units_parent on public.org_units(parent_id, sort_order);
create index if not exists idx_employee_profiles_org_unit on public.employee_profiles(org_unit_id, sort_order, full_name);
create index if not exists idx_approvers_route on public.approvers(scope, role_code, department, sort_order);
create index if not exists idx_approvers_org_unit on public.approvers(org_unit_id, assignment_role, sort_order);
create index if not exists idx_workflow_step_templates_active on public.workflow_step_templates(active, sort_order);
create unique index if not exists idx_user_roles_unique on public.user_roles(email, role_code);
create unique index if not exists idx_catalog_items_unique on public.catalog_items(catalog_key, item_value);
create unique index if not exists idx_approvers_assignment on public.approvers(coalesce(department, ''), scope, role_code, lower(email));
create unique index if not exists idx_employee_profiles_email_unique on public.employee_profiles(lower(email)) where email is not null;

alter table public.profiles enable row level security;
alter table public.request_types enable row level security;
alter table public.org_units enable row level security;
alter table public.employee_profiles enable row level security;
alter table public.approvers enable row level security;
alter table public.admin_users enable row level security;
alter table public.user_roles enable row level security;
alter table public.catalog_items enable row level security;
alter table public.workflow_step_templates enable row level security;
alter table public.requests enable row level security;
alter table public.request_steps enable row level security;
alter table public.request_events enable row level security;

drop policy if exists "profiles_select_self_or_admin" on public.profiles;
create policy "profiles_select_self_or_admin"
on public.profiles
for select
to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_update_self_or_admin" on public.profiles;
create policy "profiles_update_self_or_admin"
on public.profiles
for update
to authenticated
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

drop policy if exists "admins_can_read_admin_users" on public.admin_users;
create policy "admins_can_read_admin_users"
on public.admin_users
for select
to authenticated
using (public.is_admin() or lower(email) = public.current_user_email());

drop policy if exists "admins_manage_admin_users" on public.admin_users;
create policy "admins_manage_admin_users"
on public.admin_users
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "authenticated_read_request_catalog" on public.request_types;
create policy "authenticated_read_request_catalog"
on public.request_types
for select
to authenticated
using (true);

drop policy if exists "admins_manage_request_catalog" on public.request_types;
create policy "admins_manage_request_catalog"
on public.request_types
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "authenticated_read_catalog_items" on public.catalog_items;
create policy "authenticated_read_catalog_items"
on public.catalog_items
for select
to authenticated
using (true);

drop policy if exists "admins_manage_catalog_items" on public.catalog_items;
create policy "admins_manage_catalog_items"
on public.catalog_items
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "authenticated_read_workflow_step_templates" on public.workflow_step_templates;
create policy "authenticated_read_workflow_step_templates"
on public.workflow_step_templates
for select
to authenticated
using (true);

drop policy if exists "admins_manage_workflow_step_templates" on public.workflow_step_templates;
create policy "admins_manage_workflow_step_templates"
on public.workflow_step_templates
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "authenticated_read_org_units" on public.org_units;
create policy "authenticated_read_org_units"
on public.org_units
for select
to authenticated
using (true);

drop policy if exists "admins_manage_org_units" on public.org_units;
create policy "admins_manage_org_units"
on public.org_units
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "authenticated_read_employee_profiles" on public.employee_profiles;
create policy "authenticated_read_employee_profiles"
on public.employee_profiles
for select
to authenticated
using (true);

drop policy if exists "admins_manage_employee_profiles" on public.employee_profiles;
create policy "admins_manage_employee_profiles"
on public.employee_profiles
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "authenticated_read_approvers" on public.approvers;
create policy "authenticated_read_approvers"
on public.approvers
for select
to authenticated
using (true);

drop policy if exists "admins_manage_approvers" on public.approvers;
create policy "admins_manage_approvers"
on public.approvers
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "users_read_own_roles_or_admin" on public.user_roles;
create policy "users_read_own_roles_or_admin"
on public.user_roles
for select
to authenticated
using (public.is_admin() or lower(email) = public.current_user_email());

drop policy if exists "admins_manage_user_roles" on public.user_roles;
create policy "admins_manage_user_roles"
on public.user_roles
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "request_access_select" on public.requests;
create policy "request_access_select"
on public.requests
for select
to authenticated
using (public.can_access_request(id));

drop policy if exists "request_insert_self_or_admin" on public.requests;
create policy "request_insert_self_or_admin"
on public.requests
for insert
to authenticated
with check (public.is_admin() or lower(requester_email) = public.current_user_email());

drop policy if exists "request_admin_update" on public.requests;
create policy "request_admin_update"
on public.requests
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "request_steps_select_by_request_access" on public.request_steps;
create policy "request_steps_select_by_request_access"
on public.request_steps
for select
to authenticated
using (public.can_access_request(request_id));

drop policy if exists "request_steps_admin_manage" on public.request_steps;
create policy "request_steps_admin_manage"
on public.request_steps
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "request_events_select_by_request_access" on public.request_events;
create policy "request_events_select_by_request_access"
on public.request_events
for select
to authenticated
using (public.can_access_request(request_id));

drop policy if exists "request_events_admin_manage" on public.request_events;
create policy "request_events_admin_manage"
on public.request_events
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
