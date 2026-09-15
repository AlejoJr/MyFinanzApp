-- =====================================================================
-- MyFinanzApp · 0010 · Descripcion libre en las partidas
-- Ejecutar DESPUES de 0009. Idempotente.
--
-- El "concepto" es el nombre corto de la fila ("Seguro de vida"); la
-- descripcion es el detalle largo y opcional (aseguradora, numero de
-- poliza, que cubre...). No participa en el agrupado de tramos por mes
-- (eso sigue siendo tipo + concepto, ver claveConcepto en presupuesto.ts):
-- cambiar solo la descripcion no crea un tramo nuevo.
-- =====================================================================

alter table public.partidas
  add column if not exists descripcion text;

alter table public.partidas drop constraint if exists partidas_descripcion_check;
alter table public.partidas
  add constraint partidas_descripcion_check
  check (descripcion is null or length(descripcion) <= 500);

comment on column public.partidas.descripcion is
  'Detalle opcional del concepto (hasta 500 caracteres): aseguradora, numero de poliza, cobertura...';
