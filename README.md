# Matías Salvetti · Chupetti — web oficial

Next.js 16 (App Router, Cache Components) + TypeScript + Tailwind v4 + Supabase (Auth con Twitch, Postgres con RLS, Realtime, Storage). Deploy en Vercel.

## Requisitos

- Node 20.9+ (probado con Node 24)
- Una cuenta de Supabase y una app de Twitch
- Opcional: Docker, para levantar Supabase local con `npx supabase start`

## Setup local

```bash
npm install
cp .env.example .env.local   # y completá los valores
npm run dev                  # http://localhost:3000
```

La web compila y se muestra aunque Supabase no esté configurado. En ese caso el login queda deshabilitado y la configuración usa valores por defecto.

## Variables de entorno

| Variable | Dónde se usa | De dónde sale |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | URLs absolutas, metadata | URL del sitio |
| `NEXT_PUBLIC_SUPABASE_URL` | cliente y servidor | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | cliente y servidor | Supabase → API Keys (publishable o anon) |
| `SUPABASE_SECRET_KEY` | **solo servidor** (sorteos, puntos, borrar cuenta) | Supabase → API Keys (secret o service_role) |
| `TWITCH_CLIENT_ID` / `TWITCH_CLIENT_SECRET` | API Helix (antigüedad de cuenta, en vivo) | dev.twitch.tv → tu app |
| `TWITCH_CHANNEL_LOGIN` | canal a monitorear | `chupetti` |
| `KICK_CLIENT_ID` / `KICK_CLIENT_SECRET` | estado en vivo de Kick (API pública oficial) | kick.com → Settings → Developer |
| `KICK_CHANNEL_SLUG` | canal de Kick | `chupetti` |
| `YOUTUBE_API_KEY` | últimos clips (cache 1 h) | Google Cloud → YouTube Data API v3 |
| `YOUTUBE_CHANNEL_ID` / `YOUTUBE_HANDLE` | canal de clips | opcional el ID; si falta se resuelve desde `@ChupettiClips` |
| `SUPABASE_AUTH_EXTERNAL_TWITCH_*` | solo para Supabase local | los mismos de Twitch |

Nunca pongas `SUPABASE_SECRET_KEY` ni `TWITCH_CLIENT_SECRET` con prefijo `NEXT_PUBLIC_`.

## Supabase

### 1. Crear el proyecto y aplicar las migraciones

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npm run db:push        # aplica supabase/migrations
npm run db:types       # regenera src/types/database.ts desde la base real
```

Las migraciones ya cargan los casinos, las redes, la configuración inicial y los documentos legales placeholder.

### 2. Configurar el login con Twitch

1. En <https://dev.twitch.tv/console/apps> creá una app (categoría *Website Integration*).
2. En **OAuth Redirect URLs** agregá `https://<project-ref>.supabase.co/auth/v1/callback`.
3. Copiá el **Client ID** y generá un **Client Secret**.
4. En Supabase: **Authentication → Sign In / Providers → Twitch**. Activalo y pegá el Client ID y el Secret.
5. En Supabase: **Authentication → URL Configuration**.
   - **Site URL**: la URL de producción.
   - **Redirect URLs**: agregá `http://localhost:3000/auth/callback`, `https://<tu-dominio>/auth/callback` y, para los previews de Vercel, `https://*-<tu-equipo>.vercel.app/auth/callback`.
6. En **Authentication → Sign In / Providers → Email**, desactivá el registro por email: todos entran con Twitch.

Las mismas credenciales de Twitch van en `TWITCH_CLIENT_ID` y `TWITCH_CLIENT_SECRET` (`.env.local` y Vercel). Se usan para leer la fecha de creación de la cuenta (filtro anti-multicuentas) y, desde la fase 2, el estado en vivo.

### 3. Crear el primer admin

Todos (viewers, mods y admin) entran con Twitch. El primer admin se crea así:

1. Matías entra una vez a la web con su cuenta de Twitch.
2. Corré `npm run make-admin -- chupetti` (usa `SUPABASE_SECRET_KEY` de `.env.local`).
3. Desde `/panel/usuarios`, el admin puede pasar cualquier usuario a `mod` o `admin`.

## Scripts

| Script | Qué hace |
|---|---|
| `npm run dev` | servidor de desarrollo |
| `npm run build` | build de producción |
| `npm run lint` | ESLint |
| `npm run typecheck` | tipos de rutas + `tsc` |
| `npm test` | Vitest: lógica de cálculo **y migraciones + RLS** sobre PGlite (no necesita Docker) |
| `npm run db:push` | aplica las migraciones al proyecto vinculado |
| `npm run db:types` | genera los tipos de la base |
| `npm run make-admin -- <login> [admin\|mod]` | asigna rol a un usuario existente |

## Estructura

```
src/
  app/(site)/        páginas públicas (header, footer, gate +18)
  app/panel/         panel (login + rutas protegidas para mod/admin)
  app/auth/          login con Twitch y callback
  components/        layout, ui, panel
  lib/               supabase, auth, env, formato, cálculos, APIs externas
  proxy.ts           refresco de sesión y guardas de /panel
supabase/
  migrations/        SQL versionado (RLS en todas las tablas)
  tests/             tests de migraciones y policies con PGlite
scripts/             make-admin
```

## Estado en vivo

El servidor consulta Twitch (Helix `streams`) y Kick (`api.kick.com/public/v1/channels`) con tokens de app, como mucho una vez por minuto (perfil de caché `live` en `next.config.ts`). Twitch tiene prioridad. Si las dos APIs fallan o no están configuradas, se usa el interruptor manual de `/panel`.

## Bonus Hunt (fase 3)

- **Panel** (`/panel/hunts`): un mod crea el hunt (queda en borrador), carga los bonos con el buscador del catálogo (si el slot no existe, se agrega) y el pago de cada uno al abrirlo. Desde el mismo hunt abre o cierra los **calls** y el **adiviná el balance** (GTB), y acepta o rechaza los calls de los viewers.
- **Estados**: borrador (no se ve) → juntando bonos → abriendo → terminado. Al pasar a *terminado* la base exige que todos los bonos tengan pago, calcula el balance final y elige al ganador del GTB (el más cercano; en empate, el que apostó primero; los baneados no ganan). Si se vuelve a *abriendo*, los resultados se borran y se recalculan al cerrar de nuevo.
- **Viewers**: un call por hunt (editable mientras esté pendiente; si lo rechazan, pueden pedir otro) y una apuesta de balance (editable mientras esté abierto). Las dos cosas pasan por funciones `SECURITY DEFINER` que chequean `can_participate()` y un rate limit. Los montos del GTB se ven recién cuando el hunt termina.
- **En vivo**: la página `/bonus-hunt/[id]` escucha la tabla `hunts` por Supabase Realtime (cada cambio de un bono también actualiza su hunt) y se vuelve a pedir. Los datos públicos se cachean (perfil `hunt`) y el panel invalida el caché en cada cambio.

## Seguridad

- RLS en todas las tablas. Rol, baneo y saldos solo cambian por funciones `SECURITY DEFINER` o desde el servidor.
- Los perfiles de otros usuarios se leen por la vista `public_profiles`, que solo muestra nombre, avatar y nivel.
- El proxy hace un chequeo rápido del rol en `/panel/*`, y cada layout y cada Server Action del panel lo vuelven a verificar.

## Pendiente (por fase)

- **Fases 4 a 6**: Buys, Battle, Wager Race, Cuartel, sorteos. XP y puntos por participar en los hunts llegan con el Cuartel (fase 6).
- **Fase 7**: overlays de OBS, E2E, SEO y deploy.
