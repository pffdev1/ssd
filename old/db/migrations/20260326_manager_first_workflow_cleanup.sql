-- SSD: modo manager-first
-- 1) El paso de jefatura inmediata se resuelve siempre desde Microsoft Entra (no desde workflow configurable).
-- 2) Se limpian referencias legacy IMMEDIATE_LEAD / requester_unit en plantillas y workflows.

delete from approvers
where role_code = 'IMMEDIATE_LEAD';

delete from workflow_step_templates
where code = 'IMMEDIATE_LEAD'
   or routing = 'requester_unit';

update request_types
set workflow = jsonb_build_object(
  'steps',
  coalesce(
    (
      select jsonb_agg(step)
      from jsonb_array_elements(coalesce(request_types.workflow -> 'steps', '[]'::jsonb)) as step
      where coalesce(step ->> 'code', '') <> 'IMMEDIATE_LEAD'
        and coalesce(step ->> 'routing', '') <> 'requester_unit'
    ),
    '[]'::jsonb
  )
)
where exists (
  select 1
  from jsonb_array_elements(coalesce(request_types.workflow -> 'steps', '[]'::jsonb)) as step
  where coalesce(step ->> 'code', '') = 'IMMEDIATE_LEAD'
     or coalesce(step ->> 'routing', '') = 'requester_unit'
);

update request_types
set requires_general_management = exists (
  select 1
  from jsonb_array_elements(coalesce(request_types.workflow -> 'steps', '[]'::jsonb)) as step
  where step ->> 'code' = 'GG_APPROVAL'
);

update request_types
set workflow = '{
  "steps":[
    {"code":"AREA_MANAGER","label":"Aprobacion de Gerencia de Area","kind":"approval","routing":"department"}
  ]
}'::jsonb
where coalesce(jsonb_array_length(workflow -> 'steps'), 0) = 0;

drop index if exists idx_approvers_org_unit;
alter table approvers drop column if exists org_unit_id;

drop table if exists employee_profiles cascade;
drop table if exists org_units cascade;
