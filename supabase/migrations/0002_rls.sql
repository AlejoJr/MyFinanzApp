-- =====================================================================
-- MyFinanzApp · 0002 · Row Level Security
-- Ejecutar DESPUES de 0001. Idempotente.
--
-- Nota de rendimiento: se usa (select auth.uid()) y no auth.uid() a
-- secas. Envuelto en un subquery, Postgres lo evalua UNA vez por
-- consulta; sin envolver lo llama una vez POR FILA.
-- =====================================================================

alter table public.huchas       enable row level security;
alter table public.movimientos  enable row level security;
alter table public.gastos_fijos enable row level security;

-- Sin esto, el propietario de las tablas se saltaria las politicas.
alter table public.huchas       force row level security;
alter table public.movimientos  force row level security;
alter table public.gastos_fijos force row level security;

-- ---------------------------------------------------------------------
-- huchas
-- ---------------------------------------------------------------------
drop policy if exists "huchas: leer las propias"     on public.huchas;
drop policy if exists "huchas: crear las propias"    on public.huchas;
drop policy if exists "huchas: editar las propias"   on public.huchas;
drop policy if exists "huchas: borrar las propias"   on public.huchas;

create policy "huchas: leer las propias"
  on public.huchas for select to authenticated
  using (usuario_id = (select auth.uid()));

create policy "huchas: crear las propias"
  on public.huchas for insert to authenticated
  with check (usuario_id = (select auth.uid()));

create policy "huchas: editar las propias"
  on public.huchas for update to authenticated
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));

create policy "huchas: borrar las propias"
  on public.huchas for delete to authenticated
  using (usuario_id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- movimientos
--
-- Gracias a usuario_id desnormalizado la politica es directa. La
-- seguridad frente a "insertar en la hucha de otro" no se pierde: el
-- trigger de 0003 rellena usuario_id copiandolo de la hucha, y el
-- WITH CHECK se evalua DESPUES de los triggers BEFORE. Si la hucha
-- fuese de otro usuario, usuario_id no coincidiria con auth.uid() y la
-- insercion se rechaza.
-- ---------------------------------------------------------------------
drop policy if exists "movimientos: leer los propios"   on public.movimientos;
drop policy if exists "movimientos: crear los propios"  on public.movimientos;
drop policy if exists "movimientos: editar los propios" on public.movimientos;
drop policy if exists "movimientos: borrar los propios" on public.movimientos;

create policy "movimientos: leer los propios"
  on public.movimientos for select to authenticated
  using (usuario_id = (select auth.uid()));

create policy "movimientos: crear los propios"
  on public.movimientos for insert to authenticated
  with check (usuario_id = (select auth.uid()));

create policy "movimientos: editar los propios"
  on public.movimientos for update to authenticated
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));

create policy "movimientos: borrar los propios"
  on public.movimientos for delete to authenticated
  using (usuario_id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- gastos_fijos
-- ---------------------------------------------------------------------
drop policy if exists "gastos: leer los propios"   on public.gastos_fijos;
drop policy if exists "gastos: crear los propios"  on public.gastos_fijos;
drop policy if exists "gastos: editar los propios" on public.gastos_fijos;
drop policy if exists "gastos: borrar los propios" on public.gastos_fijos;

create policy "gastos: leer los propios"
  on public.gastos_fijos for select to authenticated
  using (usuario_id = (select auth.uid()));

create policy "gastos: crear los propios"
  on public.gastos_fijos for insert to authenticated
  with check (usuario_id = (select auth.uid()));

create policy "gastos: editar los propios"
  on public.gastos_fijos for update to authenticated
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));

create policy "gastos: borrar los propios"
  on public.gastos_fijos for delete to authenticated
  using (usuario_id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- El rol anon (usuarios sin login) no debe tocar nada. Sin politicas
-- para "anon" ya no puede, pero revocamos tambien a nivel de permisos.
-- ---------------------------------------------------------------------
revoke all on public.huchas       from anon;
revoke all on public.movimientos  from anon;
revoke all on public.gastos_fijos from anon;
