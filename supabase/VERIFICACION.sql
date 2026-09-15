-- =====================================================================
-- MyFinanzApp · Verificacion post-migracion
-- Ejecutar en el SQL Editor tras aplicar 0001 a 0011.
--
-- El editor de Supabase solo muestra el resultado de la ULTIMA consulta,
-- asi que las comprobaciones van unidas en una sola tabla. Deben salir
-- 35 filas y todas deben empezar por OK.
-- =====================================================================

with
tablas(nombre) as (
  values ('huchas'), ('movimientos'), ('partidas'), ('pagos_partida'),
         ('categorias'), ('bancos')
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
-- 4) Triggers: 4 de huchas/movimientos, 4 del presupuesto, 2 de 0007/0011
triggers as (
  select
    format('%s %s triggers creados (esperados 10)',
           case when count(*) = 10 then 'OK' else 'FALLO' end, count(*)) as resultado,
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
         or (table_name = 'huchas'        and column_name in ('saldo_actual', 'finalidad',
                                                              'fecha_limite', 'pagada_at', 'banco_id'))
         or (table_name = 'partidas'      and column_name in ('hucha_id', 'descripcion', 'categoria_id'))
         or (table_name = 'pagos_partida' and column_name = 'movimiento_id'))
  group by table_name, column_name
),
-- 6) Indices
indices as (
  select
    format('%s %s indices propios creados (esperados 9)',
           case when count(*) = 9 then 'OK' else 'FALLO' end, count(*)) as resultado,
    6 as orden, '' as sub
  from pg_indexes
  where schemaname = 'public'
    and indexname in ('huchas_usuario_id_idx', 'movimientos_usuario_id_idx',
                      'movimientos_hucha_fecha_idx', 'partidas_usuario_idx',
                      'partidas_hucha_idx', 'pagos_partida_usuario_mes_idx',
                      'pagos_partida_movimiento_idx', 'partidas_categoria_idx',
                      'huchas_banco_idx')
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
-- 10) 0006 y 0007: funciones llamables desde la app, pero no por anon
funciones as (
  select
    case when to_regprocedure(f.firma) is null
           then format('FALLO falta la funcion %s', f.nombre)
         when has_function_privilege('anon', f.firma, 'execute')
           then format('FALLO anon puede ejecutar %s', f.nombre)
         else format('OK funcion %s solo para usuarios con sesion', f.nombre) end as resultado,
    10 as orden, f.nombre as sub
  from (values ('cambiar_importe_partida', 'public.cambiar_importe_partida(uuid,date,numeric)'),
               ('pagar_hucha',             'public.pagar_hucha(uuid,text)')) as f(nombre, firma)
),
-- 11) 0007: el blindaje de huchas tambien actua al crear
alta_hucha as (
  select
    case when coalesce(bool_or((t.tgtype::int & 4) = 4), false)
         then 'OK una hucha nueva empieza siempre con saldo 0'
         else 'FALLO una hucha puede crearse con saldo inventado (ejecuta 0007)' end as resultado,
    11 as orden, '' as sub
  from pg_trigger t
  where t.tgname = 'huchas_proteger_campos'
    and t.tgrelid = 'public.huchas'::regclass
),
-- 12) 0008: las huchas de ahorro pueden tener fecha objetivo
objetivo_ahorro as (
  select
    case when count(*) = 0
         then 'OK las huchas de ahorro pueden tener fecha objetivo'
         else 'FALLO las huchas de ahorro no admiten fecha objetivo (ejecuta 0008)' end as resultado,
    12 as orden, '' as sub
  from pg_constraint
  where conname = 'huchas_limite_solo_pago'
    and conrelid = 'public.huchas'::regclass
),
-- 13) 0009: mantener_activo existe y anon SI puede ejecutarla (al reves
--     que el resto: la llama un cron sin sesion)
cron_funcion as (
  select
    case when to_regprocedure('public.mantener_activo()') is null
           then 'FALLO falta la funcion mantener_activo (ejecuta 0009)'
         when not has_function_privilege('anon', 'public.mantener_activo()', 'execute')
           then 'FALLO anon no puede ejecutar mantener_activo (el cron de Vercel la necesita sin sesion)'
         else 'OK funcion mantener_activo ejecutable sin sesion (para el cron anti-pausa)' end as resultado,
    13 as orden, '' as sub
),
-- 14) 0011: nombre unico de categoria/banco por cuenta (sin distinguir mayusculas)
etiquetas_unicas as (
  select
    case when count(*) = 2
         then 'OK nombres de categoria y banco unicos por cuenta'
         else format('FALLO faltan indices unicos de nombre (ejecuta 0011, hay %s de 2)', count(*)) end as resultado,
    14 as orden, '' as sub
  from pg_indexes
  where schemaname = 'public'
    and indexname in ('categorias_usuario_nombre_idx', 'bancos_usuario_nombre_idx')
),
-- 15) 0011: no se puede vincular una categoria o un banco que no sean tuyos
etiquetas_validadas as (
  select
    case when to_regprocedure('public.huchas_validar_banco()') is null
           then 'FALLO falta la funcion huchas_validar_banco (ejecuta 0011)'
         when not exists (
           select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname = 'partidas_validar'
              and p.prosrc ilike '%categoria_id%'
         )
           then 'FALLO partidas_validar no comprueba categoria_id (ejecuta 0011)'
         else 'OK no se puede vincular una categoria o un banco que no sean tuyos' end as resultado,
    15 as orden, '' as sub
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
  union all select * from funciones
  union all select * from alta_hucha
  union all select * from objetivo_ahorro
  union all select * from cron_funcion
  union all select * from etiquetas_unicas
  union all select * from etiquetas_validadas
) t
order by orden, sub;
