-- =========================================================
-- Sistema de Vencimientos Tributarios - esquema inicial
-- =========================================================

-- ---------------------------------------------------------
-- profiles: espejo de auth.users con rol de aplicación
-- ---------------------------------------------------------
create type public.user_role as enum ('admin', 'colaborador');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role public.user_role not null default 'colaborador',
  created_at timestamptz not null default now()
);

-- Crea automáticamente el profile cuando se crea un usuario en auth.users
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'colaborador')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Helper: ¿el usuario actual es admin?
create function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ---------------------------------------------------------
-- companies: empresas gestionadas por el contador
-- ---------------------------------------------------------
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  nit text not null,
  dv text,
  razon_social text not null,
  nombre_comercial text,
  tipo_contribuyente text not null, -- ej. 'persona_natural' | 'persona_juridica'
  regimen text,                     -- ej. 'ordinario' | 'simple' | 'gran_contribuyente'
  municipio text,
  departamento text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (nit)
);

-- ---------------------------------------------------------
-- company_responsibilities: códigos de responsabilidad del RUT
-- ej. 05-Renta, 07-RteFuente, 48-IVA, 33-INC, 42-Contabilidad, 52-Facturador electrónico
-- ---------------------------------------------------------
create table public.company_responsibilities (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  code text not null,
  name text not null,
  unique (company_id, code)
);

-- ---------------------------------------------------------
-- company_ica: ICA municipal, opcional, no bloqueante
-- ---------------------------------------------------------
create table public.company_ica (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade unique,
  municipio text not null,
  periodicidad text not null default 'bimestral', -- 'bimestral' | 'anual' | etc.
  regla_dia_mes int,      -- fecha de vencimiento como día fijo recurrente (ej. día 15)
  fecha_puntual date      -- o como fecha puntual, si no es recurrente
);

-- ---------------------------------------------------------
-- tax_calendar: calendario oficial DIAN, cargado desde el PDF anual
-- ---------------------------------------------------------
create table public.tax_calendar (
  id uuid primary key default gen_random_uuid(),
  year int not null,
  responsibility_code text not null,  -- coincide con company_responsibilities.code
  last_nit_digit int not null check (last_nit_digit between 0 and 9),
  period_label text not null,         -- ej. 'Enero-Febrero', 'Cuota 1', etc.
  due_date date not null,
  created_at timestamptz not null default now(),
  unique (year, responsibility_code, last_nit_digit, period_label)
);

-- ---------------------------------------------------------
-- custom_obligations: nómina electrónica, PILA/parafiscales, otros
-- ---------------------------------------------------------
create table public.custom_obligations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  tipo text not null, -- 'nomina_electronica' | 'parafiscales_pila' | 'otro'
  nombre text not null,
  regla_dia_mes int,      -- si es una regla recurrente (día fijo del mes)
  fecha_puntual date,     -- si es una fecha única en vez de regla recurrente
  created_at timestamptz not null default now(),
  check (regla_dia_mes is not null or fecha_puntual is not null)
);

-- ---------------------------------------------------------
-- user_company_access: qué colaborador ve qué empresa (control del admin)
-- ---------------------------------------------------------
create table public.user_company_access (
  user_id uuid not null references public.profiles (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  granted_by uuid references public.profiles (id),
  granted_at timestamptz not null default now(),
  primary key (user_id, company_id)
);

-- ---------------------------------------------------------
-- calendar_uploads: trazabilidad de cada PDF subido
-- ---------------------------------------------------------
create table public.calendar_uploads (
  id uuid primary key default gen_random_uuid(),
  year int not null,
  file_path text not null, -- ruta en Supabase Storage
  status text not null default 'pendiente_revision', -- 'pendiente_revision' | 'confirmado'
  uploaded_by uuid references public.profiles (id),
  uploaded_at timestamptz not null default now(),
  confirmed_at timestamptz
);

-- =========================================================
-- Row Level Security
-- =========================================================

alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.company_responsibilities enable row level security;
alter table public.company_ica enable row level security;
alter table public.tax_calendar enable row level security;
alter table public.custom_obligations enable row level security;
alter table public.user_company_access enable row level security;
alter table public.calendar_uploads enable row level security;

-- profiles: cada usuario ve su propio perfil; admin ve todos
create policy "profiles_select_own_or_admin"
  on public.profiles for select
  using (id = auth.uid() or public.is_admin());

create policy "profiles_update_admin_only"
  on public.profiles for update
  using (public.is_admin());

-- companies: admin ve/gestiona todas; colaborador solo las asignadas
create policy "companies_select"
  on public.companies for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.user_company_access uca
      where uca.company_id = companies.id and uca.user_id = auth.uid()
    )
  );

create policy "companies_write_admin_only"
  on public.companies for all
  using (public.is_admin())
  with check (public.is_admin());

-- company_responsibilities: sigue el mismo acceso que companies
create policy "company_responsibilities_select"
  on public.company_responsibilities for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.user_company_access uca
      where uca.company_id = company_responsibilities.company_id and uca.user_id = auth.uid()
    )
  );

create policy "company_responsibilities_write_admin_only"
  on public.company_responsibilities for all
  using (public.is_admin())
  with check (public.is_admin());

-- company_ica: mismo patrón
create policy "company_ica_select"
  on public.company_ica for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.user_company_access uca
      where uca.company_id = company_ica.company_id and uca.user_id = auth.uid()
    )
  );

create policy "company_ica_write_admin_only"
  on public.company_ica for all
  using (public.is_admin())
  with check (public.is_admin());

-- custom_obligations: mismo patrón
create policy "custom_obligations_select"
  on public.custom_obligations for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.user_company_access uca
      where uca.company_id = custom_obligations.company_id and uca.user_id = auth.uid()
    )
  );

create policy "custom_obligations_write_admin_only"
  on public.custom_obligations for all
  using (public.is_admin())
  with check (public.is_admin());

-- tax_calendar: lectura para cualquier usuario autenticado (no depende de empresa),
-- escritura solo admin
create policy "tax_calendar_select_authenticated"
  on public.tax_calendar for select
  using (auth.role() = 'authenticated');

create policy "tax_calendar_write_admin_only"
  on public.tax_calendar for all
  using (public.is_admin())
  with check (public.is_admin());

-- user_company_access: admin gestiona todo; colaborador puede ver sus propias asignaciones
create policy "user_company_access_select"
  on public.user_company_access for select
  using (user_id = auth.uid() or public.is_admin());

create policy "user_company_access_write_admin_only"
  on public.user_company_access for all
  using (public.is_admin())
  with check (public.is_admin());

-- calendar_uploads: solo admin (es quien sube y revisa el calendario DIAN)
create policy "calendar_uploads_admin_only"
  on public.calendar_uploads for all
  using (public.is_admin())
  with check (public.is_admin());
