-- =====================================================================
-- MyFinanzApp · 0006 · Presupuesto: logica en la base de datos
-- Ejecutar DESPUES de 0005. Idempotente.
--
-- Los mensajes de raise exception sin errcode (P0001) estan escritos para
-- el usuario: la app los muestra tal cual.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Utilidades
-- ---------------------------------------------------------------------

-- Mes en curso segun la hora de Espana, no la del servidor (UTC): a las
-- 00:30 del dia 1 en Madrid el servidor aun esta en el mes anterior.
create or replace function public.mes_actual()
returns date
language sql
stable
set search_path = ''
as $$
  select date_trunc('month', now() at time zone 'Europe/Madrid')::date;
$$;

-- ¿Toca esta partida en ese mes? (el cliente replica esta regla en
-- src/lib/presupuesto.ts para pintar la vista mensual)
create or replace function public.partida_aplica(
  p_frecuencia public.frecuencia_partida,
  p_inicio     date,
  p_fin        date,
  p_mes        date
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_mes >= p_inicio
     and (p_fin is null or p_mes <= p_fin)
     and case p_frecuencia
           when 'mensual' then true
           when 'anual'   then extract(month from p_mes) = extract(month from p_inicio)
           when 'puntual' then p_mes = p_inicio
         end;
$$;

-- ---------------------------------------------------------------------
-- 2) partidas: validaciones
-- ---------------------------------------------------------------------
create or replace function public.partidas_validar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.usuario_id := old.usuario_id;
    new.created_at := old.created_at;
  end if;

  -- La hucha tiene que ser del usuario. La clave foranea no lo impide (no
  -- pasa por RLS); este SELECT si, y una hucha ajena no aparece.
  if new.hucha_id is not null
     and (tg_op = 'INSERT' or new.hucha_id is distinct from old.hucha_id)
     and not exists (select 1 from public.huchas h where h.id = new.hucha_id) then
    raise exception 'La hucha % no existe o no te pertenece', new.hucha_id
      using errcode = 'check_violation';
  end if;

  if tg_op = 'UPDATE' then
    -- Meses ya marcados que quedarian fuera del nuevo periodo o frecuencia.
    if exists (
      select 1 from public.pagos_partida p
       where p.partida_id = new.id
         and not public.partida_aplica(new.frecuencia, new.mes_inicio, new.mes_fin, p.mes)
    ) then
      raise exception 'Hay meses marcados como hechos fuera del nuevo periodo. Desmárcalos antes de cambiarlo.';
    end if;

    -- Con aportaciones ya ingresadas en la hucha, cambiar el importe, el
    -- tipo o la hucha dejaria la hucha descuadrada con el presupuesto.
    -- (Que hucha_id pase a null es el borrado de la hucha: no hay nada que
    -- mantener alineado.)
    if ((new.importe, new.tipo) is distinct from (old.importe, old.tipo)
        or (new.hucha_id is not null and new.hucha_id is distinct from old.hucha_id))
       and exists (select 1 from public.pagos_partida p
                    where p.partida_id = new.id and p.movimiento_id is not null) then
      raise exception 'Esta partida ya tiene aportaciones ingresadas en su hucha. Desmarca esos meses antes de cambiar el importe, el tipo o la hucha.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists partidas_validar on public.partidas;
create trigger partidas_validar
  before insert or update on public.partidas
  for each row execute function public.partidas_validar();

-- ---------------------------------------------------------------------
-- 3) Marcar un mes como hecho. Si la partida es de ahorro y tiene hucha,
--    se crea el ingreso en la hucha en la misma transaccion.
-- ---------------------------------------------------------------------
create or replace function public.pagos_partida_antes_insertar()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v     public.partidas%rowtype;
  v_mov uuid;
begin
  select * into v from public.partidas where id = new.partida_id;
  if not found then
    raise exception 'La partida no existe o no te pertenece';
  end if;
  if not public.partida_aplica(v.frecuencia, v.mes_inicio, v.mes_fin, new.mes) then
    raise exception 'Esa partida no corresponde a ese mes';
  end if;
  if new.mes > public.mes_actual() then
    raise exception 'No puedes marcar como hecho un mes que todavía no ha llegado';
  end if;

  new.movimiento_id := null; -- lo decide la base de datos, nunca el cliente

  if v.tipo = 'ahorro' and v.hucha_id is not null then
    insert into public.movimientos (hucha_id, importe, tipo, fecha, nota)
    values (
      v.hucha_id,
      v.importe,
      'ingreso',
      case when new.mes = public.mes_actual() then now()
           else (new.mes + time '12:00')::timestamptz end,
      left(v.concepto || ' (' || to_char(new.mes, 'MM/YYYY') || ')', 280)
    )
    returning id into v_mov;
    new.movimiento_id := v_mov;
  end if;

  return new;
