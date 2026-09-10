-- =====================================================================
-- MyFinanzApp · 0004 · Saldo nunca negativo y recalculo sin carreras
-- Ejecutar DESPUES de 0003. Idempotente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Recalculo con bloqueo de fila.
--
-- Corrige una carrera de 0003: si llegaban dos movimientos de la misma
-- hucha a la vez (movil y portatil, dos pestanas), cada transaccion sumaba
-- los movimientos con una foto de la base de datos tomada antes de que la
-- otra confirmase, y el saldo final podia no incluir uno de los dos.
--
-- Ahora se bloquea la fila de la hucha ANTES de sumar. La segunda
-- transaccion espera en ese bloqueo y, como la suma va en una sentencia
-- posterior (en READ COMMITTED cada sentencia de una funcion volatil toma
-- una foto nueva), la calcula ya con el movimiento de la primera incluido.
-- ---------------------------------------------------------------------
create or replace function public.aplicar_saldo_hucha(p_hucha_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform 1 from public.huchas where id = p_hucha_id for update;

  update public.huchas h
     set saldo_actual = coalesce((
           select sum(case when m.tipo = 'ingreso' then m.importe else -m.importe end)
             from public.movimientos m
            where m.hucha_id = h.id
         ), 0)
   where h.id = p_hucha_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 2) Una hucha no puede quedar en negativo.
--
-- Si una retirada, o borrar un ingreso, dejase el saldo por debajo de 0,
-- el UPDATE del trigger viola esta restriccion y Postgres deshace la
-- sentencia entera, movimiento incluido.
--
-- El formulario ya lo comprueba antes de enviar, pero la regla tiene que
-- vivir aqui: el cliente puede tener un saldo desactualizado. Junto con el
-- bloqueo de arriba, dos retiradas simultaneas que solo caben de una en
-- una no pueden pasar las dos.
-- ---------------------------------------------------------------------
alter table public.huchas drop constraint if exists huchas_saldo_no_negativo;

alter table public.huchas
  add constraint huchas_saldo_no_negativo check (saldo_actual >= 0);
