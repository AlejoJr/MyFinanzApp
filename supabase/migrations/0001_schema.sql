-- =====================================================================
-- MyFinanzApp · 0001 · Esquema base
-- Ejecutar en Supabase > SQL Editor. Idempotente: se puede repetir.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Enums nativos. Mejores que un CHECK sobre text: el valor invalido se
-- rechaza en la propia columna y ademas PostgREST los expone al cliente.
-- ---------------------------------------------------------------------
do $$ begin
  create type public.tipo_hucha as enum ('ahorro', 'inversion', 'hipoteca', 'seguro', 'otro');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.tipo_movimiento as enum ('ingreso', 'retirada');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.periodicidad as enum ('mensual', 'anual', 'otro');
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------
-- huchas
--
-- saldo_actual NO lo escribe el cliente: lo mantiene el trigger de
-- recalculo definido en 0003 a partir de la suma de movimientos.
-- El default de usuario_id evita que el frontend tenga que mandarlo.
-- ---------------------------------------------------------------------
create table if not exists public.huchas (
  id           uuid primary key default gen_random_uuid(),
  usuario_id   uuid not null default auth.uid()
                 references auth.users (id) on delete cascade,
  nombre       text not null
                 check (length(btrim(nombre)) between 1 and 80),
  tipo         public.tipo_hucha not null default 'ahorro',
  objetivo     numeric(14, 2) not null default 0
                 check (objetivo >= 0),
  saldo_actual numeric(14, 2) not null default 0,
  created_at   timestamptz not null default now()
);

comment on column public.huchas.saldo_actual is
  'Derivado de movimientos. Lo mantiene el trigger movimientos_recalcular_saldo; el cliente no puede escribirlo.';

-- ---------------------------------------------------------------------
-- movimientos
--
-- usuario_id esta desnormalizado a proposito (punto b): permite la misma
-- politica RLS directa que en las otras tablas en vez de un subquery
-- contra huchas por cada fila leida. Lo rellena un trigger desde la
-- hucha, nunca el cliente.
-- ---------------------------------------------------------------------
create table if not exists public.movimientos (
  id         uuid primary key default gen_random_uuid(),
  hucha_id   uuid not null references public.huchas (id) on delete cascade,
  usuario_id uuid not null references auth.users (id) on delete cascade,
  importe    numeric(14, 2) not null check (importe > 0),
  tipo       public.tipo_movimiento not null,
  fecha      timestamptz not null default now(),
  nota       text check (nota is null or length(nota) <= 280)
);

comment on column public.movimientos.importe is
  'Siempre positivo. El signo lo determina la columna tipo (ingreso suma, retirada resta).';

-- ---------------------------------------------------------------------
-- gastos_fijos
-- ---------------------------------------------------------------------
create table if not exists public.gastos_fijos (
  id           uuid primary key default gen_random_uuid(),
  usuario_id   uuid not null default auth.uid()
                 references auth.users (id) on delete cascade,
  concepto     text not null
                 check (length(btrim(concepto)) between 1 and 80),
  importe      numeric(14, 2) not null check (importe > 0),
  periodicidad public.periodicidad not null default 'mensual',
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Indices. Toda consulta de la app filtra por usuario_id (lo impone RLS),
-- asi que sin estos indices cada lectura seria un seq scan.
-- ---------------------------------------------------------------------
create index if not exists huchas_usuario_id_idx
  on public.huchas (usuario_id, created_at desc);

create index if not exists movimientos_usuario_id_idx
  on public.movimientos (usuario_id);

-- Cubre el historial de la vista de detalle: filtra por hucha y ordena por fecha.
create index if not exists movimientos_hucha_fecha_idx
  on public.movimientos (hucha_id, fecha desc);

create index if not exists gastos_fijos_usuario_id_idx
  on public.gastos_fijos (usuario_id, created_at desc);
