insert into workflow_step_templates (code, label, description, kind, routing, scope, sort_order, active)
values
  ('IT_OFFBOARDING', 'Ejecucion de offboarding TI', 'Baja de accesos, resguardo de activos y cierre tecnico.', 'fulfillment', 'scope', 'IT', 60, true)
on conflict (code) do update
set label = excluded.label,
    description = excluded.description,
    kind = excluded.kind,
    routing = excluded.routing,
    scope = excluded.scope,
    sort_order = excluded.sort_order,
    active = excluded.active;

insert into approvers (department, org_unit_id, scope, role_code, full_name, email, title, assignment_role, sort_order)
select
  source.department,
  source.org_unit_id,
  'ORG_UNIT',
  'IMMEDIATE_LEAD',
  source.full_name,
  source.email,
  source.title,
  source.assignment_role,
  source.sort_order
from approvers source
where source.role_code = 'APROBACI_N_DE_JEFE_DE_AREA'
on conflict ((coalesce(department, '')), scope, role_code, lower(email)) do update
set full_name = excluded.full_name,
    title = excluded.title,
    org_unit_id = coalesce(excluded.org_unit_id, approvers.org_unit_id),
    assignment_role = excluded.assignment_role,
    sort_order = least(approvers.sort_order, excluded.sort_order);

delete from approvers
where role_code = 'APROBACI_N_DE_JEFE_DE_AREA';

insert into approvers (department, org_unit_id, scope, role_code, full_name, email, title, assignment_role, sort_order)
select
  null,
  null,
  'HR',
  'HR_REVIEW',
  source.full_name,
  source.email,
  source.title,
  source.assignment_role,
  source.sort_order
from approvers source
where source.role_code = 'APROBACI_N_DE_RECURSOS_HUMANOS'
on conflict ((coalesce(department, '')), scope, role_code, lower(email)) do update
set full_name = excluded.full_name,
    title = excluded.title,
    assignment_role = excluded.assignment_role,
    sort_order = least(approvers.sort_order, excluded.sort_order);

delete from approvers
where role_code = 'APROBACI_N_DE_RECURSOS_HUMANOS';

insert into approvers (department, org_unit_id, scope, role_code, full_name, email, title, assignment_role, sort_order)
select
  null,
  null,
  'IT',
  'IT_OFFBOARDING',
  source.full_name,
  source.email,
  case when source.title = 'Soporte y Entrega TI' then 'Soporte y Baja TI' else source.title end,
  source.assignment_role,
  case when source.sort_order < 15 then 15 else source.sort_order end
from approvers source
where source.scope = 'IT'
  and source.role_code = 'IT_DELIVERY'
on conflict ((coalesce(department, '')), scope, role_code, lower(email)) do update
set full_name = excluded.full_name,
    title = excluded.title,
    assignment_role = excluded.assignment_role,
    sort_order = least(approvers.sort_order, excluded.sort_order);

update workflow_step_templates
set active = false
where code in ('APROBACI_N_DE_JEFE_DE_AREA', 'APROBACI_N_DE_RECURSOS_HUMANOS');

update request_types
set workflow = '{
  "steps": [
    {"code":"IMMEDIATE_LEAD","label":"Aprobacion de Jefatura Inmediata","kind":"approval","routing":"requester_unit"},
    {"code":"AREA_MANAGER","label":"Aprobacion de Gerencia de Area","kind":"approval","routing":"department"},
    {"code":"HR_REVIEW","label":"Revision y validacion RRHH","kind":"approval","routing":"scope","scope":"HR"},
    {"code":"GG_APPROVAL","label":"Autorizacion de Gerencia General","kind":"approval","routing":"scope","scope":"GG"}
  ]
}'::jsonb,
    requires_general_management = true
where code = 'PERSONNEL_REQUEST';

