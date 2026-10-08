# SSD: contexto y propuesta de migración a Cloudflare

Documento de continuidad para trabajar en VS Code. Fecha: 2026-10-08.

> Estado actualizado: la primera base Astro/Workers ya está en la raíz del repositorio y el proyecto Expo se conserva en `old/`. Incluye configuración local D1/R2, esquema inicial y catálogo de prueba. La migración funcional, autenticación y recursos Cloudflare remotos siguen pendientes. Consulta el `README.md` de la raíz para ejecutarla.

## Objetivo y alcance

Migrar la idea y las capacidades de SSD a **Cloudflare Workers + D1 + R2**, con **Astro SSR**, React para formularios interactivos y un motor de estados persistido en la base de datos.

No es necesario configurar un proyecto Supabase para analizar o diseñar esta migración. El repositorio actual sirve como referencia funcional, de interfaz y de contratos de API.

Este documento recoge el análisis y las recomendaciones discutidas. **La migración todavía no está implementada**: no se crearon recursos Cloudflare, no se desplegó un Worker y no se validaron D1 o R2. La elección de Astro parte de la propuesta del usuario; las decisiones sobre autenticación, notificaciones y alcance inicial siguen siendo propuestas para concretar durante la implementación.

## Qué es SSD

Portal corporativo para crear, revisar, aprobar y ejecutar solicitudes internas. El código y el seed incluyen solicitudes de personal, vacaciones/permisos, desvinculación, compras/activos de TI y líneas celulares.

Capacidades que deben conservarse:

- Catálogo de tipos de solicitud con formularios configurables.
- Solicitudes con folio, solicitante, beneficiarios, departamento y datos específicos del formulario.
- Pasos ordenados de aprobación o ejecución (`approval` / `fulfillment`).
- Asignación de responsables por departamento o ámbito, con principales y suplentes.
- Bandeja del aprobador, solicitudes propias, detalle, estados y dashboard.
- Administración de roles, catálogos, tipos de solicitud, pasos y responsables.
- Historial de acciones y decisiones.
- Consulta de datos corporativos y jefatura mediante Microsoft Graph.
- Vistas de impresión y cartas responsivas.

Los flujos existentes son configurables; no conviene codificar una secuencia única como Finanzas → Gerencia. Para una primera implementación se propone conservar secuencias configurables. Condiciones, bifurcaciones y aprobaciones paralelas necesitan reglas explícitas antes de añadirse.

## Evidencia del repositorio actual

| Ruta | Qué aporta |
| --- | --- |
| `README.md`, `package.json`, `app.json` | Stack actual: Expo Router + React Native Web. |
| `app/` | Pantallas, navegación, formularios, login, solicitudes, bandeja y administración. |
| `src/lib/api.ts` | Contratos HTTP de lectura, creación, decisiones y administración. |
| `src/lib/types.ts` | Tipos de solicitudes, pasos, formularios, roles y catálogos. |
| `src/lib/workflow.ts` | Helpers de configuración de pasos y reconocimiento de jefatura inmediata. No es el motor completo del backend. |
| `src/context/SessionContext.tsx` | Supabase Auth como intermediario de Microsoft Entra; consultas a Microsoft Graph. |
| `src/lib/supabase.ts` | Cliente Supabase y control de variables públicas faltantes. |
| `db/init/001_schema.sql` | Modelo relacional PostgreSQL base. |
| `db/init/002_seed.sql` | Formularios y flujos de referencia. |
| `db/migrations/` | Evolución del modelo, organización, perfiles y cambios de reglas. |
| `app/requests/[id]/print.tsx`, `responsiva.tsx` | Documentos renderizados en el frontend e impresión con `window.print()`. |

Las notas históricas en `docs/` describen Next.js, Express y fases de migración a Supabase. **Los backends Express y Supabase Functions mencionados allí no están en este checkout**. No tomar esas notas como prueba de comportamiento desplegado.

El esquema base incluye `request_types`, `approvers`, `admin_users`, `user_roles`, `catalog_items`, `workflow_step_templates`, `requests`, `request_steps` y `request_events`. Migraciones posteriores incorporan unidades organizativas y perfiles de empleados. Para diseñar D1 hay que revisar la secuencia completa de migraciones, no copiar solamente el esquema inicial.

Existen cambios históricos en la representación de jefatura inmediata: helpers del frontend reconocen varios códigos y migraciones posteriores limpian `IMMEDIATE_LEAD`. Es necesario definir la regla deseada, sin inferir que todas las representaciones históricas siguen vigentes.

## Arquitectura objetivo

