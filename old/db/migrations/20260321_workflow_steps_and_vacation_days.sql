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

create index if not exists idx_workflow_step_templates_active on workflow_step_templates(active, sort_order);

insert into workflow_step_templates (code, label, description, kind, routing, scope, sort_order, active)
values
('AREA_MANAGER', 'Aprobacion de Gerencia de Area', 'Deriva la solicitud al responsable del departamento seleccionado.', 'approval', 'department', null, 10, true),
('HR_REVIEW', 'Revision y validacion RRHH', 'Validacion laboral, documental y de politica interna.', 'approval', 'scope', 'HR', 20, true),
('FINANCE_REVIEW', 'Revision presupuestaria', 'Control financiero y disponibilidad presupuestaria.', 'approval', 'scope', 'FINANCE', 30, true),
('IT_REVIEW', 'Validacion tecnica TI', 'Revisa viabilidad tecnica, estandar y soporte.', 'approval', 'scope', 'IT', 40, true),
('GG_APPROVAL', 'Autorizacion de Gerencia General', 'Autorizacion ejecutiva final.', 'approval', 'scope', 'GG', 50, true),
('PROCUREMENT', 'Gestion de compras locales', 'Ejecucion operativa de compra y coordinacion con proveedor.', 'fulfillment', 'scope', 'PROCUREMENT', 60, true),
('IT_DELIVERY', 'Ejecucion y entrega TI', 'Configuracion, carta responsiva y entrega final.', 'fulfillment', 'scope', 'IT', 70, true)
on conflict (code) do update
set label = excluded.label,
    description = excluded.description,
    kind = excluded.kind,
    routing = excluded.routing,
    scope = excluded.scope,
    sort_order = excluded.sort_order,
    active = excluded.active;

update request_types
set
  description = 'Vacaciones y permisos con calculo automatico de dias y registro en RRHH.',
  fields = '[
    {"name":"colaborador","label":"Colaborador","type":"text","required":true,"placeholder":"Nombre del colaborador que tomara la ausencia"},
    {"name":"tipoAusencia","label":"Tipo de ausencia","type":"dropdown","required":true,"options":[{"option":"Vacaciones"},{"option":"Permiso personal"},{"option":"Permiso medico"},{"option":"Permiso administrativo"}]},
    {"name":"fechaInicio","label":"Fecha de inicio","type":"date","required":true},
    {"name":"fechaFin","label":"Fecha de fin","type":"date","required":true}
  ]'::jsonb
where code = 'VACATION_REQUEST';
