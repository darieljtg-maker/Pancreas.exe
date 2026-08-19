# CGM Sync Worker

Microservicio que lee la glucosa de Gaelito desde su **FreeStyle Libre 2** (a través de
LibreLinkUp) y la inserta en la tabla `cgm_readings` de **Neon (PostgreSQL)** cada 5 minutos.

Corre solo, sin supervisión, y está diseñado para no morirse cuando se cae el internet de
casa, cuando Abbott tiene un mal día o cuando Neon suspende la conexión.

---

## Puesta en marcha

```bash
cd backend
npm install
cp .env.example .env      # y completa DATABASE_URL, LIBRE_EMAIL, LIBRE_PASSWORD
npm run doctor            # verifica credenciales, red y esquema SIN escribir nada
npm start                 # arranca el worker en modo continuo
```

### Comandos

| Comando | Qué hace |
|---|---|
| `npm start` | Modo continuo. Sincroniza cada `SYNC_INTERVAL_MINUTES` (5 por defecto). |
| `npm run doctor` | Diagnóstico: valida login, esquema y lectura. **No escribe en la base.** |
| `npm run once` | Un solo ciclo y sale. Útil para cron o para probar. |
| `npm run dry-run` | Un ciclo mostrando la lectura, sin insertar nada. |

---

## Antes de arrancar: la cuenta correcta

`LIBRE_EMAIL` / `LIBRE_PASSWORD` son de la cuenta de **LibreLinkUp** (la app del *cuidador*,
la tuya), **no** la de LibreLink que Gaelito usa en su teléfono para escanear el sensor.

Para que haya datos que leer:

1. Gaelito tiene la app **LibreLink** con su sensor activo y conexión a internet.
2. Desde su app envía una invitación para compartir con tu correo.
3. Tú aceptas esa invitación en la app **LibreLinkUp**.
4. Confirma que ves su glucosa en LibreLinkUp antes de correr el worker.

Si tu cuenta sigue a más de un paciente, el worker se detiene al arrancar y te imprime los
`patientId` disponibles: copia el de Gaelito en `LIBRE_PATIENT_ID`.

---

## Qué escribe en la base

Un `INSERT` por lectura en `cgm_readings`:

| Columna | Valor |
|---|---|
| `glucose_value` | Glucosa en **mg/dL** (entero). Si la cuenta está en mmol/L, se convierte. |
| `trend_arrow` | Tendencia. Si la columna es de texto guarda `Flat`, `FortyFiveUp`…; si es numérica, el código de Abbott (0–5). |
| `timestamp` | Instante real de la medición (el `FactoryTimestamp` UTC de Abbott), **no** la hora en que corrió el worker. |
| `user_id` | Solo si la columna existe y defines `PATIENT_USER_ID`. |

Códigos de tendencia:

| Código | Nombre | Significa |
|---|---|---|
| 0 | `NotComputable` | Sin tendencia disponible |
| 1 | `SingleDown` ↓ | Bajando rápido |
| 2 | `FortyFiveDown` ↘ | Bajando |
| 3 | `Flat` → | Estable |
| 4 | `FortyFiveUp` ↗ | Subiendo |
| 5 | `SingleUp` ↑ | Subiendo rápido |

### Sin duplicados

El sensor produce una lectura cada 5 minutos, pero si el teléfono no ha sincronizado, la API
devuelve la misma medición varias veces. El `INSERT` lleva un `WHERE NOT EXISTS` sobre el
`timestamp`, así que repetir una lectura **no** crea filas duplicadas — no hace falta un
índice `UNIQUE`, aunque si lo añades tampoco estorba.

---

## Robustez

Lo que ya está resuelto y verificado:

- **Internet caído / API de Abbott en 5xx** → 3 reintentos con backoff exponencial y jitter
  dentro del ciclo; si aun así falla, lo registra y espera al siguiente ciclo. El proceso
  nunca se muere por esto.
