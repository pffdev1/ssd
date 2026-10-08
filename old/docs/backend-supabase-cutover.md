# Backend Supabase Cutover

Fecha: 2026-03-28

## Objetivo
Reemplazar `backend` (Express) por `supabase/functions/api` + SQL/RPC en Supabase.

## Estado actual
- API de lectura migrada en `supabase/functions/api/index.ts`.
- `expo-web` ya puede apuntar a `EXPO_PUBLIC_API_URL=https://<project-ref>.supabase.co/functions/v1/api`.
- `backend` queda temporal para referencia y endpoints no migrados.

## Endpoints migrados (lectura)
- `GET /health`
- `GET /catalog`
- `GET /dashboard`
- `GET /requests`
- `GET /requests/:id`
- `GET /requests/inbox`
- `GET /approvers/profile`
- `GET /admins/check`
- `GET /admins`
- `GET /admin/catalog-items`
- `GET /admin/mobile-lines`
- `GET /users/roles`
- `GET /admin/user-roles`
- `GET /admin/approvers`
- `GET /admin/workflow-steps`

## Endpoints pendientes (escritura)
- `POST /requests`
- `POST /requests/:id/steps/:stepId/decision`
- Admin writes:
  - `POST /admins`
  - `POST /admin/user-roles`
  - `POST/PATCH /admin/catalog-items`
  - `POST/PATCH/DELETE /admin/request-types`
  - `PATCH /admin/request-types/:id/workflow`
  - `POST/PATCH/DELETE /admin/workflow-steps`
  - `POST/PATCH/DELETE /admin/approvers`
  - `POST /admin/approvers/:id/move`
  - `POST /admin/approvers/:id/assignment-role`

## Siguiente iteracion recomendada
1. Migrar `POST /requests` y `decision` a funciones SQL transaccionales (`rpc`) para preservar reglas de negocio.
2. Mover notificaciones a Edge Functions (`request-notify`) tras cada cambio de estado.
3. Migrar admin writes a `api` Edge Function.
4. Retirar `backend` cuando paridad funcional sea 100%.