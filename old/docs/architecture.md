# Arquitectura SSD

## Stack
- Frontend: Next.js + TypeScript + Tailwind CSS.
- Backend: Node.js + Express + TypeScript.
- Base de datos: PostgreSQL.
- Orquestación local: Docker Compose.
- Despliegue recomendado: VPS Linux o nube privada con Docker y proxy reverso.

## Principios del diseño
- Un único portal para solicitudes de RRHH, Compras y Tecnología.
- Catálogo de tipos de solicitud configurable desde base de datos.
- Flujo de aprobación por pasos, con ruteo por departamento o por rol corporativo.
- Historial auditable mediante eventos y estados.
- Frontend elegante, corporativo y adaptable a nuevas categorías.

## Como se modelo el flujo de linea celular
- El ruteo por departamento vive ahora en la tabla `approvers`.
- La aprobación del gerente de área es el paso `AREA_MANAGER`.
- La autorización final de Gerencia General es el paso `GG_APPROVAL`.
- La generación de carta responsiva y entrega de TI pasa al paso `IT_DELIVERY`.
- Los planes y campos del formulario viven en `request_types.fields` y `request_types.workflow`.

## Escalabilidad
- Agregar nuevos tipos de solicitud requiere insertar un nuevo registro en `request_types`.
- Cambiar responsables por departamento requiere actualizar `approvers`.
- Un futuro modulo de integraciones puede escuchar eventos desde `request_events`.
