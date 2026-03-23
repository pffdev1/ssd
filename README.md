# SSD | Sistema de Solicitudes Digital

Portal corporativo para centralizar solicitudes de:
- Personal
- Vacaciones
- Desvinculacion
- Compras locales
- Equipos y accesorios TI
- Linea nueva celular

## Stack
- Frontend: Next.js + TypeScript + Tailwind CSS
- Backend: Node.js + Express + TypeScript
- Base de datos: PostgreSQL
- Orquestacion: Docker Compose
- Identidad: Microsoft Entra ID

## Arquitectura objetivo
- Frontend en `Vercel`
- Auth en `Supabase Auth` con `Microsoft Entra`
- Base de datos en `Supabase Postgres`
- Seguridad con `RLS`
- Archivos en `Supabase Storage`
- Automatizaciones en `Supabase Edge Functions`

## Que incluye esta version
- Login corporativo con Microsoft Entra ID.
- Captura automatica del solicitante desde la sesion autenticada.
- Bandeja de aprobaciones para responsables segun su correo corporativo.
- Rol admin persistente en base de datos para agregar mas administradores.
- Catalogo configurable de tipos de solicitud desde PostgreSQL.
- Motor de flujo por pasos con aprobadores por departamento o por rol corporativo.
- Dashboard ejecutivo con metricas, solicitudes recientes y embudo de aprobacion.
- Formulario dinamico que cambia segun el tipo de solicitud seleccionado.
- Trazabilidad por solicitud con pasos, estado y eventos.
- Notificaciones por correo y Teams desde el backend.
- Flujo de telefonia modelado como proceso corporativo del SSD.

## Flujo inicial de linea celular
1. Gerencia de area aprueba segun el departamento.
2. Gerencia General autoriza.
3. TI ejecuta entrega, carta responsiva y cierre operativo.

## Estructura
- `frontend`: portal visual corporativo.
- `backend`: API Express, notificaciones y motor de flujo.
- `db/init`: esquema y datos semilla.
- `docs`: notas de arquitectura.

## Arranque local
```bash
docker compose up --build
```

Servicios:
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:4000`
- PostgreSQL: `localhost:5432`

## Variables principales
Tomar como base el archivo `.env.example`.

Credenciales Microsoft Entra:
- `AUTH_MICROSOFT_ENTRA_ID_ID`
- `AUTH_MICROSOFT_ENTRA_ID_SECRET`
- `AUTH_MICROSOFT_ENTRA_ID_TENANT_ID`
- `AUTH_SECRET`

Notificaciones:
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `TEAMS_WEBHOOK_URL`
- `TEAMS_CHANNEL_LABEL`

## Administradores
- Los admins viven en la tabla `admin_users`.
- Un administrador puede agregar mas administradores desde la interfaz `/admin`.

## Migracion recomendada
La ruta recomendada ahora es:
- `Vercel` para el frontend
- `Supabase` para DB, Auth, Storage y Edge Functions

Guia detallada:
- `docs/supabase-vercel-migration.md`

## Proximos pasos sugeridos
- Aplicar la migracion SQL de `supabase/migrations`.
- Configurar Microsoft Entra en Supabase Auth.
- Cargar seed funcional de SSD dentro de Supabase.
- Mover aprobaciones y notificaciones a Edge Functions.
