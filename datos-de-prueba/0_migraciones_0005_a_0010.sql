-- ===== supabase/migrations/0005_saas_multi_despacho.sql =====
-- =========================================================
-- SaaS multi-despacho + suscripciones por módulo + estados financieros NIIF
--
-- 1. organizations: cada despacho/contador que compra la app tiene su propio
--    espacio. Sus empresas, colaboradores y estados financieros quedan
--    aislados del resto mediante RLS.
-- 2. service_modules / organization_subscriptions / payments: catálogo de
--    módulos que se venden por separado, vigencia de cada módulo por
--    despacho y trazabilidad de cada pago (Wompi o activación manual).
-- 3. trial_balances / trial_balance_lines / financial_notes: balance de
--    prueba importado desde Excel, base de los estados financieros, notas
--    e indicadores.
--
-- Los datos existentes quedan en un despacho inicial y los administradores
-- actuales pasan a ser "dueños de la plataforma" (pueden cargar el
-- calendario DIAN que comparten todos los despachos y administrar ventas).
-- =========================================================

-- ---------------------------------------------------------
-- organizations
-- ---------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  nit text,
  contact_email text,
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column organization_id uuid references public.organizations (id) on delete cascade,
  add column is_platform_owner boolean not null default false;

-- Despacho inicial con los datos que ya existían
do $$
declare
  org_id uuid;
begin
  if exists (select 1 from public.profiles) or exists (select 1 from public.companies) then
    insert into public.organizations (name) values ('Despacho principal') returning id into org_id;
    update public.profiles set organization_id = org_id;
    update public.profiles set is_platform_owner = true where role = 'admin';
  end if;
end $$;

-- El trigger ya NO confía en raw_user_meta_data para rol ni despacho: esos
-- datos los puede enviar cualquiera que se registre. El rol y el despacho
-- los asigna el servidor (service role) justo después de crear el usuario.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    'colaborador'
  );
  return new;
end;
$$;

create function public.current_org_id()
returns uuid
language sql
security definer set search_path = public
stable
as $$
  select organization_id from public.profiles where id = auth.uid();
$$;

create function public.is_platform_owner()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select coalesce((select is_platform_owner from public.profiles where id = auth.uid()), false);
$$;

-- ---------------------------------------------------------
-- companies pertenecen a un despacho; el NIT es único dentro del despacho
-- (dos contadores distintos pueden llevar la misma empresa).
-- ---------------------------------------------------------
alter table public.companies
  add column organization_id uuid references public.organizations (id) on delete cascade;

update public.companies
set organization_id = (select id from public.organizations order by created_at limit 1)
where organization_id is null;

alter table public.companies
  alter column organization_id set not null,
  alter column organization_id set default public.current_org_id();

alter table public.companies drop constraint if exists companies_nit_key;
alter table public.companies add constraint companies_org_nit_key unique (organization_id, nit);

create index companies_organization_id_idx on public.companies (organization_id);

-- Helpers de acceso por empresa, usados por todas las políticas
create function public.can_read_company(target uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.companies c
    where c.id = target
      and c.organization_id = public.current_org_id()
      and (
        public.is_admin()
        or exists (
          select 1 from public.user_company_access uca
          where uca.company_id = c.id and uca.user_id = auth.uid()
        )
      )
  );
$$;

