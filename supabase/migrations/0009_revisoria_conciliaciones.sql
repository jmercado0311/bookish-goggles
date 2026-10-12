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