end;
$$;

drop trigger if exists pagos_partida_antes_insertar on public.pagos_partida;
create trigger pagos_partida_antes_insertar
  before insert on public.pagos_partida
  for each row execute function public.pagos_partida_antes_insertar();

-- Solo se permite mover un pago a otra partida (lo usa
-- cambiar_importe_partida); el resto de campos quedan fijos.
create or replace function public.pagos_partida_antes_actualizar()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v public.partidas%rowtype;
begin
  new.usuario_id    := old.usuario_id;
  new.mes           := old.mes;
  new.movimiento_id := old.movimiento_id;
  new.created_at    := old.created_at;

  if new.partida_id is distinct from old.partida_id then
    select * into v from public.partidas where id = new.partida_id;
    if not found or not public.partida_aplica(v.frecuencia, v.mes_inicio, v.mes_fin, new.mes) then
      raise exception 'Esa partida no existe o no corresponde a ese mes';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists pagos_partida_antes_actualizar on public.pagos_partida;
create trigger pagos_partida_antes_actualizar
  before update on public.pagos_partida
  for each row execute function public.pagos_partida_antes_actualizar();

-- Desmarcar deshace la aportacion. Si la hucha quedase en negativo (ya se
-- retiro ese dinero), la restriccion de 0004 lo impide y el mes sigue
-- marcado.
create or replace function public.pagos_partida_despues_borrar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.movimiento_id is not null then
    delete from public.movimientos where id = old.movimiento_id;
  end if;
  return null;
end;
$$;

drop trigger if exists pagos_partida_despues_borrar on public.pagos_partida;
create trigger pagos_partida_despues_borrar
  after delete on public.pagos_partida
  for each row execute function public.pagos_partida_despues_borrar();

-- ---------------------------------------------------------------------
-- 4) Cambiar el importe a partir de un mes (Internet 72 -> 34 desde
--    febrero). Cierra la partida el mes anterior y abre otra igual con el
--    importe nuevo, todo en una transaccion. Devuelve el id de la partida
--    que queda vigente.
-- ---------------------------------------------------------------------
create or replace function public.cambiar_importe_partida(
  p_partida uuid,
  p_desde   date,
  p_importe numeric
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v       public.partidas%rowtype;
  v_nueva uuid;
begin
  if p_importe is null or p_importe <= 0 then
    raise exception 'El importe tiene que ser mayor que cero';
  end if;
  p_desde := date_trunc('month', p_desde)::date;

  select * into v from public.partidas where id = p_partida for update;
  if not found then
    raise exception 'La partida no existe o no te pertenece';
  end if;

  -- Anual: el cambio empieza en la siguiente vez que toca pagarla.
  if v.frecuencia = 'anual' then
    p_desde := make_date(
      extract(year from p_desde)::int
        + case when extract(month from p_desde) > extract(month from v.mes_inicio) then 1 else 0 end,
      extract(month from v.mes_inicio)::int,
      1);
  end if;

  if v.mes_fin is not null and p_desde > v.mes_fin then
    raise exception 'Ese mes queda fuera del periodo de la partida';
  end if;
  if v.importe = p_importe then
    return v.id;
  end if;

  -- Desde el primer mes, o puntual: no hay meses anteriores que conservar.
  if p_desde <= v.mes_inicio or v.frecuencia = 'puntual' then
    update public.partidas set importe = p_importe where id = v.id;
    return v.id;
  end if;

  if exists (select 1 from public.pagos_partida
              where partida_id = v.id and mes >= p_desde and movimiento_id is not null) then
    raise exception 'Hay aportaciones ya ingresadas en la hucha a partir de ese mes. Desmárcalas antes de cambiar el importe.';
  end if;

  insert into public.partidas (tipo, concepto, importe, frecuencia, mes_inicio, mes_fin, hucha_id)
  values (v.tipo, v.concepto, p_importe, v.frecuencia, p_desde, v.mes_fin, v.hucha_id)
  returning id into v_nueva;

  -- Los meses ya marcados desde p_desde pasan a la partida nueva antes de
  -- cerrar la vieja (si no, quedarian fuera de su periodo).
  update public.pagos_partida set partida_id = v_nueva
   where partida_id = v.id and mes >= p_desde;

  update public.partidas
     set mes_fin = (p_desde - interval '1 month')::date
   where id = v.id;

  return v_nueva;
end;
$$;

revoke execute on function public.cambiar_importe_partida(uuid, date, numeric) from public, anon;
grant  execute on function public.cambiar_importe_partida(uuid, date, numeric) to authenticated;
