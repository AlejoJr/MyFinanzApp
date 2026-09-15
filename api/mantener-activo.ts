/**
 * Cron diario de Vercel (ver vercel.json → "crons") que evita que Supabase
 * pause el proyecto gratuito por 7 días sin actividad. Llama a una función
 * mínima de Postgres por RPC (0009): cuenta como uso real de la base de
 * datos, no solo del servicio de Auth.
 *
 * Vive fuera de src/ a propósito: Vite no lo empaqueta en el bundle del
 * navegador, y Vercel lo despliega solo como función serverless aparte
 * (zero-config, no hace falta declararlo en ningún sitio más).
 *
 * Reutiliza las mismas variables VITE_SUPABASE_* que el frontend: Vercel
 * las expone también a las funciones serverless, con independencia de que
 * el prefijo VITE_ sea una convención de Vite para el navegador.
 *
 * Si defines la variable de entorno CRON_SECRET en Vercel, esta función
 * exige que la llamada la traiga (Vercel se lo añade solo a las llamadas
 * que él mismo programa). Es opcional: sin ella, el cron sigue
 * funcionando igual, solo que cualquiera podría llamar al endpoint a
 * mano — no supone un riesgo real, porque no expone ni cambia datos.
 */
export default async function handler(req: any, res: any) {
  const secreto = process.env.CRON_SECRET
  if (secreto && req.headers?.authorization !== `Bearer ${secreto}`) {
    res.status(401).json({ ok: false, error: "No autorizado" })
    return
  }

  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) {
    res.status(500).json({ ok: false, error: "Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en Vercel" })
    return
  }

  try {
    const r = await fetch(`${url}/rest/v1/rpc/mantener_activo`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: "{}",
    })
    if (!r.ok) throw new Error(`Supabase respondió ${r.status}: ${await r.text()}`)
    const hora = await r.json()
    res.status(200).json({ ok: true, hora })
  } catch (e) {
    res.status(502).json({ ok: false, error: e instanceof Error ? e.message : "Fallo desconocido" })
  }
}
