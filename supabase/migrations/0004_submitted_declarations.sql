-- =========================================================
-- Declaraciones ya presentadas: cuando alguien marca un vencimiento
-- como "presentado", deja de aparecer en la hoja de vencimientos y
-- pasa a la pestaña "Presentadas".
-- =========================================================

create table public.submitted_declarations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  responsibility_code text not null,
  period_label text not null,
  due_date date not null,
  submitted_at timestamptz not null default now(),
  submitted_by uuid references public.profiles (id),
  unique (company_id, responsibility_code, period_label, due_date)
);

alter table public.submitted_declarations enable row level security;

-- Puede ver quién tenga acceso a la empresa (admin, o colaborador asignado).
create policy "submitted_declarations_select"
  on public.submitted_declarations for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.user_company_access uca
      where uca.company_id = submitted_declarations.company_id and uca.user_id = auth.uid()
    )
  );

-- Solo el administrador puede marcar/desmarcar como presentada.
create policy "submitted_declarations_write_admin_only"
  on public.submitted_declarations for all
  using (public.is_admin())
  with check (public.is_admin());
