-- =====================================================================
-- MyFinanzApp · 0009 · Mantener activo el proyecto (evitar la pausa)
-- Ejecutar DESPUES de 0008. Idempotente.
--
-- Supabase pausa los proyectos gratuitos tras 7 dias sin actividad. Una
-- llamada al microservicio de Auth (como /auth/v1/settings, que usamos en
-- el login) no siempre cuenta como actividad de BASE DE DATOS. Esta
-- funcion es una consulta real a Postgres, minima y sin datos: un cron
-- diario de Vercel la llama (ver api/mantener-activo.ts) para que el
-- proyecto nunca llegue a los 7 dias inactivo.
-- =====================================================================

create or replace function public.mantener_activo()
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select now();
$$;

comment on function public.mantener_activo() is
  'Ping de Postgres para el cron anti-pausa de Vercel. No lee ni escribe ninguna tabla.';

-- A diferencia del resto de funciones de la app (solo para usuarios con
-- sesion), a esta la llama un cron sin login: tiene que poder ejecutarla
-- el rol anon. No hay riesgo: no expone ningun dato, solo la hora del
-- servidor (que ya es publica en la cabecera HTTP Date de cualquier
-- respuesta).
revoke execute on function public.mantener_activo() from public;
grant  execute on function public.mantener_activo() to anon, authenticated;
