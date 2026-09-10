-- =====================================================================
-- MyFinanzApp · 0003 · Triggers
-- Ejecutar DESPUES de 0002. Idempotente.
--
-- Resuelve los puntos (a) y (b):
--   (a) saldo_actual lo calcula Postgres, nunca el cliente.
--   (b) movimientos.usuario_id se rellena solo desde la hucha.
-- =====================================================================

-- ---------------------------------------------------------------------
-- (b) Rellenar movimientos.usuario_id a partir de la hucha.
--
-- El SELECT respeta RLS (funcion con derechos del invocante), asi que si
-- la hucha es de otro usuario no devuelve fila y la insercion falla con
-- un mensaje claro en vez de un error opaco de NOT NULL.
-- ---------------------------------------------------------------------
create or replace function public.movimientos_set_usuario()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_usuario_id uuid;
begin
  select h.usuario_id into v_usuario_id
    from public.huchas h
   where h.id = new.hucha_id;

  if v_usuario_id is null then
    raise exception 'La hucha % no existe o no te pertenece', new.hucha_id
      using errcode = 'check_violation';
  end if;

  new.usuario_id := v_usuario_id;
  return new;
end;
$$;

drop trigger if exists movimientos_set_usuario on public.movimientos;
create trigger movimientos_set_usuario
  before insert or update of hucha_id on public.movimientos
  for each row execute function public.movimientos_set_usuario();

-- ---------------------------------------------------------------------
-- (a) Recalculo de saldo_actual.
--
-- Se recalcula la suma completa en vez de aplicar un delta: es igual de
-- barato con el indice de movimientos y ademas autocorrige el saldo si
-- alguna vez quedase descuadrado.
-- ---------------------------------------------------------------------
create or replace function public.aplicar_saldo_hucha(p_hucha_id uuid)
returns void
language sql
set search_path = ''
as $$
  update public.huchas h
     set saldo_actual = coalesce((
           select sum(case when m.tipo = 'ingreso' then m.importe else -m.importe end)
             from public.movimientos m
            where m.hucha_id = h.id
         ), 0)
   where h.id = p_hucha_id;
$$;

create or replace function public.movimientos_recalcular_saldo()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform public.aplicar_saldo_hucha(coalesce(new.hucha_id, old.hucha_id));

  -- Si un movimiento se mueve de hucha, la de origen tambien cambia.
  if tg_op = 'UPDATE' and old.hucha_id is distinct from new.hucha_id then
    perform public.aplicar_saldo_hucha(old.hucha_id);
  end if;

  return null; -- AFTER trigger: el valor devuelto se ignora
end;
$$;

drop trigger if exists movimientos_recalcular_saldo on public.movimientos;
create trigger movimientos_recalcular_saldo
  after insert or update or delete on public.movimientos
  for each row execute function public.movimientos_recalcular_saldo();

-- ---------------------------------------------------------------------
-- (a) Blindaje: impedir que el cliente escriba saldo_actual.
--
-- RLS deja al usuario hacer UPDATE de su hucha (necesario para editar
-- nombre/objetivo), y eso incluiria saldo_actual. pg_trigger_depth()
-- distingue el origen: 1 = UPDATE directo del cliente (se descarta el
-- valor), >1 = UPDATE desde el trigger de recalculo (se acepta).
-- usuario_id y created_at se blindan igual, por el mismo motivo.
-- ---------------------------------------------------------------------
create or replace function public.huchas_proteger_campos()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if pg_trigger_depth() = 1 then
    new.saldo_actual := old.saldo_actual;
  end if;
  new.usuario_id := old.usuario_id;
  new.created_at := old.created_at;
  return new;
end;
$$;

drop trigger if exists huchas_proteger_campos on public.huchas;
create trigger huchas_proteger_campos
  before update on public.huchas
  for each row execute function public.huchas_proteger_campos();

-- Mismo blindaje para gastos_fijos (no tiene campos derivados).
create or replace function public.gastos_proteger_campos()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.usuario_id := old.usuario_id;
  new.created_at := old.created_at;
  return new;
end;
$$;

drop trigger if exists gastos_proteger_campos on public.gastos_fijos;
create trigger gastos_proteger_campos
  before update on public.gastos_fijos
  for each row execute function public.gastos_proteger_campos();

-- Y para movimientos: usuario_id solo lo escribe movimientos_set_usuario.
create or replace function public.movimientos_proteger_campos()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.hucha_id is not distinct from new.hucha_id then
    new.usuario_id := old.usuario_id;
  end if;
  return new;
end;
$$;

drop trigger if exists movimientos_proteger_campos on public.movimientos;
create trigger movimientos_proteger_campos
  before update on public.movimientos
  for each row execute function public.movimientos_proteger_campos();