| Componente | Responsabilidad |
| --- | --- |
| Astro SSR en Workers | Renderizar rutas protegidas y ejecutar lógica de servidor. |
| React | Formularios dinámicos y otras interacciones que necesitan estado en el navegador. |
| Astro Actions + Zod | Validar entradas y ejecutar comandos autenticados. |
| Servicios de dominio | Resolver permisos, asignaciones y transiciones; separados de páginas y Actions. |
| D1 + Drizzle, dialecto SQLite | Persistir definiciones, instancias, usuarios, decisiones e historial. |
| R2 privado | Guardar adjuntos y documentos; metadatos y permisos en D1. |
| Cloudflare Queues, propuesta | Procesar notificaciones y otros efectos posteriores a la transición. |
| Microsoft Entra / Graph | Identidad corporativa y datos de directorio, si se conserva esta integración. |

Workers Static Assets puede servir recursos estáticos. El frontend Expo exportado también podría alojarse así durante una etapa transitoria; el destino discutido es Astro SSR, no asumir que ambas interfaces deben mantenerse indefinidamente.

PostgreSQL e Inngest aparecieron en el ejemplo arquitectónico compartido. Para este objetivo se propone **D1 en lugar de PostgreSQL** y evaluar **Queues en lugar de introducir Inngest por defecto**. Drizzle debe usar el dialecto y las operaciones compatibles con D1.

Estructura orientativa del futuro código, todavía no creada:

```text
src/
  pages/                 # Rutas SSR y endpoints necesarios
  actions/               # Comandos tipados con Zod
  services/
    workflow.ts          # Transiciones y reglas del dominio
    authorization.ts     # Acceso a solicitudes y acciones
    documents.ts         # Metadatos y operaciones autorizadas de R2
  auth/                  # Sesión e integración de identidad
  db/                    # Esquema Drizzle y acceso a D1
  components/            # Componentes Astro e islas React
migrations/              # Migraciones SQLite/D1
```

## Núcleo: separar definición y ejecución

La base de datos es la fuente de verdad del estado. El servicio de dominio decide qué transiciones están permitidas; no esconder esas reglas en componentes de UI.

Modelo conceptual propuesto:

| Entidad | Propósito |
| --- | --- |
| Usuarios y roles | Identidad local y capacidades administrativas. |
| Plantilla de flujo | Identidad estable de un flujo configurable. |
| Versión de plantilla | Definición publicada e inmutable de campos, pasos y reglas. |
| Pasos de versión | Orden, tipo de paso y estrategia de asignación. |
| Solicitud | Instancia ligada a una versión, con estado general y versión de concurrencia. |
| Pasos de solicitud | Ejecución concreta, responsables asignados, estado y decisión. |
| Historial de acciones | Registro de transiciones y actor verificado. |
| Documentos | Metadatos y claves de objetos privados en R2. |
| Outbox de eventos | Efectos pendientes de publicación o entrega. |

**Editar una plantilla no debe modificar solicitudes en curso.** Cada solicitud debe apuntar a una versión inmutable y conservar las asignaciones o snapshots que se definan al iniciar cada paso. Cambios de responsables, suplencias o reasignaciones deben tener una política explícita y dejar historial.

El esquema definitivo debe concretar si un paso tiene un único responsable, varios candidatos o un quorum. La propuesta inicial es una secuencia de pasos con responsable efectivo y política de suplencia explícita; no dar por resuelto el caso de aprobación paralela.

## Transición de aprobación

Cuando un aprobador actúa:

1. Validar la sesión en el servidor y derivar de ella la identidad del actor.
2. Validar el input con Zod, incluida una clave de idempotencia.
3. Verificar permiso sobre la solicitud y asignación efectiva al paso actual. El rol genérico de aprobador no basta.
4. Comprobar estado, paso actual y versión de concurrencia esperados.
5. Registrar la decisión, avanzar al siguiente paso o terminar el flujo, actualizar la versión, registrar historial y escribir el evento de outbox como una unidad atómica.
6. Procesar la notificación después de confirmar la transición.

La implementación debe usar operaciones compatibles con **D1**, por ejemplo lotes atómicos y actualizaciones condicionales cuando correspondan. No asumir que una transacción interactiva de PostgreSQL o un callback de transacción de Drizzle funcionan igual en D1. Verificar la API del adaptador antes de implementar.

La condición de concurrencia debe proteger todo el conjunto de escrituras: si una actualización no encuentra el estado o la versión esperados, no puede quedar una decisión, un historial o un evento de notificación huérfano. Un lote atómico por sí solo no convierte una actualización de cero filas en un fallo; diseñar y probar explícitamente esta condición.

