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

## Pendiente importante

La app **no tiene autenticación**: cualquiera con la URL ve los datos médicos de
Gaelito. Antes de compartir el enlace, protégela (Vercel Password Protection, o
un `proxy.js` con contraseña compartida).
