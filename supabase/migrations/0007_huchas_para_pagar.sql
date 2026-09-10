-- =====================================================================
-- MyFinanzApp · 0007 · Huchas "Para pagar"
-- Ejecutar DESPUES de 0006. Idempotente.
--
-- Una hucha puede ser de Ahorro (dinero tuyo que se queda) o Para pagar
-- (apartado para un pago futuro: un regalo, el coche...). Las de pagar
-- tienen fecha limite y se cierran con pagar_hucha(): el dinero sale, la
-- aportacion mensual se detiene y la hucha queda archivada como pagada,
-- con su historial intacto.
-- =====================================================================

do $$ begin
  create type public.finalidad_hucha as enum ('ahorro', 'pago');
exception when duplicate_object then null;
end $$;

alter table public.huchas
  add column if not exists finalidad public.finalidad_hucha not null default 'ahorro',
  -- Ultimo mes para reunir el dinero (dia 1, como el resto de meses).
  add column if not exists fecha_limite date,
  -- null = activa. Solo lo escribe pagar_hucha().
  add column if not exists pagada_at timestamptz;

alter table public.huchas drop constraint if exists huchas_fecha_limite_mes;
alter table public.huchas
  add constraint huchas_fecha_limite_mes
  check (fecha_limite is null or extract(day from fecha_limite) = 1);

alter table public.huchas drop constraint if exists huchas_limite_solo_pago;
alter table public.huchas
  add constraint huchas_limite_solo_pago
  check (fecha_limite is null or finalidad = 'pago');

alter table public.huchas drop constraint if exists huchas_pagada_solo_pago;
alter table public.huchas
  add constraint huchas_pagada_solo_pago
  check (pagada_at is null or finalidad = 'pago');

-- ---------------------------------------------------------------------
-- 1) Blindaje de huchas, ahora tambien al crear.
--
-- Corrige un agujero de 0003: solo protegia el UPDATE, asi que por la API
-- se podia crear una hucha con un saldo_actual inventado, sin movimientos
-- detras. Una hucha nace siempre con saldo 0 y activa.
--
-- pagada_at solo cambia desde pagar_hucha(), que activa una marca local a
-- su transaccion. set_config vive en pg_catalog, que la API no expone.
-- ---------------------------------------------------------------------
create or replace function public.huchas_proteger_campos()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.saldo_actual := 0;
    new.pagada_at := null;
    return new;
  end if;

  if pg_trigger_depth() = 1 then
    new.saldo_actual := old.saldo_actual;
  end if;
  if coalesce(current_setting('myfinanzapp.pagando', true), '') <> 'on' then
    new.pagada_at := old.pagada_at;
  end if;
  new.usuario_id := old.usuario_id;
  new.created_at := old.created_at;
  return new;
end;
$$;

drop trigger if exists huchas_proteger_campos on public.huchas;
create trigger huchas_proteger_campos
  before insert or update on public.huchas
  for each row execute function public.huchas_proteger_campos();

-- ---------------------------------------------------------------------
-- 2) Una hucha pagada es un registro cerrado: sus movimientos no se
--    pueden anadir, cambiar ni borrar. (Borrar la hucha entera si se
--    puede: en ese borrado en cascada la hucha ya no existe y esta
--    comprobacion no la encuentra.)
-- ---------------------------------------------------------------------
create or replace function public.movimientos_hucha_abierta()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_hucha uuid;
begin
  if tg_op = 'DELETE' then
    v_hucha := old.hucha_id;
  else
    v_hucha := new.hucha_id;
  end if;

  if exists (select 1 from public.huchas h where h.id = v_hucha and h.pagada_at is not null) then
    raise exception 'Esta hucha ya está pagada: su historial no se puede modificar.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists movimientos_hucha_abierta on public.movimientos;
create trigger movimientos_hucha_abierta
  before insert or update or delete on public.movimientos
  for each row execute function public.movimientos_hucha_abierta();

-- ---------------------------------------------------------------------
-- 3) Pagar: todo en una transaccion.
-- ---------------------------------------------------------------------
create or replace function public.pagar_hucha(p_hucha uuid, p_nota text default null)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v     public.huchas%rowtype;
  p     record;
  v_hoy date := public.mes_actual();
  v_fin date;
begin
  select * into v from public.huchas where id = p_hucha for update;
  if not found then
    raise exception 'La hucha no existe o no te pertenece';
  end if;
  if v.finalidad <> 'pago' then
    raise exception 'Solo se pueden pagar las huchas «Para pagar».';
  end if;
  if v.pagada_at is not null then
    raise exception 'Esta hucha ya estaba pagada.';
  end if;

  -- a) Sale el dinero: una retirada por todo el saldo.
  if v.saldo_actual > 0 then
    insert into public.movimientos (hucha_id, importe, tipo, fecha, nota)
    values (
      p_hucha,
      v.saldo_actual,
      'retirada',
      now(),
      left(coalesce(nullif(btrim(p_nota), ''), 'Pago: ' || v.nombre), 280)
    );
  end if;

  -- b) Se detienen las aportaciones del presupuesto. Si este mes ya se
  --    aporto, la partida termina este mes; si no, el anterior. Las que
  --    aun no habian empezado se borran: no pueden tener meses marcados,
  --    porque los meses futuros no se marcan.
  for p in
    select pa.id, pa.frecuencia, pa.mes_inicio, pa.mes_fin,
           exists (select 1 from public.pagos_partida pp
                    where pp.partida_id = pa.id and pp.mes = v_hoy) as hecha_hoy
      from public.partidas pa
     where pa.hucha_id = p_hucha
  loop
    v_fin := case when p.hecha_hoy then v_hoy else (v_hoy - interval '1 month')::date end;
    if p.mes_inicio > v_fin then
      delete from public.partidas where id = p.id;
    elsif p.frecuencia <> 'puntual' and (p.mes_fin is null or p.mes_fin > v_fin) then
      update public.partidas set mes_fin = v_fin where id = p.id;
    end if;
  end loop;

  -- c) Archivada como pagada.
  perform set_config('myfinanzapp.pagando', 'on', true);
  update public.huchas set pagada_at = now() where id = p_hucha;
  perform set_config('myfinanzapp.pagando', 'off', true);
end;
$$;

revoke execute on function public.pagar_hucha(uuid, text) from public, anon;
grant  execute on function public.pagar_hucha(uuid, text) to authenticated;
