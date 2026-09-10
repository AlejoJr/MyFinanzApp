-- =====================================================================
-- MyFinanzApp · Verificacion post-migracion
-- Ejecutar en el SQL Editor tras aplicar 0001 a 0004.
--
-- El editor de Supabase solo muestra el resultado de la ULTIMA consulta,
-- asi que las comprobaciones van unidas en una sola tabla. Todas las
-- filas deben empezar por OK.
-- =====================================================================

with
-- 1) RLS activada y forzada en las tres tablas
rls as (
  select
    format('%s RLS en %s (activada=%s, forzada=%s)',
           case when c.relrowsecurity and c.relforcerowsecurity then 'OK' else 'FALLO' end,
           c.relname, c.relrowsecurity, c.relforcerowsecurity) as resultado,
    1 as orden, c.relname::text as sub
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in ('huchas', 'movimientos', 'gastos_fijos')
),
-- 2) Cuatro politicas por tabla (select / insert / update / delete)
politicas as (
  select
    format('%s %s politicas en %s (esperadas 4)',
           case when count(*) = 4 then 'OK' else 'FALLO' end,
           count(*), tablename) as resultado,
    2 as orden, tablename::text as sub
  from pg_policies
  where schemaname = 'public'
    and tablename in ('huchas', 'movimientos', 'gastos_fijos')
  group by tablename
),
-- 3) Ninguna politica debe estar abierta al rol anon
sin_anon as (
  select
    case when count(*) = 0
         then 'OK ninguna politica expuesta al rol anon'
         else format('FALLO %s politicas alcanzables por anon', count(*)) end as resultado,
    3 as orden, '' as sub
  from pg_policies
  where schemaname = 'public'
    and tablename in ('huchas', 'movimientos', 'gastos_fijos')
    and 'anon' = any (roles)
),
-- 4) Los cinco triggers deben existir
triggers as (
  select
    format('%s %s triggers creados (esperados 5)',
           case when count(*) = 5 then 'OK' else 'FALLO' end, count(*)) as resultado,
    4 as orden, '' as sub
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and not t.tgisinternal
    and c.relname in ('huchas', 'movimientos', 'gastos_fijos')
),
-- 5) Columnas clave de los puntos (a) y (b)
columnas as (
  select
    format('%s columna %s.%s',
           case when count(*) = 1 then 'OK' else 'FALLO falta' end,
           table_name, column_name) as resultado,
    5 as orden, (table_name || column_name)::text as sub
  from information_schema.columns
  where table_schema = 'public'
    and (   (table_name = 'movimientos'  and column_name = 'usuario_id')
         or (table_name = 'huchas'       and column_name = 'saldo_actual')
         or (table_name = 'gastos_fijos' and column_name = 'created_at'))
  group by table_name, column_name
),
-- 6) Indices
indices as (
  select
    format('%s %s indices propios creados (esperados 4)',
           case when count(*) = 4 then 'OK' else 'FALLO' end, count(*)) as resultado,
    6 as orden, '' as sub
  from pg_indexes
  where schemaname = 'public'
    and indexname in ('huchas_usuario_id_idx', 'movimientos_usuario_id_idx',
                      'movimientos_hucha_fecha_idx', 'gastos_fijos_usuario_id_idx')
),
-- 7) 0004: una hucha no puede quedar en negativo
restriccion as (
  select
    case when count(*) = 1
         then 'OK restriccion huchas_saldo_no_negativo creada'
         else 'FALLO falta la restriccion huchas_saldo_no_negativo (ejecuta 0004)' end as resultado,
    7 as orden, '' as sub
  from pg_constraint
  where conname = 'huchas_saldo_no_negativo'
    and conrelid = 'public.huchas'::regclass
),
-- 8) 0004: el recalculo bloquea la fila de la hucha antes de sumar
bloqueo as (
  select
    case when coalesce(bool_or(p.prosrc ilike '%for update%'), false)
         then 'OK el recalculo de saldo bloquea la hucha (sin carreras)'
         else 'FALLO el recalculo de saldo no bloquea la hucha (ejecuta 0004)' end as resultado,
    8 as orden, '' as sub
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'aplicar_saldo_hucha'
)
select resultado
from (
  select * from rls
  union all select * from politicas
  union all select * from sin_anon
  union all select * from triggers
  union all select * from columnas
  union all select * from indices
  union all select * from restriccion
  union all select * from bloqueo
) t
order by orden, sub;