Dos clics, dos pestañas o dos aprobadores concurrentes no deben avanzar dos veces la solicitud. Usar idempotencia, restricciones únicas y control de versión. El cliente debe recibir un resultado explícito si el paso ya fue resuelto.

El rechazo, la ejecución y la finalización también son transiciones. Antes de implementarlas, definir si un rechazo termina la solicitud o permite corrección/reenvío. No confundir una aprobación completa con una ejecución completada cuando existen pasos `fulfillment`.

## Notificaciones fiables

El envío de correo no puede formar parte de una transacción SQL. Guardar un evento **outbox** junto con la transición y enviarlo después.

- Un publicador recupera eventos pendientes de D1 y los entrega a la cola.
- Un consumidor envía la notificación mediante el proveedor seleccionado.
- Publicación y procesamiento toleran reintentos y entregas duplicadas.
- Registrar estado de entrega y una clave estable por evento/destinatario.
- Diseñar recuperación para fallos entre guardar en D1, publicar en la cola y marcar la publicación.

La recomendación inicial es correo. Slack, Teams y firmas legales serían extensiones si el usuario las necesita. No se encontraron integraciones implementadas con DocuSign, Slack o Teams en este checkout.

## Autenticación y autorización

D1 y R2 no reemplazan Supabase Auth. Si se conserva Microsoft Entra, hay que definir la integración OIDC/OAuth, la sesión y el callback de la nueva aplicación. Evaluar autenticación directa con Entra o una solución compatible con Workers antes de elegir bibliotecas.

Las rutas protegidas de Astro deben bloquear o redirigir antes de renderizar el contenido restringido. **Cada Action y endpoint debe verificar también autenticación y autorización**; el middleware de páginas y la validación Zod no bastan.

En el cliente actual, `src/lib/api.ts` envía correos de actores suministrados por el frontend y no agrega una cabecera `Authorization`. Eso no demuestra cómo protege las solicitudes el backend remoto, cuya implementación falta. Para el Worker nuevo, no confiar en `actorEmail`, roles o responsables enviados por el cliente: derivarlos de una sesión verificada.

Aplicar permisos de lectura por solicitante, asignación y administración, además de permisos de acción por paso. Definir protección CSRF, cookies y origen de los comandos según el diseño de sesión seleccionado.

## Documentos y R2

Las vistas actuales de impresión no son almacenamiento persistente ni firma digital legal. R2 aportaría la capa de archivos que no está implementada en este frontend.

- Bucket privado; no publicar documentos corporativos por defecto.
- Guardar en D1 relación con solicitud, clave R2, nombre, tamaño, tipo, creador y fechas.
- Autorizar carga y descarga mediante el servidor.
- Definir límites y validación de archivos, política de retención y eliminación.
- Manejar fallos parciales: D1 y R2 no comparten una transacción. Usar estados y limpieza de objetos huérfanos.
- Decidir si las cartas siguen imprimiéndose en navegador o si se generan y archivan como documentos.

## Adaptación de PostgreSQL a D1

No aplicar directamente los SQL actuales a D1. Revisar:

- UUID y `gen_random_uuid()`: generar IDs con una estrategia compatible, por ejemplo `crypto.randomUUID()` en el Worker y columnas de texto.
- JSONB y funciones PostgreSQL: definir representación JSON y consultas compatibles con SQLite/D1.
- Booleanos y fechas: fijar convenciones de persistencia y serialización.
- `pgcrypto`, casts, alteraciones y migraciones con funciones PostgreSQL: reescribir para SQLite.
- Claves foráneas, índices, unicidad, orden de pasos y borrado: preservar invariantes.
- Cambios de reglas: separar migraciones estructurales de publicación de nuevas versiones de flujo.
- Si se migrarán datos reales, diseñar exportación, transformación y verificación; no ejecutar escrituras de producción como parte del análisis.

## Validación realizada en el entorno de referencia

| Comprobación | Resultado |
| --- | --- |
| Git: lectura del remoto | Correcta con la autenticación existente. |
| Runtime | Node 24.19.0 y npm 11.9.0. |
| `npm ci --cache /workspace/.npm-cache --no-audit --no-fund` | Correcta; dependencias instaladas respetando el lockfile. |
| `CI=1 EXPO_NO_TELEMETRY=1 npm run build:web` | Correcta; exportación en `dist`. |
| `npm run typecheck` | Falla con 11 errores TS2339 por `hovered` ausente en `PressableStateCallbackType`. |
| Pantalla `/login` en Chromium | HTTP 200, título y control de acceso corporativo visibles; sin errores de JavaScript de página. |
| Acción de acceso sin variables Supabase | Muestra el aviso esperado de configuración faltante. |
| Autenticación real y backend Supabase | No validados; no son requisito para el objetivo de análisis. |
| Astro / Workers / D1 / R2 | No implementados ni validados. |

