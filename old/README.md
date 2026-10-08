# SSD | Sistema de Solicitudes Digital

Aplicacion web en Expo Router para gestionar solicitudes internas (personal, vacaciones, compras, TI y telefonia), conectada a Supabase cloud.

## Stack
- Frontend: Expo Router + React Native Web.
- Auth: Supabase Auth + Microsoft Entra ID.
- API/DB: Supabase cloud (Functions + Postgres).

## Estructura Actual
- `app`: rutas Expo Router.
- `src`: componentes, contexto de sesion y cliente API.
- `assets`: recursos estaticos.
- `docs`: notas funcionales/tecnicas.

## Ejecutar En Local (consumiendo Supabase cloud)
```bash
npm install
npm run web:local-cloud
```

URL local:
- `http://localhost:8081`

## Variables De Entorno
Archivo: `.env`

- `EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-key>`
- `EXPO_PUBLIC_API_URL=https://<project-ref>.supabase.co/functions/v1/api`

## Login Microsoft Entra
- Habilitar proveedor `Azure` en Supabase Auth.
- Agregar redirect URL:
  - `http://localhost:8081/auth/callback`

## Scripts
- `npm run web`: inicia Expo Web.
- `npm run web:local-cloud`: inicia en `localhost:8081` usando Supabase cloud.
- `npm run build:web`: genera build web.
- `npm run typecheck`: validacion TypeScript.
