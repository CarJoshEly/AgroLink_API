# AgroLink Honduras — API_REST

Backend (NestJS + Prisma + PostgreSQL vía Supabase) del marketplace agrícola
AgroLink Honduras. Sirve tanto a `AgroLink_MOVIL` (Flutter) como a
`AgroLink_WEB` (Next.js) — ningún cliente accede a la base de datos
directamente.

## Requisitos

- Node.js 24.x (fijado en `package.json#engines` — usar otra versión mayor
  puede resolver dependencias opcionales distinto y romper `npm ci`/`npm install`
  en CI, ver "Notas de despliegue" más abajo)
- Una base de datos PostgreSQL (el proyecto usa Supabase)

## Setup local

```bash
npm install
cp .env.example .env   # y llenar con valores reales — ver la tabla abajo
npx prisma migrate deploy   # aplica las migraciones existentes
npm run db:seed             # opcional — datos de prueba
npm run start:dev
```

`npm install` corre `prisma generate` solo (hook `postinstall`) — no hace
falta correrlo a mano salvo que cambies `prisma/schema.prisma` sin reinstalar.

## Variables de entorno

Ver [`.env.example`](.env.example) para la lista completa con comentarios.
Resumen:

| Variable | Para qué |
|---|---|
| `NODE_ENV` | `production` activa gates de seguridad — ver comentario en `.env.example` |
| `DATABASE_URL` / `DIRECT_URL` | Conexión pooled (runtime) / directa (migraciones) a Supabase |
| `JWT_SECRET`, `JWT_EXPIRATION`, `JWT_REFRESH_EXPIRATION` | Firma y expiración de tokens |
| `CORS_ORIGINS` | Orígenes permitidos, separados por coma. Vacío en prod = deniega todo (fail-closed) |
| `WEB_APP_URL` | Dominio del frontend — arma los links de los correos (verificación, reset, aviso a admin) |
| `THROTTLE_TTL` / `THROTTLE_LIMIT` | Rate limit global (los endpoints de auth tienen límites propios más estrictos, ver `auth.controller.ts`) |
| `SUPABASE_URL` / `SUPABASE_KEY` / `SUPABASE_BUCKET` | Storage de imágenes de producto y documentos de verificación |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` / `MAIL_FROM_ADDRESS` / `ADMIN_NOTIFY_EMAIL` | Envío de correo transaccional |
| `GOOGLE_MAPS_API_KEY` | Geocoding y distancia comprador↔vendedor |

## Correr

```bash
npm run start        # una vez
npm run start:dev    # watch mode — lo normal en desarrollo
npm run start:prod   # como corre en producción: node dist/src/main (ver nota abajo)
```

## Tests

```bash
npm run test        # unitarios
npm run test:e2e    # e2e
npm run test:cov    # cobertura
```

## Despliegue (Render)

El servicio vive como [Blueprint de Render](https://render.com/docs/blueprint-spec)
en [`render.yaml`](render.yaml) — build, start, health check y la lista de
env vars requeridas quedan documentados ahí como código. Para desplegar:
**New → Blueprint** en el dashboard de Render, conectar este repo, y llenar
los env vars marcados `sync: false` (son secretos, no viven en el archivo).

Producción actual: `https://agrolink-api-we44.onrender.com` (free tier —
se duerme tras ~15 min sin tráfico; la primera petición después de eso
tarda 30-60s en responder, es esperado).

### Notas de despliegue (para no repetir la depuración)

Tres problemas reales que costó encontrar al montar esto por primera vez,
documentados para que nadie los vuelva a pisar:

1. **`package-lock.json` debe estar versionado.** Estaba en `.gitignore`;
   sin él, `npm ci` falla directo en cualquier plataforma de CI/deploy.
2. **`NODE_ENV=production` hace que `npm install` omita `devDependencies`**
   por defecto — y `@nestjs/cli`/`typescript` (que `nest build` necesita)
   viven ahí. El build command usa `npm install --include=dev` para
   forzar su instalación pese a `NODE_ENV=production`.
3. **`nest build` no compila a `dist/main.js` sino a `dist/src/main.js`**
   en este proyecto: `tsconfig.build.json` excluye `test/` pero no
   `prisma/*.ts` (los scripts de seed/admin), así que TypeScript calcula
   la raíz común de compilación como la raíz del repo, no `src/`, y
   refleja esa estructura dentro de `dist/`. `start:prod` ya apunta al
   lugar correcto (`node dist/src/main`) — si algún día se ajusta
   `tsconfig.build.json` para excluir `prisma/` también, revisar que
   `dist/main.js` vuelva a existir en la raíz y actualizar el script.

## Documentación de la API

En cualquier ambiente que no sea `production`, Swagger vive en `/api/docs`
(gateado a propósito en prod — no expone el mapa completo de la API sin auth
a cualquiera que lo visite).
