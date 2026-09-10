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

  console.log("8) Presupuesto: marcar un ahorro lo ingresa en su hucha (0005/0006)")
  // Mismo criterio que public.mes_actual(): el mes en curso en hora de España.
  const mesHoy =
    new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit" })
      .format(new Date()) + "-01"
  const sumarMes = (mes, n) => {
    const [y, m] = mes.split("-").map(Number)
    const t = y * 12 + (m - 1) + n
    return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}-01`
  }
  const saldoAntes = await saldo(huchaId)
  const { data: ahorro, error: errAhorro } = await supabase
    .from("partidas")
    .insert({ tipo: "ahorro", concepto: "__prueba_ahorro__", importe: 25, mes_inicio: mesHoy, hucha_id: huchaId })
    .select()
    .single()
  ok(!errAhorro && ahorro, "se crea una partida de ahorro vinculada a la hucha", errAhorro?.message)
  if (!ahorro) throw new Error("Sin partida no se puede seguir. ¿Has ejecutado 0005 y 0006?")

  const marca = await supabase.from("pagos_partida").insert({ partida_id: ahorro.id, mes: mesHoy }).select().single()
  ok(!marca.error && marca.data?.movimiento_id, "marcar el mes crea el ingreso en la hucha", marca.error?.message)
  s = await saldo(huchaId)
  ok(s === saldoAntes + 25, `el saldo sube de ${saldoAntes} a ${saldoAntes + 25}`, `saldo ${s}`)

  const doble = await supabase.from("pagos_partida").insert({ partida_id: ahorro.id, mes: mesHoy })
  ok(doble.error?.code === "23505", "marcar dos veces el mismo mes se rechaza", doble.error?.code ?? "se aceptó")
  s = await saldo(huchaId)
  ok(s === saldoAntes + 25, "y el intento repetido no deja un ingreso de más", `saldo ${s}`)

  if (marca.data) await supabase.from("pagos_partida").delete().eq("id", marca.data.id)
  s = await saldo(huchaId)
  ok(s === saldoAntes, "desmarcar deshace el ingreso", `saldo ${s}`)
  const { data: movSuelto } = await supabase
    .from("movimientos").select("id").eq("id", marca.data?.movimiento_id ?? "").maybeSingle()
  ok(movSuelto === null, "el movimiento de la aportación ya no existe")

  const futuro = await supabase.from("pagos_partida").insert({ partida_id: ahorro.id, mes: sumarMes(mesHoy, 1) })
  ok(Boolean(futuro.error), "no se puede marcar un mes que no ha llegado", "se aceptó")

  await supabase.from("pagos_partida").insert({ partida_id: ahorro.id, mes: mesHoy })
  await supabase.from("partidas").delete().eq("id", ahorro.id)
  s = await saldo(huchaId)
  ok(s === saldoAntes, "borrar una partida con el mes marcado deshace su aportación", `saldo ${s}`)

  console.log("9) Presupuesto: reglas de las partidas")
  const gastoConHucha = await supabase
    .from("partidas")
    .insert({ tipo: "gasto", concepto: "__prueba_gasto__", importe: 10, mes_inicio: mesHoy, hucha_id: huchaId })
  ok(gastoConHucha.error?.code === "23514", "un gasto no puede tener hucha", gastoConHucha.error?.code ?? "se aceptó")
  const ahorroAjeno = await supabase.from("partidas").insert({
    tipo: "ahorro", concepto: "__prueba_ajena__", importe: 10, mes_inicio: mesHoy,
    hucha_id: "00000000-0000-0000-0000-000000000000",
  })
  ok(Boolean(ahorroAjeno.error), "no se puede vincular una hucha que no es tuya", "se aceptó")

  const { data: internet } = await supabase
    .from("partidas")
    .insert({ tipo: "gasto", concepto: "__prueba_internet__", importe: 72, mes_inicio: sumarMes(mesHoy, -2) })
    .select()
    .single()
  if (!internet) throw new Error("No se pudo crear la partida de prueba de Internet.")
  const cambio = await supabase.rpc("cambiar_importe_partida", {
    p_partida: internet.id, p_desde: mesHoy, p_importe: 34,
  })
  ok(!cambio.error && cambio.data && cambio.data !== internet.id, "cambiar el importe desde este mes crea un tramo nuevo", cambio.error?.message)
  const { data: tramos } = await supabase
    .from("partidas").select("importe, mes_inicio, mes_fin").eq("concepto", "__prueba_internet__").order("mes_inicio")
  const esperado = [[72, sumarMes(mesHoy, -2), sumarMes(mesHoy, -1)], [34, mesHoy, null]]
  const real = (tramos ?? []).map((t) => [Number(t.importe), t.mes_inicio, t.mes_fin])
  ok(JSON.stringify(real) === JSON.stringify(esperado), "72 € hasta el mes pasado y 34 € desde este mes", JSON.stringify(real))

  console.log("10) Huchas «Para pagar» (0007)")
  const inventada = await supabase
    .from("huchas")
    .insert({ nombre: "__prueba_inventada__", tipo: "otro", objetivo: 10, saldo_actual: 5000 })
    .select()
    .single()
  ok(
    !inventada.error && Number(inventada.data?.saldo_actual) === 0,
    "una hucha nueva empieza con saldo 0 aunque se envíe otro",
    inventada.error?.message ?? `saldo ${inventada.data?.saldo_actual}`,
  )
  const limiteEnAhorro = await supabase
    .from("huchas")
    .insert({ nombre: "__prueba_limite__", tipo: "otro", finalidad: "ahorro", objetivo: 100, fecha_limite: mesHoy })
  ok(!limiteEnAhorro.error, "una hucha de ahorro puede tener fecha objetivo (0008)", limiteEnAhorro.error?.message)
  const fechaMala = await supabase
    .from("huchas")
    .insert({ nombre: "__prueba_fecha_mala__", tipo: "otro", fecha_limite: mesHoy.slice(0, 8) + "15" })
  ok(fechaMala.error?.code === "23514", "la fecha objetivo tiene que ser un mes (día 1)", fechaMala.error?.code ?? "se aceptó")
  const pagarAhorro = await supabase.rpc("pagar_hucha", { p_hucha: huchaId })
  ok(Boolean(pagarAhorro.error), "una hucha de ahorro no se puede «pagar»", "se aceptó")

  const { data: hp, error: errHp } = await supabase
    .from("huchas")
    .insert({ nombre: "__prueba_pago__", tipo: "otro", finalidad: "pago", objetivo: 100, fecha_limite: sumarMes(mesHoy, 3) })
    .select()
    .single()
  ok(!errHp && hp, "se crea una hucha para pagar con fecha límite", errHp?.message)
  if (!hp) throw new Error("Sin hucha para pagar no se puede seguir. ¿Has ejecutado 0007?")
  const { data: aporte } = await supabase
    .from("partidas")
    .insert({ tipo: "ahorro", concepto: "__prueba_pago__", importe: 20, mes_inicio: sumarMes(mesHoy, -1), mes_fin: sumarMes(mesHoy, 3), hucha_id: hp.id })
    .select()
    .single()
  if (!aporte) throw new Error("No se pudo crear la aportación de prueba.")
  const marcaPasada = await supabase
    .from("pagos_partida").insert({ partida_id: aporte.id, mes: sumarMes(mesHoy, -1) }).select().single()
  s = await saldo(hp.id)
  ok(!marcaPasada.error && s === 20, "aportar el mes pasado deja 20 € apartados", marcaPasada.error?.message ?? `saldo ${s}`)

  const pagoHucha = await supabase.rpc("pagar_hucha", { p_hucha: hp.id })
  ok(!pagoHucha.error, "se paga la hucha", pagoHucha.error?.message)
  const { data: hpDespues } = await supabase.from("huchas").select("saldo_actual, pagada_at").eq("id", hp.id).single()
  ok(
    Number(hpDespues?.saldo_actual) === 0 && Boolean(hpDespues?.pagada_at),
    "queda a 0 € y archivada como pagada",
    JSON.stringify(hpDespues),
  )
  const { data: salida } = await supabase
    .from("movimientos").select("importe, nota").eq("hucha_id", hp.id).eq("tipo", "retirada").maybeSingle()
  ok(
    Number(salida?.importe) === 20 && salida?.nota === "Pago: __prueba_pago__",
    "el pago queda en su historial como retirada de 20 €",
    JSON.stringify(salida),
  )
  const { data: aporteDespues } = await supabase.from("partidas").select("mes_fin").eq("id", aporte.id).single()
  ok(
    aporteDespues?.mes_fin === sumarMes(mesHoy, -1),
    "la aportación mensual se detiene en el último mes aportado",
    aporteDespues?.mes_fin,
  )

  const movEnPagada = await movimiento(hp.id, "ingreso", 5)
  ok(Boolean(movEnPagada.error), "una hucha pagada no admite movimientos", "se aceptó")
  const desmarcarPagada = await supabase
    .from("pagos_partida").delete().eq("id", marcaPasada.data?.id ?? "").select("id")
  ok(Boolean(desmarcarPagada.error), "no se puede desmarcar una aportación de una hucha pagada", "se aceptó")
  await supabase.from("huchas").update({ pagada_at: null }).eq("id", hp.id)
  const { data: sigue } = await supabase.from("huchas").select("pagada_at").eq("id", hp.id).single()
  ok(Boolean(sigue?.pagada_at), "pagada_at no se puede quitar desde la API")
  const otraVez = await supabase.rpc("pagar_hucha", { p_hucha: hp.id })
  ok(Boolean(otraVez.error), "no se puede pagar dos veces", "se aceptó")
  const borrarPagada = await supabase.from("huchas").delete().eq("id", hp.id).select("id")
  ok(
    !borrarPagada.error && borrarPagada.data?.length === 1,
    "una hucha pagada sí se puede eliminar entera",
    borrarPagada.error?.message,
  )

  console.log("11) Borrar la hucha borra sus movimientos (cascada)")
  const del = await supabase.from("huchas").delete().eq("id", huchaId).select("id")
  ok(!del.error && del.data?.length === 1, "se borra la hucha", del.error?.message)
  const quedan = await contarMovimientos(huchaId)
  ok(quedan === 0, "no quedan movimientos huérfanos", `quedan ${quedan}`)
  if (!del.error && del.data?.length === 1) huchaId = null
} catch (e) {
  fallos++
  console.error(`  ERROR  ${e.message}`)
} finally {
  // Por nombre: limpia también restos de una ejecución anterior que se
  // cortara. Los "_" van escapados porque en LIKE significan "cualquier
  // carácter". Primero las huchas (sus movimientos y meses marcados caen en
  // cascada) y después las partidas que quedan sin hucha: al revés, desmarcar
  // la aportación de una hucha pagada lo impediría la propia base de datos.
  await supabase.from("huchas").delete().like("nombre", "\\_\\_prueba%")
  await supabase.from("partidas").delete().like("concepto", "\\_\\_prueba%")
  await supabase.auth.signOut()
}

console.log(fallos === 0 ? "\nTodo correcto." : `\n${fallos} comprobación(es) fallida(s).`)
process.exit(fallos === 0 ? 0 : 1)
