insert into request_types (
  code,
  name,
  description,
  category,
  theme_color,
  fields,
  workflow,
  requires_general_management
)
values
(
  'PERSONNEL_REQUEST',
  'Solicitud de Personal',
  'Alta de posición, reemplazo, traslado o refuerzo temporal con validación de negocio y RRHH.',
  'Recursos Humanos',
  '#C4975A',
  '[
    {"name":"tipoSolicitud","label":"Tipo de solicitud","type":"dropdown","required":true,"options":[{"option":"Nueva posición"},{"option":"Reemplazo"},{"option":"Temporal"},{"option":"Cambio organizacional"}]},
    {"name":"fechaNecesaria","label":"Fecha requerida","type":"date","required":true},
    {"name":"salarioReferencial","label":"Salario referencial","type":"number","required":true,"placeholder":"Ej. 1800"},
    {"name":"justificacionRol","label":"Justificación del rol","type":"textarea","required":true,"placeholder":"Describe la necesidad del puesto"}
  ]'::jsonb,
  '{
    "steps":[
      {"code":"AREA_MANAGER","label":"Aprobación de Gerencia de Área","kind":"approval","routing":"department"},
      {"code":"HR_REVIEW","label":"Validación de Recursos Humanos","kind":"approval","routing":"scope","scope":"HR"},
      {"code":"GG_APPROVAL","label":"Autorización de Gerencia General","kind":"approval","routing":"scope","scope":"GG"}
    ]
  }'::jsonb,
  true
),
(
  'VACATION_REQUEST',
  'Solicitud de Vacaciones y Permisos',
  'Vacaciones y permisos con calculo automatico de dias y registro en RRHH.',
  'Recursos Humanos',
  '#7BA47C',
  '[
    {"name":"colaborador","label":"Colaborador","type":"text","required":true,"placeholder":"Nombre del colaborador que tomara la ausencia"},
    {"name":"tipoAusencia","label":"Tipo de ausencia","type":"dropdown","required":true,"options":[{"option":"Vacaciones"},{"option":"Permiso personal"},{"option":"Permiso medico"},{"option":"Permiso administrativo"}]},
    {"name":"fechaInicio","label":"Fecha de inicio","type":"date","required":true},
    {"name":"fechaFin","label":"Fecha de fin","type":"date","required":true}
  ]'::jsonb,
  '{
    "steps":[
      {"code":"AREA_MANAGER","label":"Aprobación de Gerencia de Área","kind":"approval","routing":"department"},
      {"code":"HR_REVIEW","label":"Registro y validación RRHH","kind":"approval","routing":"scope","scope":"HR"}
    ]
  }'::jsonb,
  false
),
(
  'TERMINATION_REQUEST',
  'Solicitud de Desvinculación',
  'Proceso formal de salida con controles de RRHH, gerencia general y offboarding tecnológico.',
  'Recursos Humanos',
  '#A95E5E',
  '[
    {"name":"colaborador","label":"Colaborador a desvincular","type":"text","required":true},
    {"name":"fechaSalida","label":"Fecha efectiva de salida","type":"date","required":true},
    {"name":"tipoSalida","label":"Tipo de salida","type":"dropdown","required":true,"options":[{"option":"Renuncia"},{"option":"Despido"},{"option":"Mutuo acuerdo"}]},
    {"name":"motivo","label":"Motivo / contexto","type":"textarea","required":true}
  ]'::jsonb,
  '{
    "steps":[
      {"code":"AREA_MANAGER","label":"Aprobación de Gerencia de Área","kind":"approval","routing":"department"},
      {"code":"HR_REVIEW","label":"Validación legal y laboral RRHH","kind":"approval","routing":"scope","scope":"HR"},
      {"code":"GG_APPROVAL","label":"Autorización de Gerencia General","kind":"approval","routing":"scope","scope":"GG"},
      {"code":"IT_OFFBOARDING","label":"Ejecución de offboarding TI","kind":"fulfillment","routing":"scope","scope":"IT"}
    ]
  }'::jsonb,
  true
),
(
  'LOCAL_PURCHASE',
  'Solicitud de Compras Locales',
  'Compras operativas y administrativas con revisión financiera y aprobación ejecutiva.',
  'Compras',
  '#5E7EA9',
  '[
    {"name":"proveedorSugerido","label":"Proveedor sugerido","type":"text","required":true},
    {"name":"montoEstimado","label":"Monto estimado","type":"number","required":true},
    {"name":"urgencia","label":"Urgencia","type":"radio","required":true,"options":[{"option":"Baja"},{"option":"Media"},{"option":"Alta"}]},
    {"name":"detalleCompra","label":"Detalle de compra","type":"textarea","required":true}
  ]'::jsonb,
  '{
    "steps":[
      {"code":"AREA_MANAGER","label":"Aprobación de Gerencia de Área","kind":"approval","routing":"department"},
      {"code":"FINANCE_REVIEW","label":"Validación financiera","kind":"approval","routing":"scope","scope":"FINANCE"},
      {"code":"GG_APPROVAL","label":"Autorización de Gerencia General","kind":"approval","routing":"scope","scope":"GG"},
      {"code":"PROCUREMENT","label":"Gestión de compra","kind":"fulfillment","routing":"scope","scope":"PROCUREMENT"}
    ]
  }'::jsonb,
  true
),
(
  'IT_ASSET_REQUEST',
  'Solicitud de Equipos y Accesorios TI',
  'Compra o reposición de laptops, monitores, teclados, mouse, cámaras y otros periféricos.',
  'Tecnología',
  '#4F7B94',
  '[
    {"name":"tipoActivo","label":"Tipo de activo","type":"dropdown","required":true,"options":[{"option":"Laptop"},{"option":"Monitor"},{"option":"Teclado"},{"option":"Mouse"},{"option":"Cámara"},{"option":"Docking"},{"option":"Otro accesorio"}]},
    {"name":"beneficiarioActivo","label":"Beneficiario final","type":"text","required":true},
    {"name":"especificacion","label":"Especificación requerida","type":"textarea","required":true},
    {"name":"presupuestoEstimado","label":"Presupuesto estimado","type":"number","required":true}
  ]'::jsonb,
  '{
    "steps":[
      {"code":"AREA_MANAGER","label":"Aprobación de Gerencia de Área","kind":"approval","routing":"department"},
      {"code":"IT_REVIEW","label":"Validación técnica TI","kind":"approval","routing":"scope","scope":"IT"},
      {"code":"FINANCE_REVIEW","label":"Revisión presupuestaria","kind":"approval","routing":"scope","scope":"FINANCE"},
      {"code":"GG_APPROVAL","label":"Autorización de Gerencia General","kind":"approval","routing":"scope","scope":"GG"},
      {"code":"IT_DELIVERY","label":"Compra, configuración y entrega TI","kind":"fulfillment","routing":"scope","scope":"IT"}
    ]
  }'::jsonb,
  true
),
(
  'MOBILE_LINE_REQUEST',
  'Solicitud de Línea Nueva Celular',
  'Flujo corporativo de telefonía con aprobación de gerencia, GG y entrega de TI.',
  'Tecnología',
  '#1F4F73',
  '[
    {"name":"beneficiario","label":"Beneficiario(s) de la línea","type":"textarea","required":true,"placeholder":"Escribe uno o varios beneficiarios. Puedes separarlos por línea, coma o punto y coma."},
    {"name":"motivoNegocio","label":"Motivo del requerimiento","type":"textarea","required":true,"placeholder":"Describe el motivo operativo o comercial"},
    {"name":"planSugerido","label":"Plan sugerido","type":"dropdown","required":true,"options":[{"option":"$12"},{"option":"$15"},{"option":"$20"},{"option":"$25"},{"option":"$35"},{"option":"$40"},{"option":"$55"},{"option":"$75"}]},
    {"name":"requiereEquipo","label":"Entrega de equipo físico","type":"radio","required":true,"options":[{"option":"Solo línea (SIM)"},{"option":"Sí, equipo + línea"}]}
  ]'::jsonb,
  '{
    "steps":[
      {"code":"AREA_MANAGER","label":"Aprobación de Gerencia de Área","kind":"approval","routing":"department"},
      {"code":"GG_APPROVAL","label":"Autorización de Gerencia General","kind":"approval","routing":"scope","scope":"GG"},
      {"code":"IT_DELIVERY","label":"Carta responsiva y entrega TI","kind":"fulfillment","routing":"scope","scope":"IT"}
    ]
  }'::jsonb,
  true
)
on conflict (code) do nothing;

