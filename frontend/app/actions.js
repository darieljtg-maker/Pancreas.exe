"use server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { query, TZ } from "@/lib/db";
import { COOKIE_SESION, tokenValido } from "@/lib/auth";
import { getPacienteId } from "@/lib/queries";
import { TIPOS_COMIDA } from "@/lib/pauta.mjs";
import { calcularPlato } from "@/lib/nutricion.mjs";
import catalogo from "@/lib/alimentos.json";

async function haySesion() {
  const c = await cookies();
  return tokenValido(c.get(COOKIE_SESION)?.value);
}
function numero(valor, min, max, campo) {
  if (valor == null || String(valor).trim() === "")
    throw new Error(campo + ": falta el valor.");
  const n = Number(String(valor).replace(",", "."));
  if (!Number.isFinite(n) || n < min || n > max)
    throw new Error(
      campo + ": escribe un valor entre " + min + " y " + max + ".",
    );
  return n;
}
function idSolicitud(formData) {
  const id = String(formData.get("request_id") || "");
  if (!/^[a-f0-9-]{36}$/i.test(id))
    throw new Error("Recarga el formulario antes de guardar.");
  return id;
}
function horaOpcional(valor) {
  const h = String(valor || "");
  if (!h) return null;
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(h))
    throw new Error("Hora no válida.");
  const ahora = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
  if (h > ahora)
    throw new Error(
      "No se puede registrar una hora futura. Se usa la fecha de hoy.",
    );
  return h;
}
function refrescar() {
  revalidatePath("/");
  revalidatePath("/historial");
  revalidatePath("/registro");
}
function fechaSql(indice) {
  return (
    "CASE WHEN $" +
    indice +
    "::text IS NULL THEN now() ELSE ((now() AT TIME ZONE '" +
    TZ +
    "')::date + $" +
    indice +
    "::time) AT TIME ZONE '" +
    TZ +
    "' END"
  );
}
function fallo(err) {
  console.error("[registro]", err?.code || "validation");
  return {
    ok: false,
    mensaje: err?.code
      ? "No se pudo guardar. Intenta de nuevo; un reintento no duplicará este registro."
      : err.message,
  };
}
export async function registrarComida(_estado, formData) {
  if (!(await haySesion())) return { ok: false, mensaje: "Sesión no válida." };
  try {
    const tipo = String(formData.get("meal_type") || "");
    if (!TIPOS_COMIDA.includes(tipo))
      throw new Error("Elige el tipo de comida.");
    const descripcion = String(formData.get("description") || "").trim();
    if (!descripcion || descripcion.length > 1000)
      throw new Error("Describe la comida, hasta 1000 caracteres.");
    const requestId = idSolicitud(formData);
    const hora = horaOpcional(formData.get("hora"));
    const ingredientes = String(formData.get("ingredients") || "");
    let nutrition = null;
    let carbos;
    if (ingredientes) {
      let parsed;
      try {
        parsed = JSON.parse(ingredientes);
      } catch {
        throw new Error("No se pudo leer el plato. Vuelve a seleccionarlo.");
      }
      const plato = calcularPlato(parsed, catalogo);
      carbos = plato.totals.carbs;
      nutrition = {
        source: "USDA SR Legacy 04/2018",
        totals: plato.totals,
        foods: plato.foods.map((f) => ({
          id: f.id,
          grams: f.grams,
          name: f.name,
          url: f.url,
          preparation: f.preparation,
          per100g: f.per100g,
        })),
      };
    } else {
      carbos = numero(formData.get("carbs_grams"), 0, 500, "Carbohidratos");
      const protein = formData.get("protein_grams");
      const fat = formData.get("fat_grams");
      const kcal = formData.get("kcal");
      nutrition = {
        source: "Registro manual o etiqueta del producto",
        totals: {
          carbs: carbos,
          protein:
            protein == null || protein === ""
              ? null
              : numero(protein, 0, 300, "Proteína"),
          fat: fat == null || fat === "" ? null : numero(fat, 0, 300, "Grasa"),
          kcal:
            kcal == null || kcal === ""
              ? null
              : numero(kcal, 0, 3000, "Energía"),
        },
      };
    }
    if (carbos > 500)
      throw new Error(
        "Revisa el peso de los alimentos: el conteo supera el límite del formulario.",
      );
    const pacienteId = await getPacienteId();
    const r = await query(
      'INSERT INTO meals (user_id,meal_type,description,carbs_grams,"timestamp",nutrition,request_id) VALUES ($1,$2,$3,$4,' +
        fechaSql(5) +
        ",$6::jsonb,$7) ON CONFLICT (request_id) DO NOTHING RETURNING id",
      [
        pacienteId,
        tipo,
        descripcion,
        carbos,
        hora,
        JSON.stringify(nutrition),
        requestId,
      ],
    );
    refrescar();
    return {
      ok: true,
      mensaje: r.rowCount
        ? "Comida guardada: " +
          carbos +
          " g de carbohidratos. No se registró ninguna inyección."
        : "Esta comida ya estaba guardada. No se duplicó.",
    };
  } catch (err) {
    return fallo(err);
  }
}
export async function registrarInsulina(_estado, formData) {
  if (!(await haySesion())) return { ok: false, mensaje: "Sesión no válida." };
  try {
    const tipo = String(formData.get("type") || "");
    if (!["Lyumjev", "Tresiba"].includes(tipo))
      throw new Error("Elige el tipo de insulina.");
    const units = numero(
      formData.get("units"),
      0.5,
      100,
      "Unidades administradas",
    );
    const hora = horaOpcional(formData.get("hora"));
    const requestId = idSolicitud(formData);
    if (formData.get("administered") !== "yes")
      throw new Error("Confirma que esta dosis ya fue administrada.");
    const r = await query(
      'INSERT INTO insulin_logs (type,units,"timestamp",request_id) VALUES ($1,$2,' +
        fechaSql(3) +
        ",$4) ON CONFLICT (request_id) DO NOTHING RETURNING id",
      [tipo, units, hora, requestId],
    );
    refrescar();
    return {
      ok: true,
      mensaje: r.rowCount
        ? tipo + ": " + units + " U guardadas como administradas."
        : "Esta dosis ya estaba guardada. No se duplicó.",
    };
  } catch (err) {
    return fallo(err);
  }
}
