# SSD · nueva base Astro y Cloudflare

Proyecto principal de SSD en Astro SSR para Cloudflare Workers. Esta primera fase incluye un catálogo de prueba leído desde D1, una isla React de búsqueda, el esquema inicial de datos y un binding privado R2 preparado para la siguiente fase. El cliente Expo anterior y sus notas históricas están en [`old/`](old/).

El plan de migración y las reglas pendientes están en [`docs/migracion-cloudflare-astro.md`](docs/migracion-cloudflare-astro.md).

## Desarrollo local

Requiere Node.js 22.12 o superior y npm.

```powershell
npm ci
npm run db:migrate:local
npm run db:seed:local
npm run dev
```

Abrir la URL que muestra Astro. `db:seed:local` solo agrega dos tipos de ejemplo a D1 local y puede repetirse. `npm run db:list:local` muestra las migraciones locales pendientes. También están disponibles `npm run check`, `npm run build` y `npm run preview`.

## Alcance de esta fase

- La página principal lee los tipos activos desde D1. `/api/health` comprueba la conexión local a D1.
- `migrations/0001_initial.sql` define solicitudes, versiones de flujo, pasos, historial, documentos y outbox. Son tablas iniciales; todavía no se ejecutan transiciones de solicitudes.
- `DOCUMENTS` es un binding R2 local. No existen aún cargas ni descargas de documentos.
- No hay autenticación corporativa, formularios de envío ni aprobaciones. Esas acciones requieren sesiones verificadas, autorización por paso, concurrencia e idempotencia antes de habilitarse.

## Cloudflare remoto

`wrangler.jsonc` usa un ID D1 de marcador y nombres de recursos locales. Antes de desplegar, crear los recursos de la cuenta, sustituir el ID y los nombres por los reales, y configurar Entra y cualquier secreto necesario. No se han creado recursos remotos ni aplicado migraciones remotas.

Aplicar las migraciones D1 remotas es un paso independiente del despliegue del Worker. Comprobar la lista remota, aplicar deliberadamente las pendientes y volver a comprobar que no queden pendientes antes de publicar código que dependa del esquema. No usar los datos de `scripts/seed-local.sql` en producción.
