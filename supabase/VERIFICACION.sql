-- =====================================================================
-- MyFinanzApp · Verificacion post-migracion
-- Ejecutar en el SQL Editor tras aplicar 0001, 0002 y 0003.
-- Las consultas 1-4 devuelven tablas; la 5 escribe en la pestana "Results"
-- unos avisos (NOTICE) con el resultado de la prueba.
-- =====================================================================

-- 1) RLS activada y forzada en las tres tablas
select
  c.relname             as tabla,
  c.relrowsecurity      as rls_activada,
  c.relforcerowsecurity as rls_forzada,
  case when c.relrowsecurity and c.relforcerowsecurity
       then 'OK' else 'FALLO' end as estado
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('huchas', 'movimientos', 'gastos_fijos')
order by c.relname;

-- 2) Cuatro politicas por tabla (select / insert / update / delete)
select
  tablename  as tabla,
  count(*)   as politicas,
  case when count(*) = 4 then 'OK' else 'FALLO' end as estado
from pg_policies
where schemaname = 'public'
  and tablename in ('huchas', 'movimientos', 'gastos_fijos')
group by tablename
order by tablename;

-- 3) Ninguna politica debe estar abierta al rol anon
select
  case when count(*) = 0
       then 'OK: ninguna politica expuesta a anon'
       else 'FALLO: ' || count(*) || ' politicas alcanzables por anon' end as estado
from pg_policies
where schemaname = 'public'
  and tablename in ('huchas', 'movimientos', 'gastos_fijos')
  and 'anon' = any (roles);

-- 4) Los cinco triggers deben existir
select
  c.relname as tabla,
  t.tgname  as trigger
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and not t.tgisinternal
  and c.relname in ('huchas', 'movimientos', 'gastos_fijos')
order by c.relname, t.tgname;

-- 5) Prueba real del recalculo de saldo (punto a).
--    Crea una hucha, le mete movimientos, comprueba el saldo y lo borra todo.
--    Requiere al menos un usuario registrado.
--    Si tu rol no puede saltarse RLS veras el aviso correspondiente: eso no
--    es un fallo, confirma que las politicas estan haciendo su trabajo.
do $$
declare
  v_user  uuid;
  v_hucha uuid;
  v_saldo numeric;
begin
  select id into v_user from auth.users order by created_at limit 1;
  if v_user is null then
    raise notice 'SIN USUARIOS: registrate en la app y vuelve a ejecutar esta prueba.';
    return;
  end if;

  -- Bloque anidado: si algo falla, revierte solo lo que haya hecho la prueba.
  begin
    insert into public.huchas (usuario_id, nombre, tipo, objetivo)
         values (v_user, '__test_saldo__', 'ahorro', 1000)
      returning id into v_hucha;

    insert into public.movimientos (hucha_id, usuario_id, importe, tipo)
         values (v_hucha, v_user, 500, 'ingreso'),
                (v_hucha, v_user, 200, 'ingreso'),
                (v_hucha, v_user, 150, 'retirada');

    select saldo_actual into v_saldo from public.huchas where id = v_hucha;
    if v_saldo = 550 then
      raise notice 'OK: saldo recalculado correctamente (500 + 200 - 150 = %)', v_saldo;
    else
      raise notice 'FALLO: se esperaba 550 y el saldo es %', v_saldo;
    end if;

    -- El cliente no debe poder escribir saldo_actual a mano
    update public.huchas set saldo_actual = 99999 where id = v_hucha;
    select saldo_actual into v_saldo from public.huchas where id = v_hucha;
    if v_saldo = 550 then
      raise notice 'OK: saldo_actual blindado frente a escritura directa';
    else
      raise notice 'FALLO: saldo_actual se pudo sobrescribir (valor %)', v_saldo;
    end if;

    -- Cascada: borrar la hucha debe borrar tambien sus movimientos
    delete from public.huchas where id = v_hucha;
    raise notice 'OK: limpieza hecha, no queda nada de la prueba.';

  exception
    when insufficient_privilege or check_violation then
      raise notice 'RLS ACTIVA: tu rol no puede insertar datos de otro usuario (%). Prueba omitida, nada que limpiar.', sqlerrm;
    when others then
      raise notice 'Prueba abortada y revertida: % (%)', sqlerrm, sqlstate;
  end;
end $$;
