# SSD | Arranque con Supabase + Vercel

## 1. Crear el repositorio remoto
- Crea un repositorio nuevo, por ejemplo: `ssd`
- Sube la rama `main`

## 2. Conectar Vercel
- Importa el repositorio en Vercel
- Configura `Root Directory` = `frontend`
- Framework = `Next.js`

## 3. Variables en Vercel
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_APP_URL`

## 4. Configurar Supabase
- Ejecuta el SQL base de `supabase/migrations/20260323_150000_ssd_base.sql`
- Crea el bucket `ssd-documents`
- Configura Auth > Providers > Azure / Microsoft Entra

## 5. Redirect URLs en Supabase Auth
- Produccion:
  - `https://<tu-dominio-vercel>/auth/callback`
- Local:
  - `http://localhost:3000/auth/callback`

## 6. Edge Functions
- Despliega `supabase/functions/request-notify`
- Configura secrets:
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `RESEND_API_KEY` si usaras Resend

## 7. Datos iniciales
- Carga el seed base actual adaptado a Supabase
- Registra tu usuario admin en `admin_users`
- Verifica tipos de solicitud, departamentos y aprobadores

## 8. Corte recomendado
1. Login
2. Dashboard y catalogos
3. Solicitudes
4. Aprobaciones
5. Notificaciones
6. Cartas y documentos

## Nota
Mientras completes la migracion, el backend Express puede seguir existiendo como capa temporal de compatibilidad.
