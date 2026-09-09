-- =========================================================
-- Soporte para responsabilidades cuyo calendario DIAN usa los
-- ÚLTIMOS DOS dígitos del NIT (ej. "Renta - Personas naturales"),
-- en vez de un solo dígito como el resto de responsabilidades.
-- =========================================================

alter table public.tax_calendar
  drop constraint if exists tax_calendar_last_nit_digit_check;

alter table public.tax_calendar
  add constraint tax_calendar_last_nit_digit_check
  check (last_nit_digit between 0 and 99);

alter table public.tax_calendar
  add column if not exists match_mode text not null default 'last_digit'
  check (match_mode in ('last_digit', 'last_two_digits'));

comment on column public.tax_calendar.match_mode is
  'last_digit: last_nit_digit (0-9) se compara contra el último dígito del NIT. '
  'last_two_digits: last_nit_digit (0-99) se compara contra los últimos DOS dígitos del NIT '
  '(usado por Renta - Personas naturales).';
