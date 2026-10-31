# Pancreas OS · Frontend

Aplicación privada para seguir glucosa, registrar comidas e insulina y contar alimentos por peso.

## Rutas activas

- /: última lectura, curva del día, accesos de registro y pauta vigente.
- /registro: comida consumida e insulina administrada, en formularios separados.
- /historial: curva por fecha y eventos de comida e insulina.
- /pauta: indicaciones de consulta comunicadas por la familia, metas y próxima revisión.
- /plan: redirección al registro de comida. El plan diario, agua y actividad ya no forman parte del flujo.

## Pauta médica privada

La pauta se lee de la tabla care_plans; sus valores no se incluyen en el repositorio ni en variables NEXT_PUBLIC.
Cada cambio de consulta se registra con una fecha de vigencia. Una revisión futura nunca aumenta dosis automáticamente.
La pantalla del PIN y el proxy protegen estas rutas, y cada Server Action valida su propia sesión.

Aplica sql/003_followup.sql primero en una rama aislada y verifica antes de producción.
La migración agrega estructura y campos; conserva los registros históricos y no contiene datos de pacientes.
Las claves y las conexiones viven en variables privadas del entorno. No publiques archivos .env.

El reparto de una dosis fija entre comida y corrección permanece desactivado mientras falten objetivos de comida,
reglas de insulina activa y límites del protocolo confirmados con el equipo médico.
Un rango general o una meta al despertar no se convierten en un objetivo de corrección elegido por Gemini.
La función aritmética preparada está en lib/pauta.mjs y exige un protocolo completo; no agrega bolos.

## Nutrientes y Gemini

lib/alimentos.json contiene un catálogo inicial atribuido a USDA FoodData Central, SR Legacy 04/2018.
Cada alimento conserva su FDC ID, descripción, preparación y valores por 100 g de parte comestible.
La importación reproducible está en scripts/import_usda.py. Descarga el CSV oficial desde
https://fdc.nal.usda.gov/download-datasets/ y pasa la carpeta extraída al script.

Gemini organiza una idea de plato usando IDs del catálogo. El servidor rechaza IDs, pesos y respuestas inválidos,
recalcula todos los nutrientes, y vuelve a consultar sensor y pauta después de recibir la respuesta.
No se aceptan nutrientes inventados por el modelo ni equivalencias de marcas no verificadas.
El catálogo no pretende cubrir todos los alimentos. Para productos ausentes se admite registro manual según etiqueta.

La consulta de alimentos está disponible con cualquier glucosa, sin lectura reciente, sin pauta y para colaciones.
Fuera de las condiciones de la referencia prescrita devuelve fichas por 100 g, no una porción indicada para comer.
Los pesos se normalizan en el servidor y el usuario introduce las cantidades reales. No se usa una dosis fija
para calcular un plato con glucosa alta o baja ni se descuentan carbohidratos para corregirla.
Si el sensor caduca o cambia de rango durante la llamada, la respuesta vuelve al conteo neutral por 100 g.

Las ideas priorizan verduras y proteína y evitan azúcar añadida. La atención de hipoglucemia sigue su protocolo separado.
No se convierten grasa/proteína en insulina extra. El conteo no garantiza una glucosa posterior.

## Registro y verificación

Guardar comida nunca registra una inyección. La insulina solo se registra cuando se confirma su administración real.
Las solicitudes tienen claves de idempotencia e índices únicos: reintentar una solicitud no duplica el evento.
Los nutrientes y pesos quedan en meals.nutrition para mantener su procedencia.

Ejecuta npm test, npm run lint y npm run build.
En Windows puede usarse npm run build -- --webpack si Turbopack no puede iniciar sus procesos.
Prueba el guardado en una rama aislada; no insertes eventos ficticios en el historial de producción.

El service worker cachea únicamente assets estáticos con hash. No cachea páginas ni lecturas de glucosa.
Las interrupciones del sensor se muestran sin interpolar lecturas inexistentes en la gráfica.
