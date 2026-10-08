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

create index if not exists idx_employee_profiles_org_unit on employee_profiles(org_unit_id, sort_order, full_name);
create unique index if not exists idx_employee_profiles_email_unique on employee_profiles(lower(email)) where email is not null;

insert into workflow_step_templates (code, label, description, kind, routing, scope, sort_order, active)
values
('IMMEDIATE_LEAD', 'Aprobacion de Jefatura Inmediata', 'Deriva la solicitud al responsable principal de la unidad del solicitante.', 'approval', 'requester_unit', null, 5, true)
on conflict (code) do update
set label = excluded.label,
    description = excluded.description,
    kind = excluded.kind,
    routing = excluded.routing,
    scope = excluded.scope,
    sort_order = excluded.sort_order,
    active = excluded.active;

with prepared as (
  select
    request_types.id,
    (
      select jsonb_agg(step_item order by ord)
      from (
        select
          0 as ord,
          jsonb_build_object(
            'code', 'IMMEDIATE_LEAD',
            'label', 'Aprobacion de Jefatura Inmediata',
            'kind', 'approval',
            'routing', 'requester_unit'
          ) as step_item
        union all
        select
          row_number() over () as ord,
          existing.step as step_item
        from jsonb_array_elements(coalesce(request_types.workflow -> 'steps', '[]'::jsonb)) as existing(step)
      ) ordered_steps
    ) as next_steps
  from request_types
  where exists (
      select 1
      from jsonb_array_elements(coalesce(request_types.workflow -> 'steps', '[]'::jsonb)) as current_steps(step)
      where current_steps.step ->> 'code' = 'AREA_MANAGER'
    )
    and not exists (
      select 1
      from jsonb_array_elements(coalesce(request_types.workflow -> 'steps', '[]'::jsonb)) as current_steps(step)
      where current_steps.step ->> 'code' = 'IMMEDIATE_LEAD'
    )
)
update request_types
set workflow = jsonb_set(request_types.workflow, '{steps}', prepared.next_steps)
from prepared
where prepared.id = request_types.id;
