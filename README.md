# Contaryx

Plataforma web (SaaS) para contadores colombianos, instalable como app (PWA)
en celular y computador. Cada despacho o firma contable que la compra tiene su
propio espacio aislado con sus empresas, colaboradores y estados financieros.

Módulos (cada uno se cobra por separado, suscripción mensual con Wompi):

| Módulo | Qué hace |
| --- | --- |
| **Vencimientos tributarios** | Calendario DIAN por NIT, ICA, nómina/PILA, correo semanal |
| **Estados financieros NIIF** | Juego completo según el grupo NIIF de cada empresa (1, 2 o 3), con verificación de cumplimiento y certificación, desde el balance de prueba |
| **Notas a los estados financieros** | Entidad, bases de preparación, políticas contables y una nota por rubro, editables |
| **Indicadores financieros** | Liquidez, endeudamiento, rentabilidad, actividad, EBITDA e indicadores RUP con interpretación |

Infraestructura a $0 de costo fijo: Next.js en Vercel (free tier), Supabase
(Postgres + Auth, free tier), Gmail SMTP y Wompi (solo cobra comisión por
transacción).

## 1. Requisitos

- Node.js 20+ (usa `node -v` para verificar)
- Cuentas gratuitas en [supabase.com](https://supabase.com),
  [github.com](https://github.com) y [vercel.com](https://vercel.com)
- Una cuenta de Gmail para enviar correos
- Una cuenta de comercio en [Wompi](https://comercios.wompi.co) para cobrar

## 2. Configurar Supabase

1. Crea un proyecto nuevo en Supabase (plan gratuito).
2. En **SQL Editor**, ejecuta en orden los archivos de `supabase/migrations/`
   (`0001` a `0006`). La `0006` agrega el grupo NIIF de cada empresa. La `0005` convierte la app en multi-despacho: si ya
   tenías datos, quedan en un "Despacho principal", los administradores
   actuales pasan a ser **dueños de la plataforma** y conservan todos los
   módulos activos por un año.
3. En **Storage**, crea un bucket llamado `calendarios-dian` (privado) y
   permite subir archivos solo a usuarios autenticados.
4. En **Authentication → Sign In / Providers**, deja activo correo/contraseña y
   **desactiva "Allow new users to sign up"**. El registro de despachos nuevos
   pasa por `/registro`, que valida los datos y envía la invitación desde el
   servidor.
5. En **Authentication → URL Configuration**, pon la URL pública de la app como
   *Site URL* y agrega `https://tu-app.vercel.app/actualizar-contrasena` en
   *Redirect URLs*.
6. **Muy importante para vender:** en **Authentication → Emails → SMTP
   Settings** configura un SMTP propio (puede ser el mismo Gmail del paso 3).
   El correo integrado de Supabase solo envía unos pocos correos por hora y
   los registros de clientes nuevos fallarían.
7. En **Project Settings → API**, copia `Project URL`, `anon public key` y
   `service_role key` (esta última es la llave maestra: nunca la compartas).
8. Si es una instalación nueva, crea tu usuario dueño de la plataforma:
   regístrate en `/registro` con tu despacho y luego, en **Table Editor →
   profiles**, marca `is_platform_owner = true` en tu fila.

## 3. Configurar el correo de Gmail

1. Activa la verificación en dos pasos en tu cuenta de Gmail.
2. Ve a [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
   y genera una "contraseña de aplicación".
3. Usa tu correo como `GMAIL_USER` y esa contraseña como `GMAIL_APP_PASSWORD`.

## 4. Configurar Wompi (cobros)

1. Crea tu cuenta de comercio en [comercios.wompi.co](https://comercios.wompi.co)
   (como persona natural o jurídica).
2. En **Desarrolladores**, copia:
   - Llave pública → `WOMPI_PUBLIC_KEY`
   - Secreto de integridad → `WOMPI_INTEGRITY_SECRET`
   - Secreto de eventos → `WOMPI_EVENTS_SECRET`
3. En **Desarrolladores → URL de eventos**, registra
   `https://tu-app.vercel.app/api/billing/webhook`.
4. Prueba primero con las llaves de **sandbox** (`pub_test_...`); la app usa el
   ambiente de pruebas o el de producción según la llave. Cuando todo funcione,
   cambia a las llaves de producción (`pub_prod_...`).

Cómo funciona el cobro: el administrador del despacho entra a **Plan y pagos**,
elige el módulo y el periodo (1, 6 o 12 meses, con 10 % y 20 % de descuento), paga
en Wompi y el módulo se activa solo cuando Wompi confirma el pago. Si un cliente
te paga por transferencia, actívalo a mano desde **Plataforma**.

## 5. Variables de entorno

```bash
cp .env.example .env.local
```

Completa todos los valores (Supabase, Gmail, `CRON_SECRET` y Wompi).

## 6. Correr en local

```bash
npm install
npm run dev
```

Abre http://localhost:3000: verás la página de venta. Entra con **Ingresar**.

## 7. Publicar en Vercel (gratis)

1. En Vercel, "Add New Project" → importa el repositorio.
2. En **Environment Variables**, agrega las mismas variables de `.env.local`.
3. Despliega. Vercel te da la URL pública; es la que compartes con tus clientes
   y la que se instala como app (Chrome → "Instalar app" / Safari → compartir
   → "Agregar a inicio"). Puedes conectar un dominio propio desde Vercel.

## 8. Activar el correo automático de los lunes

1. En GitHub → **Settings → Secrets and variables → Actions**, agrega
   `APP_URL` (URL pública sin `/` al final) y `CRON_SECRET`.
2. El workflow `.github/workflows/weekly-email.yml` corre los lunes 8:00 a. m.
   (hora Colombia). Solo reciben correo los despachos con Vencimientos activo.
   El correo trae los vencidos sin presentar, la semana en curso día por día y
   las 4 semanas siguientes (`SEMANAS_ADELANTE` en `src/lib/email/weekly-digest.ts`).

## 9. Uso

**Dueño de la plataforma (tú):**
- **Calendario DIAN**: sube el PDF oficial cada año; lo comparten todos los
  despachos (es parte del valor que vendes).
- **Plataforma**: despachos registrados, ingresos, activación manual de
  módulos y precios de cada módulo.

**Administrador de cada despacho (tu cliente):**
- **Empresas**: NIT, responsabilidades del RUT (casilla 53) y **grupo NIIF**
  (obligatorio). El grupo define el juego de estados financieros:
  - Grupo 1 (NIIF plenas): situación financiera, resultado y ORI (dividido según
    NIC 1.82A), cambios en el patrimonio, flujos de efectivo y notas, incluidas
    las de NIC 1.104 (gastos por naturaleza) y NIC 1.134 (gestión del capital).
  - Grupo 2 (NIIF para las PYMES): situación financiera, resultado integral,
    cambios en el patrimonio, flujos de efectivo y notas (Secciones 3 a 8).
  - Grupo 3 (microempresas): situación financiera, estado de resultados y
    notas; sin ORI ni impuesto diferido.
  Antes de emitir, la pestaña Estados muestra una verificación de cumplimiento
  con la norma citada en cada punto.
- **Usuarios**: invita colaboradores y asígnales empresas.
- **Estados financieros**: importa el balance de prueba en Excel (.xlsx) o CSV
  exportado de Siigo, World Office, Alegra, Helisa, ContaPyme, etc. La app:
  - detecta las columnas (código, nombre, saldo anterior, débitos, créditos,
    saldo final) y el formato de signos;
  - toma solo las cuentas de último nivel y verifica que débitos = créditos;
  - clasifica cada cuenta PUC en su rubro NIIF (reclasificable);
  - genera los 4 estados comparativos, las notas y los indicadores, para
    imprimir/guardar en PDF o descargar en Excel.
  Si subes también el balance del año anterior, el estado de resultados y los
  indicadores salen comparativos.
- **Plan y pagos**: activa y renueva módulos.

Los despachos nuevos tienen 14 días de prueba gratis con todos los módulos
(`TRIAL_DAYS` en `src/lib/billing/modules.ts`).

## 10. Antes de empezar a vender (Colombia)

- **Factura electrónica**: Wompi no factura por ti. Cada venta del servicio
  debe facturarse electrónicamente ante la DIAN (con un proveedor tecnológico o
  el facturador gratuito de la DIAN).
- **IVA**: evalúa si el servicio encaja en la exclusión de "computación en la
  nube" del numeral 24 del art. 476 del E.T. (reglamentada por el Decreto 1412
  de 2017) o si queda gravado al 19 %. Los precios se muestran "IVA incluido";
  ajústalos según tu análisis.
- **Datos personales**: completa la página `/terminos` (responsable, cédula/NIT,
  correo de contacto) y revísala con un abogado. Si tu base de datos lo
  requiere, regístrala en el RNBD de la SIC.
- **Responsabilidad profesional**: la app es una herramienta de apoyo; los
  estados financieros los revisa y certifica el contador público de cada
  empresa.

## Video de presentación

`public/video/contaryx-demo.mp4` (87 s, sin narración) aparece en la página de
inicio. Muestra cómo funciona Contaryx y sus beneficios para reducir riesgos y
aplicar bien la norma.

## Notas técnicas

- Aislamiento entre despachos con Row Level Security de Postgres
  (`supabase/migrations/0005_saas_multi_despacho.sql`): cada consulta solo ve
  filas del despacho del usuario, también en las tablas financieras.
- El rol y el despacho de un usuario nunca se toman de los datos que envía al
  registrarse: los asigna el servidor con la llave de servicio.
- Las suscripciones solo se extienden desde el servidor (webhook de Wompi
  verificado con firma, consulta de la transacción al API de Wompi o panel del
  dueño). El monto pagado debe coincidir exactamente con el del pago creado.
- Clasificación PUC → NIIF: `src/lib/financial/puc-mapping.ts`. Estados:
  `statements.ts`; notas: `notes.ts`; indicadores: `indicators.ts`.
- El parseo del PDF del calendario DIAN y del balance de prueba corre en el
  navegador y siempre pasa por una vista previa antes de guardar.