update request_types
set workflow = '{
  "steps": [
    {"code":"IMMEDIATE_LEAD","label":"Aprobacion de Jefatura Inmediata","kind":"approval","routing":"requester_unit"},
    {"code":"AREA_MANAGER","label":"Aprobacion de Gerencia de Area","kind":"approval","routing":"department"},
    {"code":"HR_REVIEW","label":"Revision y validacion RRHH","kind":"approval","routing":"scope","scope":"HR"}
  ]
}'::jsonb,
    requires_general_management = false
where code = 'VACATION_REQUEST';

update request_types
set workflow = '{
  "steps": [
    {"code":"IMMEDIATE_LEAD","label":"Aprobacion de Jefatura Inmediata","kind":"approval","routing":"requester_unit"},
    {"code":"AREA_MANAGER","label":"Aprobacion de Gerencia de Area","kind":"approval","routing":"department"},
    {"code":"HR_REVIEW","label":"Revision y validacion RRHH","kind":"approval","routing":"scope","scope":"HR"},
    {"code":"GG_APPROVAL","label":"Autorizacion de Gerencia General","kind":"approval","routing":"scope","scope":"GG"},
    {"code":"IT_OFFBOARDING","label":"Ejecucion de offboarding TI","kind":"fulfillment","routing":"scope","scope":"IT"}
  ]
}'::jsonb,
    requires_general_management = true
where code = 'TERMINATION_REQUEST';

update request_types
set workflow = '{
  "steps": [
    {"code":"IMMEDIATE_LEAD","label":"Aprobacion de Jefatura Inmediata","kind":"approval","routing":"requester_unit"},
    {"code":"AREA_MANAGER","label":"Aprobacion de Gerencia de Area","kind":"approval","routing":"department"},
    {"code":"FINANCE_REVIEW","label":"Revision presupuestaria","kind":"approval","routing":"scope","scope":"FINANCE"},
    {"code":"GG_APPROVAL","label":"Autorizacion de Gerencia General","kind":"approval","routing":"scope","scope":"GG"},
    {"code":"PROCUREMENT","label":"Gestion de compras locales","kind":"fulfillment","routing":"scope","scope":"PROCUREMENT"}
  ]
}'::jsonb,
    requires_general_management = true
where code = 'LOCAL_PURCHASE';

update request_types
set workflow = '{
  "steps": [
    {"code":"IMMEDIATE_LEAD","label":"Aprobacion de Jefatura Inmediata","kind":"approval","routing":"requester_unit"},
    {"code":"AREA_MANAGER","label":"Aprobacion de Gerencia de Area","kind":"approval","routing":"department"},
    {"code":"IT_REVIEW","label":"Validacion tecnica TI","kind":"approval","routing":"scope","scope":"IT"},
    {"code":"FINANCE_REVIEW","label":"Revision presupuestaria","kind":"approval","routing":"scope","scope":"FINANCE"},
    {"code":"GG_APPROVAL","label":"Autorizacion de Gerencia General","kind":"approval","routing":"scope","scope":"GG"},
    {"code":"IT_DELIVERY","label":"Ejecucion y entrega TI","kind":"fulfillment","routing":"scope","scope":"IT"}
  ]
}'::jsonb,
    requires_general_management = true
where code = 'IT_ASSET_REQUEST';

update request_types
set workflow = '{
  "steps": [
    {"code":"IMMEDIATE_LEAD","label":"Aprobacion de Jefatura Inmediata","kind":"approval","routing":"requester_unit"},
    {"code":"AREA_MANAGER","label":"Aprobacion de Gerencia de Area","kind":"approval","routing":"department"},
    {"code":"GG_APPROVAL","label":"Autorizacion de Gerencia General","kind":"approval","routing":"scope","scope":"GG"},
    {"code":"IT_DELIVERY","label":"Carta responsiva y entrega TI","kind":"fulfillment","routing":"scope","scope":"IT"}
  ]
}'::jsonb,
    requires_general_management = true
where code = 'MOBILE_LINE_REQUEST';