insert into approvers (department, scope, role_code, full_name, email, title, assignment_role, sort_order)
select
  source.department,
  source.scope,
  source.role_code,
  source.full_name,
  source.email,
  source.title,
  source.assignment_role,
  source.sort_order
from (
  values
    ('Finanzas / Contabilidad', 'AREA', 'AREA_MANAGER', 'Roberto Castillero', 'roberto.castillero@pffsa.com', 'Gerente de Finanzas y Contabilidad', 'PRIMARY', 10),
    ('Operaciones', 'AREA', 'AREA_MANAGER', 'Jar Ho', 'jar.ho@pffsa.com', 'Gerente de Operaciones', 'PRIMARY', 10),
    ('Ventas / Mercadeo', 'AREA', 'AREA_MANAGER', 'Angela Zambrano', 'angela.zambrano@pffsa.com', 'Gerencia de Ventas y Mercadeo', 'PRIMARY', 10),
    ('Proyectos / IT', 'AREA', 'AREA_MANAGER', 'Gabriela Santos', 'gabriela.santos@pffsa.com', 'Gerente de Proyectos / IT', 'PRIMARY', 10),
    ('Recursos Humanos', 'AREA', 'AREA_MANAGER', 'Sandra Martin', 'sandra.martin@pffsa.com', 'Gerente de RRHH', 'PRIMARY', 10),
    ('Gerencia General', 'AREA', 'AREA_MANAGER', 'Sandra Martin', 'sandra.martin+gg@pffsa.com', 'Coordinacion Ejecutiva', 'PRIMARY', 10),
    ('Food Service', 'AREA', 'AREA_MANAGER', 'Susana Gomez', 'susana.gomez@pffsa.com', 'Gerente Food Service', 'PRIMARY', 10),
    ('Retail', 'AREA', 'AREA_MANAGER', 'Angela Zambrano', 'angela.zambrano@pffsa.com', 'Gerente Retail', 'PRIMARY', 10),
    (null, 'GG', 'GG_APPROVAL', 'Peter Pedersen', 'peter.pedersen@pffsa.com', 'Gerente General', 'PRIMARY', 10),
    (null, 'HR', 'HR_REVIEW', 'Sandra Martin', 'sandra.martin.hr@pffsa.com', 'Directora de Recursos Humanos', 'PRIMARY', 10),
    (null, 'FINANCE', 'FINANCE_REVIEW', 'Roberto Castillero', 'roberto.castillero.finance@pffsa.com', 'Director Financiero', 'PRIMARY', 10),
    (null, 'IT', 'IT_REVIEW', 'Angela Zambrano', 'angela.zambrano.it@pffsa.com', 'Directora de Tecnologia', 'PRIMARY', 10),
    (null, 'IT', 'IT_OFFBOARDING', 'Mesa de Ayuda IT', 'mesadeayuda@pffsa.com', 'Soporte y Baja TI', 'PRIMARY', 15),
    (null, 'IT', 'IT_DELIVERY', 'Mesa de Ayuda IT', 'mesadeayuda@pffsa.com', 'Soporte y Entrega TI', 'PRIMARY', 20),
    (null, 'PROCUREMENT', 'PROCUREMENT', 'Compras Corporativas', 'compras@pffsa.com', 'Compras Locales', 'PRIMARY', 10)
) as source(department, scope, role_code, full_name, email, title, assignment_role, sort_order)
on conflict do nothing;

