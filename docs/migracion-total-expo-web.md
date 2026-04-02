# Migracion Total a Expo Web

Fecha: 2026-03-28

## Objetivo
Completar el reemplazo de `frontend` (Next.js) por `expo-web`, manteniendo `backend` + `Supabase`.

## Estado actual
- `expo-web` activo con login real Supabase Auth + Azure.
- Capa de dominio migrada: `types`, `api`, `status`, `datetime`, `beneficiaries`, `user`.
- `supabase/functions/api` ya cubre endpoints de lectura.
- `backend` Express queda temporal para endpoints de escritura en migracion.
- Docker/Postgres local fuera del flujo recomendado.
- Ya se puede crear solicitudes desde `/solicitudes/[code]`.
- Ya se pueden aprobar/rechazar/completar pasos desde `/inbox`.
- Panel admin migrado en Expo Web (admins, catalogos, tipos, workflows, pasos, aprobadores y lineas).

## Rutas migradas
- `/login` -> lista
- `/` -> lista
- `/requests` -> lista
- `/request/[id]` -> lista
- `/inbox` -> base lista
- `/admin` -> base lista
- `/catalogo` -> base lista
- `/perfil` -> alias a perfil
- `/mis-solicitudes` -> alias a solicitudes
- `/solicitudes/[code]` -> base informativa
- `/requests/[id]` -> alias a detalle
- `/requests/[id]/print` -> base migrada
- `/requests/[id]/responsiva` -> base migrada

## Pendientes para cierre total
1. Portar UI avanzada y estilo final de `solicitudes/[code]` (paridad visual con Next).
2. Portar vistas finales de `print` y `responsiva` con layout corporativo completo.
3. Replicar toasts/skeletons y estados de carga del frontend legado.
4. Eliminar carpeta `frontend` cuando paridad funcional sea 100%.

## Criterio de Done
- Todas las rutas `page.tsx` del frontend legado tienen equivalente funcional en `expo-web`.
- QA valida flujo end-to-end: login, crear solicitud, aprobar, finalizar, imprimir/responsiva.
- `frontend` se archiva o elimina sin impacto.
