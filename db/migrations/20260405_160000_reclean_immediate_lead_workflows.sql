-- SSD: limpieza defensiva de workflows legacy con IMMEDIATE_LEAD.
-- Esta migracion es idempotente y puede correrse multiples veces sin efectos secundarios.

delete from approvers
where upper(trim(role_code)) = 'IMMEDIATE_LEAD';

delete from workflow_step_templates
where upper(trim(code)) = 'IMMEDIATE_LEAD'
   or lower(trim(coalesce(routing, ''))) = 'requester_unit';

update request_types
set workflow = jsonb_set(
  coalesce(workflow, '{}'::jsonb),
  '{steps}',
  coalesce(
    (
      select jsonb_agg(step)
      from jsonb_array_elements(coalesce(request_types.workflow -> 'steps', '[]'::jsonb)) as step
      where upper(trim(coalesce(step ->> 'code', ''))) <> 'IMMEDIATE_LEAD'
        and lower(trim(coalesce(step ->> 'routing', ''))) <> 'requester_unit'
    ),
    '[]'::jsonb
  ),
  true
)
where exists (
  select 1
  from jsonb_array_elements(coalesce(request_types.workflow -> 'steps', '[]'::jsonb)) as step
  where upper(trim(coalesce(step ->> 'code', ''))) = 'IMMEDIATE_LEAD'
     or lower(trim(coalesce(step ->> 'routing', ''))) = 'requester_unit'
);

with fallback_step as (
  select
    code,
    label,
    kind,
    routing,
    scope
  from workflow_step_templates
  where active = true
    and upper(trim(code)) <> 'IMMEDIATE_LEAD'
    and lower(trim(coalesce(routing, ''))) <> 'requester_unit'
  order by
    case when upper(trim(code)) = 'AREA_MANAGER' then 0 else 1 end,
    sort_order asc,
    code asc
  limit 1
)
update request_types as request_type
set workflow = jsonb_build_object(
  'steps',
  jsonb_build_array(
    jsonb_build_object(
      'code', fallback_step.code,
      'label', fallback_step.label,
      'kind', fallback_step.kind,
      'routing', fallback_step.routing,
      'scope', fallback_step.scope
    )
  )
)
from fallback_step
where coalesce(jsonb_array_length(coalesce(request_type.workflow -> 'steps', '[]'::jsonb)), 0) = 0;

update request_types
set requires_general_management = exists (
  select 1
  from jsonb_array_elements(coalesce(request_types.workflow -> 'steps', '[]'::jsonb)) as step
  where upper(trim(coalesce(step ->> 'code', ''))) = 'GG_APPROVAL'
);
