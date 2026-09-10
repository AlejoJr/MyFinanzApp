-- =====================================================================
-- MyFinanzApp · 0008 · Fecha objetivo tambien en huchas de ahorro
-- Ejecutar DESPUES de 0007. Idempotente.
--
-- En 0007 solo las huchas "Para pagar" podian tener fecha. Ahora una
-- hucha de ahorro tambien puede tener fecha objetivo ("quiero 3.000 € en
-- junio de 2027"): la app calcula la cuota y te dice si vas al dia. La
-- diferencia sigue estando en el final: una "Para pagar" se paga y se
-- archiva; una de ahorro se queda con su dinero.
--
-- La columna sigue llamandose fecha_limite para no romper nada; la regla
-- de que sea un mes (dia 1) y la de que solo se pagan las "Para pagar"
-- siguen igual.
-- =====================================================================

alter table public.huchas drop constraint if exists huchas_limite_solo_pago;

comment on column public.huchas.fecha_limite is
  'Ultimo mes para reunir el objetivo (dia 1). Opcional en ahorro; en "Para pagar", el mes en que toca pagar.';
