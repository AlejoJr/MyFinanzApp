-- =====================================================================
-- MyFinanzApp · Verificacion post-migracion
-- Ejecutar en el SQL Editor tras aplicar 0001 a 0006.
--
-- El editor de Supabase solo muestra el resultado de la ULTIMA consulta,
-- asi que las comprobaciones van unidas en una sola tabla. Deben salir
-- 19 filas y todas deben empezar por OK.
-- =====================================================================

with
tablas(nombre) as (
  values ('huchas'), ('movimientos'), ('partidas'), ('pagos_partida')
),
-- 1) RLS activada y forzada
rls as (
  select
    format('%s RLS en %s (activada=%s, forzada=%s)',
           case when c.relrowsecurity and c.relforcerowsecurity then 'OK' else 'FALLO' end,
           c.relname, c.relrowsecurity, c.relforcerowsecurity) as resultado,
    1 as orden, c.relname::text as sub
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in (select nombre from tablas)
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
    and tablename in (select nombre from tablas)
  group by tablename
),
-- 3) Ninguna politica abierta al rol anon
sin_anon as (
  select
    case when count(*) = 0
         then 'OK ninguna politica expuesta al rol anon'
         else format('FALLO %s politicas alcanzables por anon', count(*)) end as resultado,
    3 as orden, '' as sub
  from pg_policies
  where schemaname = 'public'
    and tablename in (select nombre from tablas)
    and 'anon' = any (roles)
),
-- 4) Triggers: 4 de huchas/movimientos + 4 del presupuesto
triggers as (
  select
    format('%s %s triggers creados (esperados 8)',
           case when count(*) = 8 then 'OK' else 'FALLO' end, count(*)) as resultado,
    4 as orden, '' as sub
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and not t.tgisinternal
    and c.relname in (select nombre from tablas)
),
-- 5) Columnas clave
columnas as (
  select
    format('%s columna %s.%s',
           case when count(*) = 1 then 'OK' else 'FALLO falta' end,
           table_name, column_name) as resultado,
    5 as orden, (table_name || column_name)::text as sub
  from information_schema.columns
  where table_schema = 'public'
    and (   (table_name = 'movimientos'   and column_name = 'usuario_id')
         or (table_name = 'huchas'        and column_name = 'saldo_actual')
         or (table_name = 'partidas'      and column_name = 'hucha_id')
         or (table_name = 'pagos_partida' and column_name = 'movimiento_id'))
  group by table_name, column_name
),
-- 6) Indices
indices as (
  select
    format('%s %s indices propios creados (esperados 7)',
           case when count(*) = 7 then 'OK' else 'FALLO' end, count(*)) as resultado,
    6 as orden, '' as sub
  from pg_indexes
  where schemaname = 'public'
    and indexname in ('huchas_usuario_id_idx', 'movimientos_usuario_id_idx',
                      'movimientos_hucha_fecha_idx', 'partidas_usuario_idx',
                      'partidas_hucha_idx', 'pagos_partida_usuario_mes_idx',
                      'pagos_partida_movimiento_idx')
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
),
-- 9) 0005: gastos_fijos retirada
sin_gastos_fijos as (
  select
    case when to_regclass('public.gastos_fijos') is null
         then 'OK tabla gastos_fijos retirada (sustituida por partidas)'
         else 'FALLO gastos_fijos sigue existiendo (ejecuta 0005)' end as resultado,
    9 as orden, '' as sub
),
-- 10) 0006: cambiar_importe_partida existe y anon no puede ejecutarla
funcion as (
  select
    case when to_regprocedure('public.cambiar_importe_partida(uuid,date,numeric)') is null
           then 'FALLO falta la funcion cambiar_importe_partida (ejecuta 0006)'
         when has_function_privilege('anon', 'public.cambiar_importe_partida(uuid,date,numeric)', 'execute')
           then 'FALLO anon puede ejecutar cambiar_importe_partida'
         else 'OK funcion cambiar_importe_partida solo para usuarios con sesion' end as resultado,
    10 as orden, '' as sub
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
  union all select * from sin_gastos_fijos
  union all select * from funcion
) t
order by orden, sub;