Los errores TypeScript corresponden al código y tipos fijados del repositorio; no se suprimieron ni se modificó el código para ocultarlos. No hay una suite de tests declarada en `package.json`.

Arranque de referencia usado en la nube:

```bash
cd /workspace/ssd
EXPO_OFFLINE=1 EXPO_NO_TELEMETRY=1 npm run web:local-cloud
```

`EXPO_OFFLINE` evita consultas externas del CLI de Expo, no las llamadas Supabase de la aplicación. No agregar `--offline` a ese script porque ya contiene `--localhost` y el CLI rechaza la combinación. En VS Code local, usar la ruta local del checkout y el shell correspondiente; `/workspace/ssd` pertenece al entorno cloud.

## Configuración guardada durante onboarding

Se guardaron en el borrador del entorno cloud:

- `install_script`: instalación con `npm ci` y compilación del frontend actual.
- `start_skill`: contexto e instrucciones de referencia, posteriormente ajustados al objetivo de Cloudflare.
- Requisitos `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` y `EXPO_PUBLIC_API_URL`, añadidos antes de aclarar el objetivo. **No son necesarios para la migración**; pueden retirarse desde la configuración del entorno. El API URL es opcional incluso para el frontend actual, porque tiene un valor derivado de la URL Supabase.

Guardar el borrador no ejecuta scripts, no publica el entorno y no crea recursos Cloudflare. No se guardaron valores de claves en este documento. No introducir una clave service-role en variables públicas de Expo.

Cada tarea cloud ya dispone de un entorno aislado: usar el checkout existente y no crear worktrees salvo solicitud explícita del usuario. Esta restricción no impide organizar el trabajo de desarrollo local según sus preferencias.

## Plan para continuar en VS Code

1. Revisar `src/lib/api.ts`, tipos, formularios, seed y todas las migraciones. Crear un inventario de comportamientos confirmados y reglas que necesitan decisión porque falta el backend.
2. Concretar el alcance inicial: flujos lineales configurables/versionados, política de rechazo y reenvío, suplencias, pasos de ejecución y conservación de solicitudes históricas.
3. Definir sesión e integración Entra; escoger proveedor de correo. Firmas legales y canales adicionales quedan pendientes de necesidad explícita.
4. Preparar Astro SSR con adaptador Cloudflare, React, Actions/Zod, Drizzle SQLite y configuración de bindings locales D1/R2. Elegir versiones compatibles y fijarlas en el lockfile.
5. Crear esquema y migraciones D1, versiones inmutables y datos de demostración sin copiar identidades reales del seed a nuevas instalaciones por defecto.
6. Implementar una sección vertical: catálogo → formulario → solicitud → bandeja → aprobación/rechazo → historial. Incorporar permisos, concurrencia e idempotencia desde el inicio.
7. Incorporar outbox, cola y correo con reintentos; después documentos privados en R2.
8. Ampliar administración y tipos de solicitud hasta alcanzar el alcance acordado. Evaluar migración de datos históricos aparte.
9. Validar con el runtime local de Workers y, cuando se autorice, desplegar en Cloudflare y ejecutar pruebas de integración sobre los bindings reales.

Pruebas relevantes para la nueva implementación:

- Editar/publicar una plantilla no cambia solicitudes en curso.
- Un usuario sin asignación no puede decidir un paso, aunque tenga rol de aprobador.
- La manipulación de correos o roles del input no altera la identidad efectiva.
- Dos decisiones concurrentes producen una sola transición válida.
- Repetir un comando no duplica pasos, historial o eventos.
- Un fallo de notificación conserva la aprobación y permite reintentar el evento.
- El estado terminal distingue aprobación de cumplimiento cuando corresponde.
- Descargas R2 respetan acceso a la solicitud y los fallos parciales no dejan referencias inconsistentes.

## Texto para retomar con un agente en VS Code

> Lee `docs/migracion-cloudflare-astro.md` y las instrucciones del repositorio. El objetivo es migrar SSD a Astro SSR en Cloudflare Workers con D1 y R2, conservando formularios dinámicos y flujos configurables. La definición debe estar versionada e inmutable y separada de su ejecución. No dependas de configurar Supabase para avanzar. Inspecciona el contrato del frontend y los SQL, identifica reglas que no pueden inferirse porque falta el backend y concreta el siguiente incremento antes de implementarlo. Autorización en servidor, transiciones atómicas compatibles con D1, idempotencia y outbox son requisitos centrales. El análisis previo no creó recursos Cloudflare ni autorizó despliegues.
