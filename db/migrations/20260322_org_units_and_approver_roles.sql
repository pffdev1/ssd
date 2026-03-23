create table if not exists org_units (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  unit_type text not null,
  parent_id uuid references org_units(id) on delete set null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table approvers add column if not exists org_unit_id uuid references org_units(id) on delete set null;
alter table approvers add column if not exists assignment_role text not null default 'PRIMARY';

create index if not exists idx_org_units_parent on org_units(parent_id, sort_order);
create index if not exists idx_approvers_org_unit on approvers(org_unit_id, assignment_role, sort_order);

insert into org_units (name, unit_type, parent_id, sort_order, active)
values ('Pedersen Fine Foods', 'company', null, 10, true)
on conflict (name) do update
set unit_type = excluded.unit_type,
    parent_id = excluded.parent_id,
    sort_order = excluded.sort_order,
    active = excluded.active;

insert into org_units (name, unit_type, parent_id, sort_order, active)
select 'Corporativo', 'division', root.id, 10, true
from org_units root
where root.name = 'Pedersen Fine Foods'
on conflict (name) do update
set unit_type = excluded.unit_type,
    parent_id = excluded.parent_id,
    sort_order = excluded.sort_order,
    active = excluded.active;

insert into org_units (name, unit_type, parent_id, sort_order, active)
select 'Comercial y Operacion', 'division', root.id, 20, true
from org_units root
where root.name = 'Pedersen Fine Foods'
on conflict (name) do update
set unit_type = excluded.unit_type,
    parent_id = excluded.parent_id,
    sort_order = excluded.sort_order,
    active = excluded.active;

insert into org_units (name, unit_type, parent_id, sort_order, active)
select branch.name, branch.unit_type, parent.id, branch.sort_order, true
from (
  values
    ('Gerencia General', 'gerencia', 'Pedersen Fine Foods', 10),
    ('Finanzas / Contabilidad', 'departamento', 'Corporativo', 20),
    ('Recursos Humanos', 'departamento', 'Corporativo', 30),
    ('Proyectos / IT', 'departamento', 'Corporativo', 40),
    ('Operaciones', 'departamento', 'Comercial y Operacion', 50),
    ('Ventas / Mercadeo', 'departamento', 'Comercial y Operacion', 60),
    ('Food Service', 'departamento', 'Comercial y Operacion', 70),
    ('Retail', 'departamento', 'Comercial y Operacion', 80)
) as branch(name, unit_type, parent_name, sort_order)
inner join org_units parent on parent.name = branch.parent_name
on conflict (name) do update
set unit_type = excluded.unit_type,
    parent_id = excluded.parent_id,
    sort_order = excluded.sort_order,
    active = excluded.active;

update approvers
set org_unit_id = org.id
from org_units org
where approvers.department is not null
  and approvers.department = org.name
  and (approvers.org_unit_id is null or approvers.org_unit_id <> org.id);

update approvers
set assignment_role = 'PRIMARY'
where assignment_role is null or assignment_role = '';
