# Base inicial Astro y Cloudflare para SSD

## Decisión

Astro SSR es el proyecto principal en la raíz del repositorio. Expo, sus contratos y sus notas históricas se conservan en `old/`. El plan de migración a Cloudflare permanece en `docs/migracion-cloudflare-astro.md`.

## Primera entrega

La aplicación usa el adaptador Astro para Workers, una isla React para filtrar un catálogo leído desde D1 y un endpoint de salud. Un esquema SQLite inicial representa tipos de solicitud, versiones de flujo, instancias, pasos, historial, documentos y eventos de outbox. El binding R2 queda preparado, sin rutas de carga o descarga.

## Límites

La lectura del catálogo solo contiene datos de prueba locales. Ningún comando de negocio está disponible antes de integrar Microsoft Entra, verificar sesiones en servidor y aplicar autorización por solicitud y paso. Las migraciones y datos locales no modifican Cloudflare remoto. El despliegue requiere recursos y secretos reales, revisión de permisos y aplicación explícita de migraciones remotas.

## Validación

La entrega debe pasar `npm run check`, `npm run build`, la migración D1 local y la comprobación HTTP local de la página y `/api/health`.
