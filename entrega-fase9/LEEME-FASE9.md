# PancreasOS · Fase 9 — Modo clínico dual y fitness

## Qué hay en este paquete

- `pancreasos/` — el proyecto **completo** tal y como debe verse en GitHub.
  Sube esta carpeta entera; es la forma segura de que no se pierda nada.
- `solo-lo-nuevo/` — solo los 9 archivos que cambian en esta fase, con la
  misma estructura de carpetas.
- `pancreasos-fase9.bundle` — el repo con los commits. Si prefieres git:
  `git pull /ruta/al/pancreasos-fase9.bundle claude/pancreasos-sync-backend-fpdvlx`

## Antes de nada: corre el SQL en Neon

Pega `sql/002_daily_log.sql` en el editor SQL de Neon, igual que hiciste con
las seis tablas originales. Sin eso, `/plan` calcula pero no puede registrar
lo que Gaelito come (y te lo avisa en pantalla en vez de reventar).

## Archivos de esta fase

| Archivo | Qué hace |
|---|---|
| `sql/002_daily_log.sql` | Tabla `daily_log` (fecha en hora de México, no UTC) |
| `frontend/lib/calculosNutricionales.js` | Motor: TMB, macros, ruta A/B, alba, UGP |
| `frontend/components/PlanificadorDiario.js` | La pantalla del planificador |
| `frontend/components/BarraProgreso.js` | Barras de consumido contra meta |
| `frontend/app/plan/page.js` | La ruta `/plan` |
| `frontend/app/nutricion-actions.js` | Guardar y borrar consumo |
| `frontend/app/ai-actions.js` | + `generarOpcionesComida` y `calcularAntojo` |
| `frontend/lib/queries.js` | + `getConsumoDelDia` y `existeDailyLog` |
| `frontend/components/BottomNav.js` | Cuarta pestaña, "Plan" |

## Variables de entorno

Nada nuevo es obligatorio. Dos opcionales:

- `GEMINI_MODEL_NUTRICION` — modelo para menús y antojos. Si no la pones,
  usa el mismo de `GEMINI_MODEL_FLASH`.
- `NEXT_PUBLIC_ICR` — ratio insulina/carbohidrato por defecto (ahora 12).
  **Este número lo define el endocrinólogo**, no se puede deducir del plan
  actual: ahí las dosis son fijas y el ICR implícito va de 10.3 a 17 g/U.
  De todos modos se puede cambiar desde la pantalla sin tocar código.

## Los números de Gaelito

TMB 1301 kcal (Mifflin-St Jeor) × 1.55 de actividad + 300 de superávit
= **2317 kcal/día** → 90.2 g de proteína (2.2 g/kg), 90.1 g de grasa (35%)
y 286.2 g de carbohidratos.

Reparto: desayuno 25%, colación 10%, comida 30%, colación 10%, cena 25%.
