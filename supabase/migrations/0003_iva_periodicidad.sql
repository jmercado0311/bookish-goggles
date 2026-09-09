-- =========================================================
-- Distinguir empresas con IVA bimestral vs. cuatrimestral, ya que
-- comparten el mismo código de responsabilidad ("48") pero tienen
-- calendarios de vencimiento distintos. Lo mismo aplica al INC ("33"),
-- que sigue las mismas fechas que el IVA de cada empresa.
-- =========================================================

alter table public.companies
  add column if not exists iva_periodicidad text not null default 'bimestral'
  check (iva_periodicidad in ('bimestral', 'cuatrimestral'));

alter table public.tax_calendar
  add column if not exists periodicidad text
  check (periodicidad is null or periodicidad in ('bimestral', 'cuatrimestral'));

comment on column public.companies.iva_periodicidad is
  'Periodicidad de IVA de la empresa (depende de sus ingresos del año anterior). '
  'Determina qué filas de tax_calendar (código 48 y 33) le aplican.';

comment on column public.tax_calendar.periodicidad is
  'Solo aplica a responsabilidades 48 (IVA) y 33 (INC): bimestral o cuatrimestral. '
  'NULL para el resto de responsabilidades, donde no aplica esta distinción.';

-- Las 120 filas de IVA/INC bimestral ya cargadas quedan marcadas explícitamente
-- como 'bimestral' para que seleccionar por periodicidad no las deje huérfanas.
update public.tax_calendar
set periodicidad = 'bimestral'
where responsibility_code in ('48', '33') and periodicidad is null;
