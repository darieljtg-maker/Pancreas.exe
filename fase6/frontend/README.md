# PancreasOS · Frontend

PWA mobile-first en Next.js 16 (App Router) + Tailwind v4. Lee y escribe
directo en Neon desde Server Components y Server Actions.

```bash
cd frontend
npm install
cp .env.example .env.local   # completa DATABASE_URL
npm run dev                  # http://localhost:3000
```

## Rutas

| Ruta | Qué hace | Tablas |
|---|---|---|
| `/` | Glucosa actual en grande, con color por rango y flecha de tendencia. Última insulina, última comida y totales del día. | `cgm_readings`, `insulin_logs`, `meals` |
| `/registro` | Alta de comida, insulina, agua y actividad en pestañas. | `meals`, `insulin_logs`, `water_logs`, `activities` |
| `/historial` | Curva del día, tiempo en rango y línea de tiempo de eventos. | todas |

`/registro?tipo=insulina` abre directo esa pestaña (lo usan los accesos
directos del manifest).

## Estructura

```
app/
  layout.js            Tema, metadata PWA, navegación inferior
  page.js              Dashboard
  registro/page.js     Formularios
  historial/page.js    Gráfica + timeline
  actions.js           Server Actions (los INSERT)
lib/
  config.js            TZ y rango objetivo (lo usan servidor y cliente)
  db.js                Pool de Neon
  queries.js           Todos los SELECT
  glucosa.js           Color por rango, flechas y formato de fechas
components/            Hero, tarjetas, formularios, gráfica, timeline
```

## El plan alimenticio vive en un solo archivo

`lib/menus.js` concentra TODO lo clínico: las dosis fijas de Lyumjev, los dos menús de
cada comida, los gramos de carbohidratos de cada alimento, el objetivo de 120 mg/dL, el
factor de sensibilidad de 4 y el protocolo de rescate.

**Si el nutriólogo o el endocrinólogo cambian algo, se edita ahí y solo ahí.** Ningún
componente tiene números clínicos escritos dentro.

### Calculadora de porciones

Como las dosis no se mueven, lo que se ajusta es el plato:

```
ajuste = (120 − glucosa actual) ÷ 4          → gramos de carbos a sumar o restar
gramos en báscula = carbos ajustados × (gramos base ÷ carbos base)
```

Los alimentos fijos nunca cambian; solo se recalcula el "alimento ajustable" de cada menú.
Si la glucosa viene tan alta que la ración daría negativo, se topa en 0 g.

### Protocolo de hipoglucemia

Por debajo de 70 mg/dL —venga del sensor o escrito a mano— se toma la pantalla completa
con las tres fases: rescate rápido, espera de 15 minutos y colación de mantenimiento.

El cronómetro se guarda en `localStorage` con su hora de vencimiento absoluta, así que
sigue corriendo aunque se bloquee el celular o se cierre la app.

## Decisiones que conviene conocer

**Sin API Routes.** Las páginas son Server Components y llaman a `lib/queries.js`
directamente; los formularios usan Server Actions. Una capa REST intermedia solo
añadiría latencia y código que mantener.

**Las fechas se formatean en el servidor**, siempre con `APP_TIMEZONE` explícito.
Si se formatearan en el navegador, el HTML del servidor y el del cliente no
coincidirían y React tiraría un error de hidratación. Por lo mismo, "hoy" se
calcula en SQL con la zona horaria, no con el reloj UTC de Vercel.

**Nada se cachea.** Las tres rutas son `force-dynamic` y el service worker solo
guarda los assets estáticos de Next. Mostrar una glucosa vieja como si fuera la
actual sería peor que no mostrar nada.

**Las Server Actions validan rangos** antes de tocar la base: máximo 100 U de
insulina, 500 g de carbohidratos, 3000 ml de agua. No son límites clínicos, son
un freno a los errores de dedo.

**El tema es oscuro a propósito.** Esta app se abre de noche para revisar una
hipoglucemia; una pantalla blanca a las 3am deslumbra.

## El candado (PIN)

`proxy.js` corta las peticiones antes de que Next renderice nada: quien no traiga
una cookie de sesión válida recibe una redirección a `/pin`, nunca los datos.

El PIN se valida en el servidor con `APP_PIN` y la sesión viaja en una cookie
`httpOnly` cuyo valor es un HMAC del PIN, no el PIN. **No se usa
`NEXT_PUBLIC_APP_PIN` como fuente principal**: todo lo que lleva ese prefijo se
incrusta en el JavaScript que descarga el navegador y el PIN quedaría a la vista
en las herramientas de desarrollo. Se acepta como respaldo, pero conviene migrar.

Si `APP_PIN` no está definida, la app queda **cerrada** y lo dice en pantalla.
Falla del lado seguro: es preferible un despliegue inaccesible a uno que publique
el historial médico de un niño.

Cambiar el PIN invalida todas las sesiones abiertas, porque el token se deriva de él.

## Análisis con IA (Gemini)

Dos Server Actions en `app/ai-actions.js`:

| Función | Modelo | Cuándo corre |
|---|---|---|
| `pronosticoCorto()` | `GEMINI_MODEL_FLASH` | Al abrir el dashboard, en streaming |
| `auditoriaSemanal()` | `GEMINI_MODEL_PRO` | Solo al pulsar el botón en `/historial` |

El vigilante cachea su respuesta en memoria por `VIGILANTE_TTL_MINUTOS` y la
indexa por el timestamp de la última lectura: refrescar el dashboard no vuelve a
gastar cuota si el sensor no mandó dato nuevo.

Los identificadores de modelo son variables de entorno a propósito. Si Google
renombra o retira alguno, se cambia en Vercel sin volver a desplegar código;
`listarModelosDisponibles()` sirve para ver cuáles reconoce tu API key.

**La IA es orientativa.** La alerta de hipoglucemia por debajo de 70 mg/dL es
determinista, vive en `AlertaHipoglucemia.js` y no depende de que el modelo
acierte ni de que la API responda.