insert into admin_users (full_name, email, created_by_email)
values
('Weelmer Moreno', 'weelmer.moreno@pffsa.com', 'system@ssd.local')
on conflict (email) do nothing;

insert into catalog_items (catalog_key, item_label, item_value, sort_order)
values
('DEPARTMENT', 'Finanzas / Contabilidad', 'Finanzas / Contabilidad', 10),
('DEPARTMENT', 'Operaciones', 'Operaciones', 20),
('DEPARTMENT', 'Ventas / Mercadeo', 'Ventas / Mercadeo', 30),
('DEPARTMENT', 'Proyectos / IT', 'Proyectos / IT', 40),
('DEPARTMENT', 'Recursos Humanos', 'Recursos Humanos', 50),
('DEPARTMENT', 'Gerencia General', 'Gerencia General', 60),
('DEPARTMENT', 'Food Service', 'Food Service', 70),
('DEPARTMENT', 'Retail', 'Retail', 80),
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

insert into workflow_step_templates (code, label, description, kind, routing, scope, sort_order, active)
values
('AREA_MANAGER', 'Aprobacion de Gerencia de Area', 'Deriva la solicitud al responsable del departamento seleccionado.', 'approval', 'department', null, 10, true),
('HR_REVIEW', 'Revision y validacion RRHH', 'Validacion laboral, documental y de politica interna.', 'approval', 'scope', 'HR', 20, true),
('FINANCE_REVIEW', 'Revision presupuestaria', 'Control financiero y disponibilidad presupuestaria.', 'approval', 'scope', 'FINANCE', 30, true),
('IT_REVIEW', 'Validacion tecnica TI', 'Revisa viabilidad tecnica, estandar y soporte.', 'approval', 'scope', 'IT', 40, true),
('GG_APPROVAL', 'Autorizacion de Gerencia General', 'Autorizacion ejecutiva final.', 'approval', 'scope', 'GG', 50, true),
('IT_OFFBOARDING', 'Ejecucion de offboarding TI', 'Baja de accesos, resguardo de activos y cierre tecnico.', 'fulfillment', 'scope', 'IT', 60, true),
('PROCUREMENT', 'Gestion de compras locales', 'Ejecucion operativa de compra y coordinacion con proveedor.', 'fulfillment', 'scope', 'PROCUREMENT', 65, true),
('IT_DELIVERY', 'Ejecucion y entrega TI', 'Configuracion, carta responsiva y entrega final.', 'fulfillment', 'scope', 'IT', 70, true)
on conflict (code) do update
set label = excluded.label,
    description = excluded.description,
    kind = excluded.kind,
    routing = excluded.routing,
    scope = excluded.scope,
    sort_order = excluded.sort_order,
    active = excluded.active;

