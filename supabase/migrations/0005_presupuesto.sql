-- =====================================================================
-- MyFinanzApp · 0005 · Presupuesto mensual: partidas y seguimiento
-- Ejecutar DESPUES de 0004. Idempotente.
--
-- Sustituye gastos_fijos por "partidas": ingresos, gastos y ahorro con
-- mes de inicio, mes de fin opcional y frecuencia. pagos_partida guarda
-- que partidas se han marcado como hechas cada mes (el verde del Excel).
-- La logica (triggers y funciones) va en 0006.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Retirar gastos_fijos. Solo si esta vacia: nunca tuvo pantalla, pero
--    si alguien metio filas a mano no se borran en silencio.
-- ---------------------------------------------------------------------
do $$
begin
  if to_regclass('public.gastos_fijos') is not null then
    -- Sin FORCE, el propietario (quien ejecuta esto) ve todas las filas;
    -- con FORCE, RLS podria ocultarlas y la tabla pareceria vacia.
    alter table public.gastos_fijos no force row level security;
    if exists (select 1 from public.gastos_fijos) then
      raise exception 'gastos_fijos tiene datos. Revisalos antes de ejecutar 0005.';
    end if;
    drop table public.gastos_fijos;
  end if;
end $$;

drop function if exists public.gastos_proteger_campos();
drop type if exists public.periodicidad;

-- ---------------------------------------------------------------------
-- 2) Enums
-- ---------------------------------------------------------------------
do $$ begin
  create type public.tipo_partida as enum ('ingreso', 'gasto', 'ahorro');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.frecuencia_partida as enum ('mensual', 'anual', 'puntual');
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------
-- 3) partidas
--
-- Un mes se representa siempre por su dia 1 (2026-09-01 = septiembre).
--   mensual: todos los meses entre mes_inicio y mes_fin (o sin fin)
--   anual:   una vez al ano, en el mes de mes_inicio, hasta mes_fin
--   puntual: solo en mes_inicio
-- Un cambio de importe no edita la fila: cierra esta partida y abre otra
-- (funcion cambiar_importe_partida en 0006), asi los meses pasados no
-- cambian.
-- ---------------------------------------------------------------------
create table if not exists public.partidas (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null default auth.uid()
                references auth.users (id) on delete cascade,
  tipo        public.tipo_partida not null,
  concepto    text not null check (length(btrim(concepto)) between 1 and 80),
  importe     numeric(14, 2) not null check (importe > 0),
  frecuencia  public.frecuencia_partida not null default 'mensual',
  mes_inicio  date not null check (extract(day from mes_inicio) = 1),
  mes_fin     date check (mes_fin is null or extract(day from mes_fin) = 1),
  -- Solo para ahorro: al marcar el mes como hecho se ingresa en esta hucha.
  hucha_id    uuid references public.huchas (id) on delete set null,
  created_at  timestamptz not null default now(),

  constraint partidas_fin_despues_de_inicio
    check (mes_fin is null or mes_fin >= mes_inicio),
  constraint partidas_puntual_sin_fin
    check (frecuencia <> 'puntual' or mes_fin is null),
  constraint partidas_hucha_solo_ahorro
    check (hucha_id is null or tipo = 'ahorro')
);

-- ---------------------------------------------------------------------
-- 4) pagos_partida: una fila por partida y mes marcado como hecho.
-- ---------------------------------------------------------------------
create table if not exists public.pagos_partida (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null default auth.uid()
                  references auth.users (id) on delete cascade,
  partida_id    uuid not null references public.partidas (id) on delete cascade,
  mes           date not null check (extract(day from mes) = 1),
  -- Ingreso creado en la hucha al marcar una partida de ahorro. Si se borra
  -- ese movimiento desde la hucha, el mes deja de estar marcado.
  movimiento_id uuid references public.movimientos (id) on delete cascade,
  created_at    timestamptz not null default now(),

  constraint pagos_partida_unico unique (partida_id, mes)
);

-- ---------------------------------------------------------------------
-- 5) Indices. El unique de pagos_partida ya cubre las busquedas por
--    partida_id; los de claves foraneas evitan seq scans en los borrados
--    en cascada.
-- ---------------------------------------------------------------------
create index if not exists partidas_usuario_idx
  on public.partidas (usuario_id, tipo, mes_inicio);
create index if not exists partidas_hucha_idx
  on public.partidas (hucha_id);
create index if not exists pagos_partida_usuario_mes_idx
  on public.pagos_partida (usuario_id, mes);
create index if not exists pagos_partida_movimiento_idx
  on public.pagos_partida (movimiento_id);

-- ---------------------------------------------------------------------
-- 6) RLS: mismo patron que 0002.
-- ---------------------------------------------------------------------
alter table public.partidas      enable row level security;
alter table public.partidas      force row level security;
alter table public.pagos_partida enable row level security;
alter table public.pagos_partida force row level security;

drop policy if exists "partidas: leer las propias"   on public.partidas;
drop policy if exists "partidas: crear las propias"  on public.partidas;
drop policy if exists "partidas: editar las propias" on public.partidas;
drop policy if exists "partidas: borrar las propias" on public.partidas;

create policy "partidas: leer las propias"
  on public.partidas for select to authenticated
  using (usuario_id = (select auth.uid()));
create policy "partidas: crear las propias"
  on public.partidas for insert to authenticated
  with check (usuario_id = (select auth.uid()));
create policy "partidas: editar las propias"
  on public.partidas for update to authenticated
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));
create policy "partidas: borrar las propias"
  on public.partidas for delete to authenticated
  using (usuario_id = (select auth.uid()));

drop policy if exists "pagos: leer los propios"   on public.pagos_partida;
drop policy if exists "pagos: crear los propios"  on public.pagos_partida;
drop policy if exists "pagos: editar los propios" on public.pagos_partida;
drop policy if exists "pagos: borrar los propios" on public.pagos_partida;

create policy "pagos: leer los propios"
  on public.pagos_partida for select to authenticated
  using (usuario_id = (select auth.uid()));
create policy "pagos: crear los propios"
  on public.pagos_partida for insert to authenticated
  with check (usuario_id = (select auth.uid()));
create policy "pagos: editar los propios"
  on public.pagos_partida for update to authenticated
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));
create policy "pagos: borrar los propios"
  on public.pagos_partida for delete to authenticated
  using (usuario_id = (select auth.uid()));

revoke all on public.partidas      from anon;
revoke all on public.pagos_partida from anon;
