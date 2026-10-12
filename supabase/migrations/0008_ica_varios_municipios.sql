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
