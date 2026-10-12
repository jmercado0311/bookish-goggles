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
