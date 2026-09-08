# Vencimientos Tributarios

Aplicación web (instalable como PWA en celular y computador) para controlar los
vencimientos tributarios de las empresas gestionadas por el contador, con acceso
por usuario controlado por el administrador.

Arquitectura completa a $0 de costo de infraestructura: Next.js en Vercel (free
tier), Supabase (Postgres + Auth, free tier) y Gmail SMTP para el correo semanal.
Ver el detalle en `docs` o en el historial de la conversación que originó este
proyecto.

## 1. Requisitos

- Node.js 20+ (usa `node -v` para verificar)
- Una cuenta gratuita en [supabase.com](https://supabase.com)
- Una cuenta de Gmail para enviar el correo semanal
- Una cuenta gratuita en [github.com](https://github.com) (para el cron del
  correo semanal) y en [vercel.com](https://vercel.com) (para publicar la app)

## 2. Configurar Supabase

1. Crea un proyecto nuevo en Supabase (plan gratuito).
2. En **SQL Editor**, pega y ejecuta el contenido de
   `supabase/migrations/0001_init.sql`. Esto crea todas las tablas y las
   políticas de seguridad (RLS) que controlan qué empresa ve cada usuario.
3. En **Storage**, crea un bucket llamado `calendarios-dian` (puede ser
   privado) — ahí se guardan los PDF que subas del calendario DIAN.
4. En **Authentication → Providers**, deja activado el login por
   correo/contraseña. Desactiva el registro público si quieres que solo tú
   puedas crear usuarios (los usuarios se crean desde el panel "Usuarios" de
   la app, no por auto-registro).
5. En **Project Settings → API**, copia:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public key` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role key` → `SUPABASE_SERVICE_ROLE_KEY` (no la compartas, es la
     llave maestra)
6. **Muy importante:** crea tu propio usuario administrador. La forma más
   simple es invitarte a ti mismo desde **Authentication → Users → Invite
   user**, y luego en **Table Editor → profiles** cambiar tu fila para que
   `role = 'admin'` (por defecto los usuarios nuevos quedan como
   `colaborador`).

## 3. Configurar el correo de Gmail

1. Activa la verificación en dos pasos en tu cuenta de Gmail (requisito de
   Google para poder generar contraseñas de aplicación).
2. Ve a [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
   y genera una "contraseña de aplicación" para "Correo".
3. Usa tu correo Gmail como `GMAIL_USER` y esa contraseña generada (no tu
   contraseña normal) como `GMAIL_APP_PASSWORD`.

## 4. Variables de entorno

Copia `.env.example` a `.env.local` y completa todos los valores:

```bash
cp .env.example .env.local
```

## 5. Correr en local

```bash
npm install
npm run dev
```

Abre http://localhost:3000, inicia sesión con el usuario admin que creaste en
el paso 2.6.

## 6. Publicar en Vercel (gratis)

1. Sube este proyecto a un repositorio de GitHub.
2. En Vercel, "Add New Project" → importa el repositorio.
3. En **Environment Variables**, agrega las mismas variables de `.env.local`.
4. Despliega. Vercel te da una URL pública (ej.
   `https://tu-app.vercel.app`) — esa es la que instalas como PWA desde el
   celular (Chrome → menú → "Instalar app" / Safari → compartir → "Agregar a
   inicio").

## 7. Activar el correo automático de los lunes

1. En el repositorio de GitHub del proyecto, ve a **Settings → Secrets and
   variables → Actions** y agrega:
   - `APP_URL`: la URL pública de tu app en Vercel (sin `/` al final)
   - `CRON_SECRET`: el mismo valor que pusiste en la variable de entorno
     `CRON_SECRET`
2. El workflow `.github/workflows/weekly-email.yml` ya está configurado para
   ejecutarse todos los lunes a las 8:00 a. m. (hora Colombia). Puedes
   probarlo manualmente desde la pestaña **Actions** del repositorio con
   "Run workflow".

## 8. Uso normal

- **Empresas**: crea cada empresa con su NIT y las responsabilidades del RUT
  (usa el mismo listado de códigos que trae el formulario del RUT, casilla
  53). El ICA y la nómina electrónica/PILA son opcionales y no bloquean nada.
- **Calendario DIAN**: cada año (o cuando cambie), sube el PDF oficial. La
  app extrae las fechas automáticamente pero SIEMPRE debes revisarlas y
  confirmarlas antes de que se apliquen — nada se guarda sin tu aprobación.
- **Usuarios**: invita a tus colaboradores y marca qué empresa(s) puede ver
  cada uno. Puedes revocar el acceso en cualquier momento.
- **Vencimientos**: vista principal con exportación a Excel y PDF.

## Notas técnicas

- La seguridad de "quién ve qué empresa" está implementada con Row Level
  Security de Postgres (no solo en el frontend), en
  `supabase/migrations/0001_init.sql`.
- El parseo del PDF del calendario DIAN es de mejor esfuerzo (heurístico,
  corre en el navegador con `pdf.js`) — por eso siempre pasa por una pantalla
  de revisión manual antes de guardar.