insert into requests (
  request_type_id,
  ticket_code,
  status,
  requester_name,
  requester_email,
  department,
  beneficiary_name,
  subject,
  justification,
  payload
)
select
  rt.id,
  'SSD-2026-00001',
  'pending_general_management',
  'Nineth Ramos',
  'nineth.ramos@pffsa.com',
  'Ventas / Mercadeo',
  'Janeth Valencia',
  'Linea de celular demostradora',
  'La demostradora requiere disponibilidad permanente para coordinar con clientes y supervisores.',
  '{
    "beneficiario":"Janeth Valencia",
    "motivoNegocio":"Cobertura comercial y coordinación con tienda",
    "planSugerido":"$25",
    "requiereEquipo":"Sí, equipo + línea",
    "origen":"ssd"
  }'::jsonb
from request_types rt
where rt.code = 'MOBILE_LINE_REQUEST'
on conflict (ticket_code) do nothing;

insert into request_steps (
  request_id,
  sequence,
  role_code,
  label,
  kind,
  approver_name,
  approver_email,
  department,
  status,
  decision,
  comments,
  acted_at,
  metadata
)
select
  r.id,
  1,
  'AREA_MANAGER',
  'Aprobación de Gerencia de Área',
  'approval',
  'Angela Zambrano',
  'angela.zambrano@pffsa.com',
  'Ventas / Mercadeo',
  'approved',
  'approve',
  'Se aprueba plan comercial recomendado.',
  now() - interval '1 day',
  '{"scope":"AREA","title":"Gerencia de Ventas y Mercadeo"}'::jsonb
from requests r
where r.ticket_code = 'SSD-2026-00001'
on conflict do nothing;

insert into request_steps (
  request_id,
  sequence,
  role_code,
  label,
  kind,
  approver_name,
  approver_email,
  department,
  status,
  metadata
)
select
  r.id,
  2,
  'GG_APPROVAL',
  'Autorización de Gerencia General',
  'approval',
  'Peter Pedersen',
  'peter.pedersen@pffsa.com',
  null,
  'pending',
  '{"scope":"GG","title":"Gerente General"}'::jsonb
from requests r
where r.ticket_code = 'SSD-2026-00001'
on conflict do nothing;

insert into request_steps (
  request_id,
  sequence,
  role_code,
  label,
  kind,
  approver_name,
  approver_email,
  department,
  status,
  metadata
)
select
  r.id,
  3,
  'IT_DELIVERY',
  'Carta responsiva y entrega TI',
  'fulfillment',
  'Mesa de Ayuda IT',
  'mesadeayuda@pffsa.com',
  null,
  'queued',
  '{"scope":"IT","title":"Soporte y Entrega TI"}'::jsonb
from requests r
where r.ticket_code = 'SSD-2026-00001'
on conflict do nothing;

insert into request_events (
  request_id,
  event_type,
  actor_name,
  actor_email,
  notes,
  payload
)
select
  r.id,
  'REQUEST_IMPORTED',
  'Sistema',
  'noreply@ssd.local',
  'Caso inicial de telefonia cargado como referencia operativa del SSD.',
  '{"source":"ssd","legacyTicket":"747"}'::jsonb
from requests r
where r.ticket_code = 'SSD-2026-00001'
on conflict do nothing;

