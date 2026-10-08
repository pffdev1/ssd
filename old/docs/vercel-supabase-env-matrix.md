# SSD | Matriz de Variables para Vercel y Supabase

## Vercel

### Production / Preview / Development
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_APP_URL`

### Mientras siga el backend puente
- `NEXT_PUBLIC_API_URL`
- `API_BASE_URL`

## Supabase Edge Functions
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`

## Valores de referencia

### Frontend local
- `NEXT_PUBLIC_APP_URL=http://localhost:3000`
- `NEXT_PUBLIC_API_URL=http://localhost:4000/api`
- `API_BASE_URL=http://localhost:4000/api`

### Produccion con backend temporal
- `NEXT_PUBLIC_APP_URL=https://ssd.vercel.app`
- `NEXT_PUBLIC_API_URL=https://ssd-api.tudominio.com/api`
- `API_BASE_URL=https://ssd-api.tudominio.com/api`

## Observacion
Cuando SSD termine el corte a Supabase para lecturas y escrituras operativas, `NEXT_PUBLIC_API_URL` y `API_BASE_URL` podran retirarse.
