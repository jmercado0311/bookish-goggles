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
