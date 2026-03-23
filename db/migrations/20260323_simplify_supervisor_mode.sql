update workflow_step_templates
set description = 'Deriva la solicitud al supervisor o jefatura principal del departamento seleccionado.'
where code = 'IMMEDIATE_LEAD';

update approvers
set scope = 'ORG_UNIT'
where role_code = 'IMMEDIATE_LEAD'
  and scope <> 'ORG_UNIT';

update approvers as approver
set department = unit.name
from org_units as unit
where approver.role_code = 'IMMEDIATE_LEAD'
  and approver.org_unit_id = unit.id
  and approver.department is null;
