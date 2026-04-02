# SSD | Sistema de Solicitudes Digital

Portal corporativo para gestionar solicitudes internas (personal, vacaciones, compras, TI y telefonia).

## Stack Actual (sin Docker / sin Postgres local)
- Frontend activo: `expo-web` (Expo Router + React Native Web)
- Backend activo: `Supabase Edge Functions` + `Supabase Postgres`
- Base de datos: `Supabase Postgres` (cloud)
- Auth: `Supabase Auth` + Microsoft Entra ID

## Que Se Usa y Que No
- Se usa `expo-web` como frontend principal.
- Se usa `supabase/functions/api` como endpoint HTTP principal.
- `backend` (Express) queda como referencia/fallback temporal durante el cutover final.
- `frontend` (Next.js) queda legado durante la migracion.
- Se omite Docker y Postgres local para el flujo normal del proyecto.

Estado de migracion funcional en Expo Web:
- Login real con Supabase Auth + Microsoft Entra.
- Dashboard, solicitudes, detalle, inbox con acciones de aprobacion y catalogo.
- Creacion de solicitudes por tipo en `/solicitudes/[code]`.
- Admin completo (admins, catalogos, tipos, workflows, pasos, aprobadores, lineas aprobadas).
- Rutas legacy mapeadas: `/perfil`, `/inbox`, `/admin`, `/catalogo`, `/mis-solicitudes`, `/solicitudes/[code]`, `/requests/[id]`.

## Estructura
- `expo-web`: frontend web con Expo.
- `supabase/functions/api`: API HTTP principal (en migracion activa).
- `backend`: API Express legado temporal.
- `supabase/migrations`: esquema SQL fuente de verdad.
- `docs`: notas de arquitectura y despliegue.

## Backend Supabase (oficial)
```bash
supabase functions serve api --env-file supabase/.env.local
```

Endpoints locales:
- `http://127.0.0.1:54321/functions/v1/api/health`
- `http://127.0.0.1:54321/functions/v1/api/catalog`

Nota:
- Expo Web ya consume `supabase/functions/api` para lecturas y escrituras del flujo principal.
- El backend Express queda solo como referencia durante la transicion final.

## Levantar Expo Web
```bash
cd expo-web
npm install
cp .env.example .env
npm run web
```

Frontend web local:
- `http://localhost:8081` (puerto por defecto de Expo web)

## Variables Minimas

Backend (`backend/.env`):
- `DATABASE_URL` (Supabase)
- `CORS_ORIGIN` (ej: `http://localhost:8081,http://localhost:19006`)
- `APP_BASE_URL`

Supabase Functions (`supabase/.env.local` al correr `supabase functions serve`):
- `APP_BASE_URL` (ej: `http://localhost:8081`)
- `RESEND_API_KEY` (provider de email para Edge Functions)
- `EMAIL_FROM` (ej: `SSD <notificaciones@tu-dominio.com>`)
- `SMTP_FROM` (fallback de remitente si no defines `EMAIL_FROM`)

Expo Web (`expo-web/.env`):
- `EXPO_PUBLIC_API_URL` (ej: `https://<project-ref>.supabase.co/functions/v1/api`)
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

Para login Microsoft Entra en Supabase:
- Habilitar provider `Azure` en Supabase Auth.
- Agregar `http://localhost:8081/auth/callback` como redirect URL en Supabase Auth.

## Nota de Seguridad
Si algun secreto real se llego a exponer en archivos locales, rotarlo de inmediato en Supabase, Microsoft Entra y SMTP.

## Referencias Del Codigo Original (Se Mantienen)
- `backend` (Express) y `frontend` (Next.js) se conservan como referencia funcional/arquitectonica durante el calco y migracion.
- No se eliminaron las carpetas de codigo original; se usan para contrastar logica, flujos y templates.
- Docker tambien se mantiene como referencia del stack original (`docker-compose.yml`), aunque el flujo principal actual use Supabase + Expo Web.

Arranque legado con Docker (referencia):
```bash
docker compose up --build
```
