/**
 * Prueba de integración contra tu proyecto de Supabase real.
 *
 *   npm run test:integracion
 *
 * Entra con tu usuario, crea una hucha temporal "__prueba_integracion__",
 * comprueba triggers, RLS y restricciones tal y como los usa la app, y la
 * borra al terminar pase lo que pase. No toca tus huchas reales.
 *
 * Pide email y contraseña por teclado; la contraseña no se muestra ni se
 * guarda en ningún sitio. También acepta TEST_EMAIL y TEST_PASSWORD como
 * variables de entorno.
 */
import { readFileSync } from "node:fs"
import readline from "node:readline"
import { createClient } from "@supabase/supabase-js"

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
const leer = (k) => env.match(new RegExp(`^${k}=(.*)$`, "m"))?.[1]?.trim()
const supabase = createClient(leer("VITE_SUPABASE_URL"), leer("VITE_SUPABASE_ANON_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
})

function preguntar(texto, oculto = false) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    })
    rl.question(texto, (respuesta) => {
      rl.close()
      if (oculto) process.stdout.write("\n")
      resolve(oculto ? respuesta : respuesta.trim())
    })
    // El prompt ya se ha escrito; a partir de aquí no se muestra lo que teclees.
    if (oculto) rl._writeToOutput = () => {}
  })
}

let fallos = 0
function ok(condicion, texto, detalle) {
  const extra = !condicion && detalle !== undefined ? `  -> ${detalle}` : ""
  console.log(`  ${condicion ? "OK   " : "FALLO"}  ${texto}${extra}`)
  if (!condicion) fallos++
}

const email = process.env.TEST_EMAIL || (await preguntar("Email: "))
const password =
  process.env.TEST_PASSWORD || (await preguntar("Contraseña (no se muestra): ", true))

const { data: sesion, error: errorLogin } = await supabase.auth.signInWithPassword({
  email,
  password,
})
if (errorLogin) {
  console.error(`\nNo se pudo iniciar sesión: ${errorLogin.message}`)
  process.exit(1)
}
const uid = sesion.user.id
console.log(`\nSesión iniciada como ${sesion.user.email}\n`)

const saldo = async (id) => {
  const { data } = await supabase.from("huchas").select("saldo_actual").eq("id", id).single()
  return Number(data?.saldo_actual)
}
const movimiento = (hucha_id, tipo, importe) =>
  supabase.from("movimientos").insert({ hucha_id, tipo, importe }).select().single()
const contarMovimientos = async (hucha_id) => {
  const { count } = await supabase
    .from("movimientos")
    .select("id", { count: "exact", head: true })
    .eq("hucha_id", hucha_id)
  return count
}

let huchaId = null
try {
  console.log("1) Crear hucha")
  const { data: h, error } = await supabase
    .from("huchas")
    .insert({ nombre: "__prueba_integracion__", tipo: "ahorro", objetivo: 1000 })
    .select()
    .single()
  ok(!error && h, "se crea la hucha", error?.message)
  if (!h) throw new Error("Sin hucha no se puede seguir.")
  huchaId = h.id
  ok(h.usuario_id === uid, "usuario_id se rellena solo con tu id")
  ok(Number(h.saldo_actual) === 0, "empieza con saldo 0", h.saldo_actual)

  console.log("2) Recálculo de saldo (punto a) y usuario_id automático (punto b)")
  const m1 = await movimiento(huchaId, "ingreso", 500)
  const m2 = await movimiento(huchaId, "ingreso", 200)
  const m3 = await movimiento(huchaId, "retirada", 150)
  const errMov = m1.error || m2.error || m3.error
  ok(!errMov, "se registran 3 movimientos", errMov?.message)
  if (errMov) throw new Error("Sin movimientos no se puede seguir.")
  let s = await saldo(huchaId)
  ok(s === 550, "saldo = 500 + 200 - 150 = 550", `saldo ${s}`)
  ok(m1.data.usuario_id === uid, "movimientos.usuario_id se copia de la hucha")

  console.log("3) saldo_actual blindado")
  await supabase.from("huchas").update({ saldo_actual: 99999 }).eq("id", huchaId)
  s = await saldo(huchaId)
  ok(s === 550, "escribirlo a mano no tiene efecto", `saldo ${s}`)

  console.log("4) Saldo nunca negativo (0004)")
  const r = await movimiento(huchaId, "retirada", 600)
  ok(
    r.error?.code === "23514",
    "retirar 600 con 550 disponibles se rechaza",
    r.error ? `código ${r.error.code}` : "se aceptó: ¿has ejecutado 0004?",
  )
  // Si se aceptó, se deshace para que los pasos siguientes partan de 550.
  if (!r.error && r.data) await supabase.from("movimientos").delete().eq("id", r.data.id)
  s = await saldo(huchaId)
  ok(s === 550, "el saldo sigue en 550", `saldo ${s}`)
  const n = await contarMovimientos(huchaId)
  ok(n === 3, "el movimiento rechazado no se guardó", `hay ${n}`)

  console.log("5) Borrar movimientos recalcula el saldo")
  await supabase.from("movimientos").delete().eq("id", m1.data.id)
  s = await saldo(huchaId)
  ok(s === 50, "borrar el ingreso de 500 deja 50", `saldo ${s}`)
  const b = await supabase.from("movimientos").delete().eq("id", m2.data.id).select("id")
  ok(
    b.error?.code === "23514",
    "borrar el ingreso de 200 (dejaría -150) se rechaza",
    b.error ? `código ${b.error.code}` : "se aceptó: ¿has ejecutado 0004?",
  )
  s = await saldo(huchaId)
  ok(s === 50, "el saldo sigue en 50", `saldo ${s}`)

  console.log("6) Dos retiradas simultáneas que no caben juntas (bloqueo de 0004)")
  await movimiento(huchaId, "ingreso", 750)
  const base = await saldo(huchaId)
  const [ra, rb] = await Promise.all([
    movimiento(huchaId, "retirada", 500),
    movimiento(huchaId, "retirada", 500),
  ])
  const aceptadas = [ra, rb].filter((x) => !x.error).length
  s = await saldo(huchaId)
  ok(aceptadas === 1, `con ${base} disponibles solo pasa una de las dos`, `pasaron ${aceptadas}`)
  ok(s === base - 500, `el saldo queda en ${base - 500}`, `saldo ${s}`)

  console.log("7) RLS: no se puede escribir en huchas ajenas")
  const ajena = await movimiento("00000000-0000-0000-0000-000000000000", "ingreso", 10)
  ok(Boolean(ajena.error), "insertar en una hucha que no es tuya se rechaza", "se aceptó")

  console.log("8) Borrar la hucha borra sus movimientos (cascada)")
  const del = await supabase.from("huchas").delete().eq("id", huchaId).select("id")
  ok(!del.error && del.data?.length === 1, "se borra la hucha", del.error?.message)
  const quedan = await contarMovimientos(huchaId)
  ok(quedan === 0, "no quedan movimientos huérfanos", `quedan ${quedan}`)
  if (!del.error && del.data?.length === 1) huchaId = null
} catch (e) {
  fallos++
  console.error(`  ERROR  ${e.message}`)
} finally {
  if (huchaId) {
    await supabase.from("huchas").delete().eq("id", huchaId)
    console.log("\n  (limpieza: hucha de prueba borrada)")
  }
  await supabase.auth.signOut()
}

console.log(fallos === 0 ? "\nTodo correcto." : `\n${fallos} comprobación(es) fallida(s).`)
process.exit(fallos === 0 ? 0 : 1)