- **Base de datos caída a mitad de operación** → reintenta el `INSERT` y se reconecta solo
  cuando Neon vuelve, sin perder la lectura en curso.
- **Token expirado / HTTP 401** → invalida la sesión y vuelve a autenticarse automáticamente.
- **Redirect regional** → si la cuenta vive en otra región, el login lo detecta y se reconecta
  al host correcto sin configuración manual.
- **Términos de uso pendientes** → intenta aceptarlos solo; si no puede, te dice que abras la app.
- **Errores de configuración** (credenciales malas, tabla inexistente, columna faltante) →
  falla **de inmediato** y con un mensaje concreto, en vez de reintentar en vano.
- **Datos corruptos** → una glucosa fuera del rango 20–600 mg/dL se descarta con un aviso
  antes de tocar la base, para no contaminar el historial que después alimentará el análisis.
- **Ciclos solapados** → si un ciclo se atora, el siguiente disparo se omite en vez de acumularse.
- **`Ctrl+C` / `SIGTERM`** → cierre limpio: cierra el pool de Postgres e imprime un resumen.
- **Rate limiting (429)** → respeta el header `Retry-After` de Abbott.

---

## Notas de operación

**El worker es un lector, no una fuente.** Solo ve lo que el teléfono de Gaelito ya subió a
la nube de Abbott. Si el teléfono está sin internet o lejos del sensor, la lectura se queda
congelada; el worker lo detecta y avisa cuando la medición tiene más de 15 minutos.

**Si Abbott empieza a devolver 401 con credenciales correctas**, casi siempre es que subieron
la versión mínima del cliente. Sube `LIBRE_API_VERSION` en el `.env` y reinicia — no hay que
tocar código.

**Zona horaria.** Define `TZ="America/Mexico_City"` en el `.env` para que los logs se lean en
hora local. Los instantes se guardan siempre en UTC; si tu columna `timestamp` no tiene zona
horaria, se guarda el reloj UTC (se recomienda `TIMESTAMPTZ`).

**Para que sobreviva a reinicios**, corre el worker bajo un supervisor (`systemd`, `pm2`,
Docker con `restart: unless-stopped`, o un contenedor en Railway/Fly.io). El worker sale con
código `1` en errores irrecuperables, justo para que el supervisor lo reinicie.

**Servidor fantasma (Render).** Al final de `sync.js` hay un `http.createServer` que escucha
en `$PORT` (3000 por defecto) y responde `200`. No hace nada útil: existe solo para que
Render acepte el proceso como Web Service en el plan gratuito y su health check pase. En
local choca con `next dev`, que también usa el 3000; arranca el frontend en otro puerto
(`npm run dev -- -p 3001`) si necesitas los dos a la vez.

**La versión del cliente está fija en el código.** En `src/libre.js`, el header `version`
está escrito como `'4.16.0'` en vez de leer `this.apiVersion`. Eso significa que
`LIBRE_API_VERSION` del `.env` y de Render **ya no tiene efecto**: si Abbott vuelve a subir
la versión mínima, hay que editar `src/libre.js` y volver a desplegar.

---

## Estructura

```
sync.js            Punto de entrada: ciclo, señales, resumen
src/config.js      Carga y validación del .env
src/libre.js       Cliente de LibreLinkUp (login, región, tendencia, unidades)
src/db.js          Pool de Neon, introspección del esquema, INSERT sin duplicados
src/retry.js       Backoff exponencial con jitter
src/logger.js      Log con timestamp, sin filtrar credenciales
```

### Por qué un cliente propio y no un paquete de npm

Los paquetes no oficiales (`librelinkup-api`, `libre-link-unofficial-api`,
`@diakem/libre-link-up-api-client`) llevan más de un año sin actualizarse, y Abbott ha
cambiado varias veces los headers obligatorios (`Account-Id`, `version`). Para algo que debe
correr desatendido durante meses, prefiero controlar esos detalles aquí y poder ajustarlos
desde el `.env` sin depender de que alguien publique una versión nueva.
