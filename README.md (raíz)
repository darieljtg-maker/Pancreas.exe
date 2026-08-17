# PancreasOS

Aplicación para gestionar la Diabetes Tipo 1 de Gaelito: lectura automática del sensor
FreeStyle Libre 2, registro de comidas, insulina, actividad física y agua.

---

## Qué hay aquí

```
pancreasos/
├── backend/     Worker que lee el sensor cada 5 min y escribe en Neon  →  Render
└── frontend/    PWA para consultar y registrar desde el celular        →  Vercel
```

Son dos proyectos independientes, cada uno con su `package.json` y su `.env`. Lo único
que comparten es la base de datos de Neon. Se despliegan por separado, en servicios
distintos, desde este mismo repositorio.

---

## ⚠️ Antes de subir a GitHub

**Sube la carpeta completa tal cual está.** El `.gitignore` ya excluye lo que no debe
subirse. Pero verifica una vez con tus propios ojos:

```bash
git add -A
git status          # NO debe aparecer backend/.env por ningún lado
```

Si `backend/.env` aparece en esa lista, **detente**: ahí están tu contraseña de Neon y
la de LibreLinkUp. No lo subas.

| Archivo | ¿Se sube? | Por qué |
|---|---|---|
| `backend/.env` | **NO, nunca** | Tiene tus credenciales reales |
| `backend/.env.example` | Sí | Es la plantilla, sin credenciales |
| `frontend/.env.example` | Sí | Igual |
| `node_modules/` | No | Se reinstala con `npm install` |
| `frontend/.next/` | No | Se regenera al compilar |
| Todo lo demás | Sí | |

---

## Arrancar en local

```bash
# Worker de glucosa
cd backend
npm install
npm run doctor      # verifica credenciales, red y esquema SIN escribir nada
npm start

# Frontend
cd frontend
npm install
cp .env.example .env.local     # completa DATABASE_URL
npm run dev                    # http://localhost:3000
```

El `backend/.env` ya viene con tus credenciales; el frontend necesita que crees su
`.env.local` con la misma `DATABASE_URL`.

---

## Desplegar

**Backend → Render** (Web Service)
- Root Directory: `backend`
- Build Command: `npm install`
- Start Command: `npm start`
- Environment: copia las variables de `backend/.env` en el panel de Render

**Frontend → Vercel**
- Root Directory: `frontend`
- Environment Variables: `DATABASE_URL` (con el endpoint `-pooler` de Neon) y
  `APP_TIMEZONE=America/Mexico_City`

---

## Modelo de datos

Tablas en Neon:

| Tabla | Contenido | Quién escribe |
|---|---|---|
| `users` | Perfiles (Gaelito, cuidadores) | manual |
| `cgm_readings` | Lecturas de glucosa del sensor | `backend` |
| `meals` | Comidas y carbohidratos | `frontend` |
| `insulin_logs` | Dosis de Lyumjev (rápida) y Tresiba (basal) | `frontend` |
| `activities` | Actividad física | `frontend` |
| `water_logs` | Consumo de agua | `frontend` |

---

> Herramienta de seguimiento. No sustituye el criterio del equipo médico de Gaelito
> ni sirve para tomar decisiones de dosificación.
