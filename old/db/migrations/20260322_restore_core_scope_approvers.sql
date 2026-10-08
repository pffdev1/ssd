insert into approvers (department, org_unit_id, scope, role_code, full_name, email, title, assignment_role, sort_order)
select null, null, 'GG', 'GG_APPROVAL', 'Peter Pedersen', 'peter.pedersen@pffsa.com', 'Gerente General', 'PRIMARY', 10
where not exists (
  select 1
  from approvers
  where scope = 'GG'
    and role_code = 'GG_APPROVAL'
);

insert into approvers (department, org_unit_id, scope, role_code, full_name, email, title, assignment_role, sort_order)
select null, null, 'HR', 'HR_REVIEW', 'Yeraida Gallardo', 'yeraida.gallardo@pffsa.com', 'Asistente de Recursos Humanos', 'PRIMARY', 10
where not exists (
  select 1
  from approvers
  where scope = 'HR'
    and role_code = 'HR_REVIEW'
);

insert into approvers (department, org_unit_id, scope, role_code, full_name, email, title, assignment_role, sort_order)
select null, null, 'FINANCE', 'FINANCE_REVIEW', 'Roberto Castillero', 'roberto.castillero.finance@pffsa.com', 'Director Financiero', 'PRIMARY', 10
where not exists (
  select 1
  from approvers
  where scope = 'FINANCE'
    and role_code = 'FINANCE_REVIEW'
);

insert into approvers (department, org_unit_id, scope, role_code, full_name, email, title, assignment_role, sort_order)
select null, null, 'IT', 'IT_REVIEW', 'Angela Zambrano', 'angela.zambrano.it@pffsa.com', 'Directora de Tecnologia', 'PRIMARY', 10
where not exists (
  select 1
  from approvers
  where scope = 'IT'
    and role_code = 'IT_REVIEW'
);

insert into approvers (department, org_unit_id, scope, role_code, full_name, email, title, assignment_role, sort_order)
select null, null, 'IT', 'IT_OFFBOARDING', 'Mesa de Ayuda IT', 'mesadeayuda@pffsa.com', 'Soporte y Baja TI', 'PRIMARY', 15
where not exists (
  select 1
  from approvers
  where scope = 'IT'
    and role_code = 'IT_OFFBOARDING'
);

insert into approvers (department, org_unit_id, scope, role_code, full_name, email, title, assignment_role, sort_order)
select null, null, 'IT', 'IT_DELIVERY', 'Mesa de Ayuda IT', 'mesadeayuda@pffsa.com', 'Soporte y Entrega TI', 'PRIMARY', 20
where not exists (
  select 1
  from approvers
  where scope = 'IT'
    and role_code = 'IT_DELIVERY'
);

insert into approvers (department, org_unit_id, scope, role_code, full_name, email, title, assignment_role, sort_order)
select null, null, 'PROCUREMENT', 'PROCUREMENT', 'Saul Santamaria', 'saul.santamaria@pffsa.com', 'Gerente de Compras e Importaciones', 'PRIMARY', 10
where not exists (
  select 1
  from approvers
  where scope = 'PROCUREMENT'
    and role_code = 'PROCUREMENT'
);