create function public.can_write_company(target uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select public.is_admin() and exists (
    select 1 from public.companies c
    where c.id = target and c.organization_id = public.current_org_id()
  );
$$;

-- ---------------------------------------------------------
-- Políticas RLS reescritas con aislamiento por despacho
-- ---------------------------------------------------------
alter table public.organizations enable row level security;

create policy "organizations_select_own"
  on public.organizations for select
  using (id = public.current_org_id() or public.is_platform_owner());

create policy "organizations_update_admin"
  on public.organizations for update
  using (id = public.current_org_id() and public.is_admin())
  with check (id = public.current_org_id() and public.is_admin());

-- profiles
drop policy "profiles_select_own_or_admin" on public.profiles;
drop policy "profiles_update_admin_only" on public.profiles;

create policy "profiles_select"
  on public.profiles for select
  using (
    id = auth.uid()
    or (public.is_admin() and organization_id = public.current_org_id())
    or public.is_platform_owner()
  );
-- Sin política de update: rol, despacho y dueño de plataforma solo los cambia el servidor.

-- companies
drop policy "companies_select" on public.companies;
drop policy "companies_write_admin_only" on public.companies;

-- En companies las políticas leen las columnas de la propia fila (no
-- can_read_company): un INSERT ... RETURNING evalúa la política de select
-- sobre la fila nueva, que todavía no es visible para una consulta aparte.
create policy "companies_select"
  on public.companies for select
  using (
    organization_id = public.current_org_id()
    and (
      public.is_admin()
      or exists (
        select 1 from public.user_company_access uca
        where uca.company_id = companies.id and uca.user_id = auth.uid()
      )
    )
  );

create policy "companies_insert"
  on public.companies for insert
  with check (public.is_admin() and organization_id = public.current_org_id());

create policy "companies_update"
  on public.companies for update
  using (public.is_admin() and organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

create policy "companies_delete"
  on public.companies for delete
  using (public.is_admin() and organization_id = public.current_org_id());

-- company_responsibilities
drop policy "company_responsibilities_select" on public.company_responsibilities;
drop policy "company_responsibilities_write_admin_only" on public.company_responsibilities;

create policy "company_responsibilities_select"
  on public.company_responsibilities for select
  using (public.can_read_company(company_id));

create policy "company_responsibilities_write"
  on public.company_responsibilities for all
  using (public.can_write_company(company_id))
  with check (public.can_write_company(company_id));

-- company_ica
drop policy "company_ica_select" on public.company_ica;
drop policy "company_ica_write_admin_only" on public.company_ica;

create policy "company_ica_select"
  on public.company_ica for select
  using (public.can_read_company(company_id));

create policy "company_ica_write"
  on public.company_ica for all
  using (public.can_write_company(company_id))
  with check (public.can_write_company(company_id));

-- custom_obligations
drop policy "custom_obligations_select" on public.custom_obligations;
drop policy "custom_obligations_write_admin_only" on public.custom_obligations;

create policy "custom_obligations_select"
  on public.custom_obligations for select
  using (public.can_read_company(company_id));

create policy "custom_obligations_write"
  on public.custom_obligations for all
  using (public.can_write_company(company_id))
  with check (public.can_write_company(company_id));

-- submitted_declarations
drop policy "submitted_declarations_select" on public.submitted_declarations;
drop policy "submitted_declarations_write_admin_only" on public.submitted_declarations;

create policy "submitted_declarations_select"
  on public.submitted_declarations for select
  using (public.can_read_company(company_id));

create policy "submitted_declarations_write"
  on public.submitted_declarations for all
  using (public.can_write_company(company_id))
  with check (public.can_write_company(company_id));

-- user_company_access: empresa y colaborador deben ser del mismo despacho
drop policy "user_company_access_select" on public.user_company_access;
drop policy "user_company_access_write_admin_only" on public.user_company_access;

create policy "user_company_access_select"
  on public.user_company_access for select
  using (user_id = auth.uid() or public.can_write_company(company_id));

create policy "user_company_access_write"
  on public.user_company_access for all
  using (public.can_write_company(company_id))
  with check (
    public.can_write_company(company_id)
    and exists (
      select 1 from public.profiles p
      where p.id = user_id and p.organization_id = public.current_org_id()
    )
  );

-- tax_calendar / calendar_uploads: el calendario DIAN es común a todos los
-- despachos y lo mantiene el dueño de la plataforma.
drop policy "tax_calendar_write_admin_only" on public.tax_calendar;
create policy "tax_calendar_write_platform_owner"
  on public.tax_calendar for all
  using (public.is_platform_owner())
  with check (public.is_platform_owner());

drop policy "calendar_uploads_admin_only" on public.calendar_uploads;
create policy "calendar_uploads_platform_owner"
  on public.calendar_uploads for all
  using (public.is_platform_owner())
  with check (public.is_platform_owner());

-- =========================================================
-- Módulos, suscripciones y pagos
-- =========================================================
create table public.service_modules (
  code text primary key,
  name text not null,
  description text not null,
  price_cop integer not null check (price_cop >= 0), -- precio mensual, IVA incluido
  sort_order int not null default 0,
  active boolean not null default true
);

insert into public.service_modules (code, name, description, price_cop, sort_order) values
  ('vencimientos', 'Vencimientos tributarios',
   'Calendario DIAN por NIT, ICA, nómina y PILA, alertas y correo semanal para todo el equipo.',
   49900, 1),
  ('estados_financieros', 'Estados financieros NIIF',
   'Estado de situación financiera, resultados integral, cambios en el patrimonio y flujos de efectivo (método indirecto) desde el balance de prueba.',
   59900, 2),
  ('notas', 'Notas a los estados financieros',
   'Notas de revelación NIIF generadas desde el balance de prueba: entidad, bases de preparación, políticas contables y detalle por rubro, editables.',
   39900, 3),
  ('indicadores', 'Indicadores financieros',
   'Liquidez, endeudamiento, rentabilidad, actividad y EBITDA con interpretación automática y comparativo.',
   29900, 4);

alter table public.service_modules enable row level security;

-- El catálogo de precios es público (se muestra en la página de venta)
create policy "service_modules_select_all"
  on public.service_modules for select
  using (true);

create policy "service_modules_write_platform_owner"
  on public.service_modules for all
  using (public.is_platform_owner())
  with check (public.is_platform_owner());

create table public.organization_subscriptions (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  module_code text not null references public.service_modules (code),
  active_until timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (organization_id, module_code)
);

alter table public.organization_subscriptions enable row level security;

create policy "organization_subscriptions_select"
  on public.organization_subscriptions for select
  using (organization_id = public.current_org_id() or public.is_platform_owner());
-- Escritura solo desde el servidor (webhook de pago o panel del dueño)

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  module_code text not null references public.service_modules (code),
  months int not null default 1 check (months between 1 and 12),
  reference text not null unique,
  amount_in_cents bigint not null,
  status text not null default 'PENDING', -- PENDING | APPROVED | DECLINED | VOIDED | ERROR | MANUAL
  provider text not null default 'wompi', -- wompi | manual
  provider_transaction_id text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

alter table public.payments enable row level security;

create policy "payments_select"
  on public.payments for select
  using (
    (organization_id = public.current_org_id() and public.is_admin())
    or public.is_platform_owner()
  );

-- ¿El despacho del usuario actual tiene el módulo vigente?
create function public.has_module(module text)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select public.is_platform_owner() or exists (
    select 1 from public.organization_subscriptions s
    where s.organization_id = public.current_org_id()
      and s.module_code = module
      and s.active_until > now()
  );
$$;

-- Extiende la vigencia de un módulo (usada al aprobar un pago).
-- Si el módulo está vigente, suma desde su vencimiento; si no, desde hoy.
create function public.extend_subscription(org uuid, module text, months int)
returns timestamptz
language plpgsql
security definer set search_path = public
as $$
declare
  new_until timestamptz;
begin
  insert into public.organization_subscriptions as s (organization_id, module_code, active_until)
  values (org, module, now() + make_interval(months => months))
  on conflict (organization_id, module_code) do update
    set active_until = greatest(s.active_until, now()) + make_interval(months => months),
        updated_at = now()
  returning active_until into new_until;
  return new_until;
end;
$$;

revoke execute on function public.extend_subscription(uuid, text, int) from public, anon, authenticated;

-- Los despachos que ya existían conservan todo activo por un año
insert into public.organization_subscriptions (organization_id, module_code, active_until)
select o.id, m.code, now() + interval '1 year'
from public.organizations o cross join public.service_modules m;

-- =========================================================
-- Balance de prueba y estados financieros
-- =========================================================
create table public.trial_balances (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  period_start date not null,
  period_end date not null,
  source_file_name text,
  framework text not null default 'grupo2'
    check (framework in ('grupo1', 'grupo2', 'grupo3')), -- NIIF plenas / NIIF PYMES / microempresas
  representante_legal text,
  contador_nombre text,
  contador_tp text,
  revisor_fiscal_nombre text,
  revisor_fiscal_tp text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  check (period_end >= period_start),
  unique (company_id, period_end)
);

create index trial_balances_company_idx on public.trial_balances (company_id);

-- Saldos con signo: positivo = naturaleza débito, negativo = naturaleza crédito.
create table public.trial_balance_lines (
  id uuid primary key default gen_random_uuid(),
  trial_balance_id uuid not null references public.trial_balances (id) on delete cascade,
  account_code text not null,
  account_name text not null,
  saldo_anterior numeric(20, 2) not null default 0,
  debitos numeric(20, 2) not null default 0,
  creditos numeric(20, 2) not null default 0,
  saldo_final numeric(20, 2) not null default 0,
  rubro text not null, -- clasificación NIIF (ver src/lib/financial/puc-mapping.ts)
  unique (trial_balance_id, account_code)
);

create index trial_balance_lines_tb_idx on public.trial_balance_lines (trial_balance_id);

-- Textos editables de las notas (lo no editado se genera automáticamente)
create table public.financial_notes (
  trial_balance_id uuid not null references public.trial_balances (id) on delete cascade,
  note_key text not null,
  content text not null,
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  primary key (trial_balance_id, note_key)
);

alter table public.trial_balances enable row level security;
alter table public.trial_balance_lines enable row level security;
alter table public.financial_notes enable row level security;

create policy "trial_balances_select"
  on public.trial_balances for select
  using (public.can_read_company(company_id));

create policy "trial_balances_write"
  on public.trial_balances for all
  using (public.can_write_company(company_id))
  with check (public.can_write_company(company_id));

create function public.trial_balance_company(tb uuid)
returns uuid
language sql
security definer set search_path = public
stable
as $$
  select company_id from public.trial_balances where id = tb;
$$;

create policy "trial_balance_lines_select"
  on public.trial_balance_lines for select
  using (public.can_read_company(public.trial_balance_company(trial_balance_id)));

create policy "trial_balance_lines_write"
  on public.trial_balance_lines for all
  using (public.can_write_company(public.trial_balance_company(trial_balance_id)))
  with check (public.can_write_company(public.trial_balance_company(trial_balance_id)));

create policy "financial_notes_select"
  on public.financial_notes for select
  using (public.can_read_company(public.trial_balance_company(trial_balance_id)));

create policy "financial_notes_write"
  on public.financial_notes for all
  using (public.can_write_company(public.trial_balance_company(trial_balance_id)))
  with check (public.can_write_company(public.trial_balance_company(trial_balance_id)));

-- ===== supabase/migrations/0006_grupo_niif_empresa.sql =====
-- =========================================================
-- Grupo NIIF de cada empresa (Decreto 2420 de 2015): determina qué
-- estados financieros, notas y requisitos de presentación aplican.
-- NULL = todavía no se ha indicado; la app lo pide antes de generar
-- estados financieros.
-- =========================================================

alter table public.companies
  add column if not exists niif_grupo text
  check (niif_grupo is null or niif_grupo in ('grupo1', 'grupo2', 'grupo3'));

comment on column public.companies.niif_grupo is
  'Grupo 1 (NIIF plenas), Grupo 2 (NIIF para las PYMES) o Grupo 3 (microempresas). '
  'Los balances de prueba guardan en trial_balances.framework el grupo vigente al importarlos.';

-- ===== supabase/migrations/0007_calendario_ica_despacho.sql =====
-- =========================================================
-- Calendario de ICA por municipio, cargado por cada despacho.
--
-- A diferencia del calendario DIAN (nacional, lo mantiene el dueño de la
-- plataforma), el ICA es municipal: cada despacho carga los calendarios de
-- los municipios donde tienen domicilio sus clientes. Las fechas solo las
-- ve el despacho que las cargó.
--
-- last_nit_digit NULL = la fecha aplica a todos los contribuyentes del
-- municipio; 0-9 = solo a los NIT terminados en ese dígito.
-- =========================================================

create table public.ica_calendar (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id()
    references public.organizations (id) on delete cascade,
  municipio text not null,
  year int not null check (year between 2000 and 2100),
  periodicidad text not null
    check (periodicidad in ('mensual', 'bimestral', 'cuatrimestral', 'semestral', 'anual')),
  period_label text not null,
  due_date date not null,
  last_nit_digit int check (last_nit_digit between 0 and 9),
  source_file_name text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create unique index ica_calendar_unique_idx on public.ica_calendar (
  organization_id, lower(municipio), year, periodicidad, period_label, coalesce(last_nit_digit, -1)
);
create index ica_calendar_org_idx on public.ica_calendar (organization_id, year);

alter table public.ica_calendar enable row level security;

create policy "ica_calendar_select"
  on public.ica_calendar for select
  using (organization_id = public.current_org_id());

create policy "ica_calendar_write"
  on public.ica_calendar for all
  using (organization_id = public.current_org_id() and public.is_admin())
  with check (organization_id = public.current_org_id() and public.is_admin());

-- Periodicidades de ICA de la empresa alineadas con las del calendario
alter table public.company_ica drop constraint if exists company_ica_periodicidad_check;
alter table public.company_ica
  add constraint company_ica_periodicidad_check
  check (periodicidad in ('mensual', 'bimestral', 'cuatrimestral', 'semestral', 'anual'));

-- ===== supabase/migrations/0008_ica_varios_municipios.sql =====
-- =========================================================
-- Una empresa puede declarar ICA en varios municipios (tiene sucursales,
-- obras o actividades gravadas en más de una ciudad). company_ica deja de
-- ser una sola fila por empresa: ahora hay una fila por municipio.
-- =========================================================

alter table public.company_ica drop constraint if exists company_ica_company_id_key;

-- Un municipio una sola vez por empresa (sin distinguir mayúsculas)
create unique index if not exists company_ica_company_municipio_idx
  on public.company_ica (company_id, lower(trim(municipio)));

-- Las declaraciones de ICA marcadas como presentadas pasan a identificar
-- su municipio ("ICA:<municipio normalizado>"), para que marcar presentada
-- la de un municipio no marque la de otro. Normalización igual a la de la
-- app: minúsculas, sin tildes y con espacios simples.
create or replace function public.normalize_municipio(name text)
returns text
language sql
immutable
as $$
  select regexp_replace(
    translate(lower(trim(name)), 'áéíóúüñàèìòùâêîôûäëïö', 'aeiouunaeiouaeiouaeio'),
    '\s+', ' ', 'g'
  );
$$;

update public.submitted_declarations sd
set responsibility_code = 'ICA:' || public.normalize_municipio(ci.municipio)
from public.company_ica ci
where sd.company_id = ci.company_id
  and sd.responsibility_code = 'ICA';

-- ===== supabase/migrations/0009_revisoria_conciliaciones.sql =====
-- =========================================================
-- Módulos "Revisoría fiscal" y "Conciliaciones y auxiliares"
-- =========================================================

insert into public.service_modules (code, name, description, price_cop, sort_order) values
  ('conciliaciones', 'Conciliaciones y auxiliares',
   'Conciliación bancaria automática con extractos de cualquier banco (Excel, CSV o PDF) y lectura de libros auxiliares de cualquier sistema contable.',
   39900, 5),
  ('revisoria', 'Revisoría fiscal',
   'Materialidad, matriz de riesgos, papeles de trabajo, hallazgos, dictamen según NIA 700/705/706, informe del art. 209 del C. de Co. y carta de representación.',
   79900, 6)
on conflict (code) do nothing;

-- ---------------------------------------------------------
-- Extractos y auxiliares importados
-- ---------------------------------------------------------
create table public.ledger_imports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  kind text not null check (kind in ('extracto', 'auxiliar')),
  label text not null,              -- ej. "Bancolombia ahorros 1234" o "Auxiliar enero 2026"
  period_start date,
  period_end date,
  source_file_name text,
  method text not null default 'reglas' check (method in ('reglas', 'ia', 'manual')),
  mapping jsonb,
  movement_count int not null default 0,
  saldo_inicial numeric(20, 2),
  saldo_final numeric(20, 2),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index ledger_imports_company_idx on public.ledger_imports (company_id, kind);

-- valor: perspectiva de la empresa, positivo = entra dinero
create table public.ledger_movements (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.ledger_imports (id) on delete cascade,
  row_number int not null,
  fecha date not null,
  descripcion text not null default '',
  documento text not null default '',
  tercero text not null default '',
  nit text not null default '',
  cuenta text not null default '',
  cuenta_nombre text not null default '',
  debito numeric(20, 2) not null default 0,
  credito numeric(20, 2) not null default 0,
  saldo numeric(20, 2),
  valor numeric(20, 2) not null
);
create index ledger_movements_import_idx on public.ledger_movements (import_id, fecha);
create index ledger_movements_cuenta_idx on public.ledger_movements (import_id, cuenta);

create table public.bank_reconciliations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  cuenta_label text not null,       -- ej. "Bancolombia ahorros 1234"
  cuenta_contable text,             -- ej. 11100501 (filtra el auxiliar si trae varias cuentas)
  period_end date not null,
  bank_import_id uuid not null references public.ledger_imports (id) on delete cascade,
  ledger_import_id uuid not null references public.ledger_imports (id) on delete cascade,
  saldo_extracto numeric(20, 2) not null,
  saldo_libros numeric(20, 2) not null,
  tolerance_days int not null default 5 check (tolerance_days between 0 and 31),
  matches jsonb not null default '[]',
  notes text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index bank_reconciliations_company_idx on public.bank_reconciliations (company_id, period_end);

-- Consumo de IA por despacho (control de costos del dueño de la plataforma)
create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  purpose text not null,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- Revisoría fiscal
-- ---------------------------------------------------------
create table public.audit_engagements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  trial_balance_id uuid references public.trial_balances (id) on delete set null,
  period_end date not null,
  materialidad_base text not null default 'activos'
    check (materialidad_base in ('activos', 'ingresos', 'utilidad', 'patrimonio')),
  materialidad_porcentaje numeric(6, 3) not null default 1,
  materialidad_global numeric(20, 2) not null default 0,
  materialidad_ejecucion numeric(20, 2) not null default 0,
  umbral_trivial numeric(20, 2) not null default 0,
  revisor_nombre text,
  revisor_tp text,
  firma_designante text,            -- firma de revisoría que designa, si aplica
  ciudad text,
  fecha_informe date,
  opinion text not null default 'favorable'
    check (opinion in ('favorable', 'con_salvedades', 'desfavorable', 'abstencion')),
  generalizado boolean not null default false,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (company_id, period_end)
);

create table public.audit_risks (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.audit_engagements (id) on delete cascade,
  area text not null,
  afirmacion text not null,
  descripcion text not null,
  riesgo_inherente text not null default 'medio' check (riesgo_inherente in ('alto', 'medio', 'bajo')),
  riesgo_control text not null default 'medio' check (riesgo_control in ('alto', 'medio', 'bajo')),
  significativo boolean not null default false,
  respuesta text not null default '',
  sort int not null default 0
);

create table public.audit_workpapers (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.audit_engagements (id) on delete cascade,
  ref text not null,
  area text not null,
  titulo text not null,
  objetivo text not null default '',
  procedimientos text not null default '',
  resultado text not null default '',
  conclusion text not null default '',
  estado text not null default 'pendiente' check (estado in ('pendiente', 'en_proceso', 'terminado')),
  preparado_por text,
  revisado_por text,
  fecha_preparacion date,
  fecha_revision date,
  sort int not null default 0,
  unique (engagement_id, ref)
);

create table public.audit_findings (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.audit_engagements (id) on delete cascade,
  workpaper_ref text,
  titulo text not null,
  condicion text not null default '',
  criterio text not null default '',
  causa text not null default '',
  efecto text not null default '',
  recomendacion text not null default '',
  monto numeric(20, 2) not null default 0,
  tipo text not null default 'incorreccion'
    check (tipo in ('incorreccion', 'control_interno', 'incumplimiento_legal', 'otro')),
  corregido boolean not null default false,
  created_at timestamptz not null default now()
);

-- Textos editados del dictamen, informe del art. 209 y carta de representación
create table public.audit_documents (
  engagement_id uuid not null references public.audit_engagements (id) on delete cascade,
  doc_key text not null,
  content text not null,
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  primary key (engagement_id, doc_key)
);

-- ---------------------------------------------------------
-- RLS: todo depende del acceso a la empresa
-- ---------------------------------------------------------
create function public.ledger_import_company(imp uuid)
returns uuid language sql security definer set search_path = public stable as $$
  select company_id from public.ledger_imports where id = imp;
$$;

create function public.engagement_company(eng uuid)
returns uuid language sql security definer set search_path = public stable as $$
  select company_id from public.audit_engagements where id = eng;
$$;

alter table public.ledger_imports enable row level security;
alter table public.ledger_movements enable row level security;
alter table public.bank_reconciliations enable row level security;
alter table public.ai_usage enable row level security;
alter table public.audit_engagements enable row level security;
alter table public.audit_risks enable row level security;
alter table public.audit_workpapers enable row level security;
alter table public.audit_findings enable row level security;
alter table public.audit_documents enable row level security;

create policy "ledger_imports_select" on public.ledger_imports for select
  using (public.can_read_company(company_id));
create policy "ledger_imports_write" on public.ledger_imports for all
  using (public.can_write_company(company_id)) with check (public.can_write_company(company_id));

create policy "ledger_movements_select" on public.ledger_movements for select
  using (public.can_read_company(public.ledger_import_company(import_id)));
create policy "ledger_movements_write" on public.ledger_movements for all
  using (public.can_write_company(public.ledger_import_company(import_id)))
  with check (public.can_write_company(public.ledger_import_company(import_id)));

create policy "bank_reconciliations_select" on public.bank_reconciliations for select
  using (public.can_read_company(company_id));
create policy "bank_reconciliations_write" on public.bank_reconciliations for all
  using (public.can_write_company(company_id)) with check (public.can_write_company(company_id));

create policy "ai_usage_select" on public.ai_usage for select
  using ((organization_id = public.current_org_id() and public.is_admin()) or public.is_platform_owner());
-- Escritura solo desde el servidor

create policy "audit_engagements_select" on public.audit_engagements for select
  using (public.can_read_company(company_id));
create policy "audit_engagements_write" on public.audit_engagements for all
  using (public.can_write_company(company_id)) with check (public.can_write_company(company_id));

create policy "audit_risks_select" on public.audit_risks for select
  using (public.can_read_company(public.engagement_company(engagement_id)));
create policy "audit_risks_write" on public.audit_risks for all
  using (public.can_write_company(public.engagement_company(engagement_id)))
  with check (public.can_write_company(public.engagement_company(engagement_id)));

create policy "audit_workpapers_select" on public.audit_workpapers for select
  using (public.can_read_company(public.engagement_company(engagement_id)));
create policy "audit_workpapers_write" on public.audit_workpapers for all
  using (public.can_write_company(public.engagement_company(engagement_id)))
  with check (public.can_write_company(public.engagement_company(engagement_id)));

create policy "audit_findings_select" on public.audit_findings for select
  using (public.can_read_company(public.engagement_company(engagement_id)));
create policy "audit_findings_write" on public.audit_findings for all
  using (public.can_write_company(public.engagement_company(engagement_id)))
  with check (public.can_write_company(public.engagement_company(engagement_id)));

create policy "audit_documents_select" on public.audit_documents for select
  using (public.can_read_company(public.engagement_company(engagement_id)));
create policy "audit_documents_write" on public.audit_documents for all
  using (public.can_write_company(public.engagement_company(engagement_id)))
  with check (public.can_write_company(public.engagement_company(engagement_id)));

-- ===== supabase/migrations/0010_revisoria_opcional_whatsapp.sql =====
-- =========================================================
-- 1. La revisoría fiscal no es para todos:
--    - por despacho: solo quienes ejercen revisoría fiscal la ven y la prueban;
--    - por empresa: solo las empresas con revisor fiscal (obligadas por ley
--      o por estatutos) tienen encargos, firma y dictamen del revisor.
-- 2. Asistente de ventas por WhatsApp: contactos, mensajes y prospectos.
--    Solo los ve el dueño de la plataforma.
-- =========================================================

alter table public.organizations
  add column if not exists ejerce_revisoria boolean not null default false;

-- Se asume que la ejercen los despachos con el módulo vigente y el despacho
-- del dueño de la plataforma
update public.organizations o
set ejerce_revisoria = true
where exists (
  select 1 from public.organization_subscriptions s
  where s.organization_id = o.id and s.module_code = 'revisoria' and s.active_until > now()
) or exists (
  select 1 from public.profiles p
  where p.organization_id = o.id and p.is_platform_owner
);

alter table public.companies
  add column if not exists tiene_revisor_fiscal boolean not null default false,
  add column if not exists tipo_societario text;

comment on column public.companies.tiene_revisor_fiscal is
  'La empresa tiene revisor fiscal (obligada por el art. 203 C. de Co., el par. 2 del art. 13 de la Ley 43 de 1990, norma especial o estatutos).';

-- Un encargo de revisoría solo para empresas con revisor fiscal
create or replace function public.check_engagement_company()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.companies where id = new.company_id and tiene_revisor_fiscal) then
    raise exception 'La empresa no está marcada como empresa con revisor fiscal.';
  end if;
  return new;
end;
$$;

create trigger audit_engagements_company_check
  before insert on public.audit_engagements
  for each row execute procedure public.check_engagement_company();

-- ---------------------------------------------------------
-- WhatsApp
-- ---------------------------------------------------------
create table public.whatsapp_contacts (
  id uuid primary key default gen_random_uuid(),
  wa_id text not null unique,          -- número en formato internacional sin "+"
  nombre text,
  opted_out boolean not null default false,
  handed_off boolean not null default false,  -- conversación pasada a una persona
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create table public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.whatsapp_contacts (id) on delete cascade,
  direction text not null check (direction in ('in', 'out')),
  body text not null,
  wa_message_id text unique,
  sent_by text not null default 'asistente' check (sent_by in ('cliente', 'asistente', 'humano')),
  created_at timestamptz not null default now()
);
create index whatsapp_messages_contact_idx on public.whatsapp_messages (contact_id, created_at);

create table public.sales_leads (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.whatsapp_contacts (id) on delete set null,
  canal text not null default 'whatsapp',
  nombre text,
  despacho text,
  ciudad text,
  email text,
  num_empresas int,
  ejerce_revisoria boolean,
  intereses text[] not null default '{}',
  notas text,
  estado text not null default 'nuevo' check (estado in ('nuevo', 'contactado', 'en_prueba', 'ganado', 'perdido')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.whatsapp_contacts enable row level security;
alter table public.whatsapp_messages enable row level security;
alter table public.sales_leads enable row level security;

create policy "whatsapp_contacts_owner" on public.whatsapp_contacts for all
  using (public.is_platform_owner()) with check (public.is_platform_owner());
create policy "whatsapp_messages_owner" on public.whatsapp_messages for all
  using (public.is_platform_owner()) with check (public.is_platform_owner());
create policy "sales_leads_owner" on public.sales_leads for all
  using (public.is_platform_owner()) with check (public.is_platform_owner());

