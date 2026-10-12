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
