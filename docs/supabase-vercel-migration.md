# SSD | Migracion a Supabase + Vercel

## Objetivo
Mover SSD a una arquitectura mas simple y administrable:

- Frontend: `Next.js` desplegado en `Vercel`
- Auth: `Supabase Auth` con `Microsoft Entra`
- Base de datos: `Supabase Postgres`
- Seguridad de datos: `Row Level Security (RLS)`
- Archivos: `Supabase Storage`
- Automatizacion serverless: `Supabase Edge Functions`

## Arquitectura objetivo

### Vercel
- Renderiza el frontend de SSD.
- Ejecuta Server Components y Route Handlers de Next.js.
- Usa `@supabase/ssr` para leer la sesion autenticada desde cookies.

### Supabase
- `Auth`: inicio de sesion con Microsoft.
- `Postgres`: tablas de SSD.
- `RLS`: acceso por solicitante, aprobador o admin.
- `Storage`: cartas responsivas, documentos, adjuntos y exportables.
- `Edge Functions`: notificaciones, acciones server-side, integraciones con Teams, Resend o Microsoft Graph.

## Que se hizo en esta fase

### Frontend
- Se agrego el cliente SSR de Supabase en:
  - `frontend/src/shared/lib/supabase/client.ts`
  - `frontend/src/shared/lib/supabase/server.ts`
  - `frontend/src/shared/lib/supabase/middleware.ts`
  - `frontend/middleware.ts`
- El login ya usa `Supabase Auth` con provider `azure`.
- El callback OAuth vive en `frontend/app/auth/callback/route.ts`.
- El helper `frontend/auth.ts` ya obtiene la sesion desde Supabase.

### Base de datos
- Se creo la migracion base en `supabase/migrations/20260323_150000_ssd_base.sql`.
- Incluye:
  - `profiles`
  - helper de `current_user_email()`
  - helper de `is_admin()`
  - helper de `can_access_request()`
  - tablas de SSD
  - `RLS` para catalogos, solicitudes, pasos y eventos

### Edge Functions
- Se agrego el ejemplo `supabase/functions/request-notify/index.ts`.
- La function ya valida JWT y consulta la solicitud.
- Queda lista para integrar `React Email + Resend` o `Microsoft Graph`.

## RLS base propuesta

### Lectura de solicitudes
Un usuario puede ver una solicitud si:
- es quien la creo
- aparece como aprobador en alguno de sus pasos
- es admin

### Insercion de solicitudes
- el solicitante autenticado solo puede crear solicitudes con su propio correo
- el admin puede crear o corregir registros si es necesario

### Catalogos y estructura
- lectura para usuarios autenticados
- escritura solo para admins

## Flujo recomendado de migracion

### Fase 1
- Configurar proyecto Supabase
- Activar Microsoft Entra en Supabase Auth
- Aplicar SQL base
- Cargar seed funcional
- Poner variables en Vercel

### Fase 2
- Cambiar frontend a Supabase Auth definitivo
- Mantener el backend Express solo como compatibilidad temporal
- Empezar a mover lecturas directas a Supabase

### Fase 3
- Pasar aprobaciones y notificaciones a Edge Functions
- Pasar cartas y PDFs a Storage
- Retirar Express gradualmente

## Microsoft Entra en Supabase

Configura el provider `Azure` en `Supabase Auth`.

Usa como redirect principal:

`https://<tu-proyecto>.supabase.co/auth/v1/callback`

Y para desarrollo local:

`http://localhost:3000/auth/callback`

## Variables necesarias

### Vercel
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_APP_URL`

### Supabase Edge Functions
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY` o credenciales para Microsoft Graph

## Que quitar de Express a futuro

### Se puede retirar primero
- autenticacion con NextAuth
- validaciones de sesion por correo
- endpoints de lectura simples de catalogo

### Se mantiene temporalmente
- motor de workflow actual
- notificaciones actuales
- generacion de cartas mientras migramos a Storage + Functions

### Objetivo final
- workflow via RPC/Edge Functions
- notificaciones via Edge Functions
- frontend leyendo y escribiendo con Supabase

## Recomendacion operativa
No hagas el corte completo en un solo dia.

Hazlo asi:
1. Auth y sesion
2. Catalogos y dashboards
3. Solicitudes
4. Aprobaciones
5. Notificaciones
6. Cartas y documentos
