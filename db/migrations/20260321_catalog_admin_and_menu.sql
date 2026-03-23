create table if not exists catalog_items (
  id uuid primary key default gen_random_uuid(),
  catalog_key text not null,
  item_label text not null,
  item_value text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_catalog_items_unique on catalog_items(catalog_key, item_value);

insert into catalog_items (catalog_key, item_label, item_value, sort_order)
values
('IT_ASSET_TYPE', 'Laptop', 'Laptop', 10),
('IT_ASSET_TYPE', 'Monitor', 'Monitor', 20),
('IT_ASSET_TYPE', 'Teclado', 'Teclado', 30),
('IT_ASSET_TYPE', 'Mouse', 'Mouse', 40),
('IT_ASSET_TYPE', 'Camara', 'Camara', 50),
('IT_ASSET_TYPE', 'Docking', 'Docking', 60),
('IT_ASSET_TYPE', 'Otro accesorio', 'Otro accesorio', 70),
('MOBILE_PLAN', '$12', '$12', 10),
('MOBILE_PLAN', '$15', '$15', 20),
('MOBILE_PLAN', '$20', '$20', 30),
('MOBILE_PLAN', '$25', '$25', 40),
('MOBILE_PLAN', '$35', '$35', 50),
('MOBILE_PLAN', '$40', '$40', 60),
('MOBILE_PLAN', '$55', '$55', 70),
('MOBILE_PLAN', '$75', '$75', 80)
on conflict (catalog_key, item_value) do nothing;

update request_types
set
  name = 'Solicitud de Vacaciones y Permisos',
  description = 'Vacaciones y permisos con control de fechas, cobertura operativa y registro en RRHH.',
  fields = '[
    {"name":"tipoAusencia","label":"Tipo de ausencia","type":"dropdown","required":true,"options":[{"option":"Vacaciones"},{"option":"Permiso personal"},{"option":"Permiso medico"},{"option":"Permiso administrativo"}]},
    {"name":"fechaInicio","label":"Fecha de inicio","type":"date","required":true},
    {"name":"fechaFin","label":"Fecha de fin","type":"date","required":true},
    {"name":"diasSolicitados","label":"Dias solicitados","type":"number","required":true},
    {"name":"planCobertura","label":"Plan de cobertura","type":"textarea","required":true,"placeholder":"Indica como se cubriran las funciones durante la ausencia"}
  ]'::jsonb
where code = 'VACATION_REQUEST';
