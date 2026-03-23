# SSD | Runbook de Go-Live con Supabase + Vercel

## Estado real hoy
- `Supabase Auth` ya esta integrado en el frontend.
- `Vercel` puede publicar el frontend de inmediato.
- SSD sigue en `modo puente`: la aplicacion todavia consume el backend Express para datos operativos.

## 1. Preparar Supabase
- Abre tu proyecto Supabase.
- En `SQL Editor`, ejecuta:
  - `supabase/migrations/20260323_150000_ssd_base.sql`
- Luego ejecuta el seed funcional:
  - `db/init/002_seed.sql`
- Crea el bucket:
  - `ssd-documents`

## 2. Configurar Microsoft Entra en Supabase Auth
- En `Authentication > Providers`, habilita `Azure`.
- Usa como callback de Supabase:
  - `https://<tu-project-ref>.supabase.co/auth/v1/callback`
- En `URL Configuration`, define:
  - `Site URL`: `https://<tu-dominio-vercel>`
  - `Redirect URLs`:
    - `https://<tu-dominio-vercel>/auth/callback`
    - `http://localhost:3000/auth/callback`

## 3. Conectar Vercel
- Importa `https://github.com/pffdev1/ssd.git`
- Crea un proyecto nuevo en Vercel
- Configura:
  - `Root Directory = frontend`
  - `Framework Preset = Next.js`

## 4. Variables en Vercel

### Minimas para login y sesion
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_APP_URL`

### Obligatorias mientras SSD siga en modo puente
- `NEXT_PUBLIC_API_URL`
- `API_BASE_URL`

Usa una URL publica del backend Express, por ejemplo:
- `https://ssd-api.tudominio.com/api`

## 5. Backend temporal
- Si el backend Express sigue siendo la fuente operativa, debes desplegarlo en un host accesible desde internet.
- Mientras no migremos lecturas y escrituras a Supabase, Vercel no puede depender de `localhost:4000`.

## 6. Edge Functions
- Usa `supabase/functions/request-notify` como punto de partida.
- Configura secrets:
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `RESEND_API_KEY` o credenciales equivalentes para Graph

## 7. Verificaciones despues del deploy
1. `/login` redirige a Microsoft via Supabase
2. el callback vuelve a SSD con sesion activa
3. `Home` carga catalogos y dashboard
4. `Catalogo de solicitudes` muestra tipos de solicitud
5. `Bandeja` carga tareas pendientes
6. `Admin` muestra departamentos, workflows y catalogos

## 8. Corte recomendado
1. publicar frontend en Vercel
2. exponer backend Express temporal
3. validar login con Supabase
4. validar lectura de catalogos y solicitudes
5. migrar endpoints del backend a Supabase por bloques
6. retirar Express cuando el flujo completo ya viva en Supabase

## Nota operativa
El despliegue mas rapido hoy es:
- `Vercel` para frontend
- `Supabase` para auth y base
- `Express` temporalmente expuesto como API puente
