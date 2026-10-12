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
