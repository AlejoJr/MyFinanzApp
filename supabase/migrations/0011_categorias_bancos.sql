-- =====================================================================
-- MyFinanzApp · 0011 · Categorías (partidas) y bancos (huchas)
-- Ejecutar DESPUES de 0010. Idempotente.
--
-- Dos etiquetas independientes, con la misma forma:
--   categorias: clasifica un GASTO del presupuesto (Seguros, Vivienda...).
--     Responde a "¿en qué se me va el dinero?".
--   bancos:     identifica DÓNDE está guardado el dinero de una hucha
--     (BBVA, Trade Republic...). Responde a "¿dónde tengo cada euro?".
-- Cada una las gestiona el propio usuario (no son un enum fijo como
-- tipo_hucha), y ambas son opcionales: quitar la etiqueta de una partida
-- o hucha, o borrar la etiqueta, nunca borra ni bloquea el registro que
-- la llevaba (ON DELETE SET NULL).
-- =====================================================================

-- Mismo conjunto que TREMOR_PALETTE en tailwind.config.js: son los
-- colores que Tailwind no purga, así que una barra o insignia con
-- cualquiera de estos siempre sale coloreada.
do $$ begin
  create type public.color_etiqueta as enum
    ('slate', 'gray', 'emerald', 'blue', 'amber', 'rose', 'violet', 'cyan');
exception when duplicate_object then null;
end $$;

create table if not exists public.categorias (
  id         uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid()
               references auth.users (id) on delete cascade,
  nombre     text not null check (length(btrim(nombre)) between 1 and 40),
  color      public.color_etiqueta not null default 'slate',
  created_at timestamptz not null default now()
);

create table if not exists public.bancos (
  id         uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid()
               references auth.users (id) on delete cascade,
  nombre     text not null check (length(btrim(nombre)) between 1 and 40),
  color      public.color_etiqueta not null default 'slate',
  created_at timestamptz not null default now()
);

-- Sin distinguir mayúsculas: "Seguros" y "seguros" serían la misma para
-- quien la escribe sin fijarse, y aquí son dos personas compartiendo cuenta.
create unique index if not exists categorias_usuario_nombre_idx
  on public.categorias (usuario_id, lower(nombre));
create unique index if not exists bancos_usuario_nombre_idx
  on public.bancos (usuario_id, lower(nombre));

alter table public.partidas
  add column if not exists categoria_id uuid references public.categorias (id) on delete set null;
alter table public.huchas
  add column if not exists banco_id uuid references public.bancos (id) on delete set null;

create index if not exists partidas_categoria_idx on public.partidas (categoria_id);
create index if not exists huchas_banco_idx on public.huchas (banco_id);

-- ---------------------------------------------------------------------
-- RLS: mismo patron que el resto de tablas.
-- ---------------------------------------------------------------------
alter table public.categorias enable row level security;
alter table public.categorias force row level security;
alter table public.bancos     enable row level security;
alter table public.bancos     force row level security;

drop policy if exists "categorias: leer las propias"   on public.categorias;
drop policy if exists "categorias: crear las propias"  on public.categorias;
drop policy if exists "categorias: editar las propias" on public.categorias;
drop policy if exists "categorias: borrar las propias" on public.categorias;

create policy "categorias: leer las propias"
  on public.categorias for select to authenticated
  using (usuario_id = (select auth.uid()));
create policy "categorias: crear las propias"
  on public.categorias for insert to authenticated
  with check (usuario_id = (select auth.uid()));
create policy "categorias: editar las propias"
  on public.categorias for update to authenticated
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));
create policy "categorias: borrar las propias"
  on public.categorias for delete to authenticated
  using (usuario_id = (select auth.uid()));

drop policy if exists "bancos: leer los propios"   on public.bancos;
drop policy if exists "bancos: crear los propios"  on public.bancos;
drop policy if exists "bancos: editar los propios" on public.bancos;
drop policy if exists "bancos: borrar los propios" on public.bancos;

create policy "bancos: leer los propios"
  on public.bancos for select to authenticated
  using (usuario_id = (select auth.uid()));
create policy "bancos: crear los propios"
  on public.bancos for insert to authenticated
  with check (usuario_id = (select auth.uid()));
create policy "bancos: editar los propios"
  on public.bancos for update to authenticated
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));
create policy "bancos: borrar los propios"
  on public.bancos for delete to authenticated
  using (usuario_id = (select auth.uid()));

revoke all on public.categorias from anon;
revoke all on public.bancos     from anon;

-- ---------------------------------------------------------------------
-- partidas_validar (0006): se amplía para comprobar tambien categoria_id,
-- igual que ya hacia con hucha_id. Funcion completa (create or replace no
-- permite anadir solo un fragmento).
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

  -- Misma comprobacion para la categoria.
  if new.categoria_id is not null
     and (tg_op = 'INSERT' or new.categoria_id is distinct from old.categoria_id)
     and not exists (select 1 from public.categorias c where c.id = new.categoria_id) then
    raise exception 'La categoría no existe o no te pertenece'
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

-- ---------------------------------------------------------------------
-- huchas: comprobar que banco_id es del usuario, mismo patron.
-- Trigger aparte de huchas_proteger_campos (0007) para no mezclar
-- responsabilidades: uno blinda campos, este valida una referencia.
-- ---------------------------------------------------------------------
create or replace function public.huchas_validar_banco()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.banco_id is not null
     and (tg_op = 'INSERT' or new.banco_id is distinct from old.banco_id)
     and not exists (select 1 from public.bancos b where b.id = new.banco_id) then
    raise exception 'El banco no existe o no te pertenece'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists huchas_validar_banco on public.huchas;
create trigger huchas_validar_banco
  before insert or update on public.huchas
  for each row execute function public.huchas_validar_banco();
