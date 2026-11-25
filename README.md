# For Winners · Panel de administración

Panel privado en **admin.forwinnersec.com** para manejar For Winners y la página web sin tocar código.

| Sección | Para qué sirve |
|---|---|
| Inicio | Resumen: horas, ocupación, choques de horario, avance de los planes |
| Horario, Espacios, Cursos y precios, Plan de clases, Simulador | Lo que antes estaba en el Excel `For_Winners_Carga_Horaria_y_Espacios_v2.xlsx`, con las mismas fórmulas (`src/lib/calc.js`) |
| Interesados | Lo que llega desde la web (simuladores, diagnóstico, test vocacional, contacto) en un tablero Nuevo → Contactado → Inscrito → Cerrado |
| Estudiantes | Fichas e inscripción directa a un curso, con descuento y cuotas automáticas |
| Pagos y cuotas | Cobros, cuotas vencidas, recordatorio por WhatsApp |
| Asistencia | Estudiantes y profesores escanean el QR (`/firmar?k=…`), buscan su nombre, confirman con los últimos 4 dígitos de su celular y firman en pantalla; el sistema pone la hora de entrada y de salida. El panel muestra quién está dentro, horas por persona y período, firmas, correcciones a mano y exportación a Excel |
| Notas de simulacros | Avance de cada estudiante por curso |
| Profesores | Horas del mes según sus firmas de asistencia y pago |
| Finanzas | Gastos, cuotas cobradas, pagos a profesores y resultado de cada mes |
| Actividad | Registro de todo lo que hace el equipo en el panel (solo el administrador) |
| Recordatorios | Mensajes de WhatsApp listos: cuotas, estudiantes que no vienen hace una semana, salidas sin registrar, interesados sin contactar |
| Editor de la web | La página real de forwinnersec.com: clic en un texto, botón o imagen para cambiarlo; formularios para WhatsApp, aviso, precios, preguntas frecuentes, testimonios, portada; secciones nuevas; Google |
| Usuarios | Cuentas para el equipo con permisos por sección |

## Cómo funciona

```
admin.forwinnersec.com  (este repositorio: Worker + app React)
        │  lee y escribe
        ▼
   Base D1 "for-winners-db"  ◄── la misma que ya usa forwinnersec.com
        ▲
        │  lee lo publicado (tabla content, clave site_published)
forwinnersec.com  (repositorio for-winners-website)
```

- **Todo en Cloudflare**, sin servicios extra. El panel y la web comparten la base de datos.
- **Borrador y publicado**: lo que se edita en el Editor de la web solo llega a forwinnersec.com al pulsar **Publicar** (tarda hasta 30 segundos en verse).
- **Seguridad**: contraseñas con PBKDF2, sesión en cookie `HttpOnly`/`Secure`/`SameSite=Strict`, límite de 10 intentos de ingreso cada 15 minutos, permisos revisados en el servidor en cada petición. La web pública solo lee el contenido publicado; precios de costo, márgenes, estudiantes y pagos nunca salen del panel.
- **Historial**: cada documento guarda copias automáticas (Ajustes → Versiones anteriores) y hay Deshacer/Rehacer.
- **Tablas nuevas automáticas**: asistencia, gastos y actividad se crean solas en D1 la primera vez que se usa el panel (`worker/extra.js`); no hace falta ejecutar SQL.
- **Enlace de firma**: protegido por una clave que se puede cambiar en cualquier momento; límite de intentos por equipo; opción de pedir los 4 últimos dígitos del celular.

## Puesta en marcha (una sola vez)

Requisito: `forwinnersec.com` debe estar en Cloudflare (lo está si la web ya usa Workers).

1. **Base de datos**: en el repositorio `for-winners-website`, aplica la migración nueva:
   ```bash
   npx wrangler d1 migrations apply for-winners-db --remote
   ```
   y publica la web (`npx wrangler deploy`).
2. **Contraseña inicial** del administrador (en este repositorio):
   ```bash
   npm install
   npx wrangler secret put ADMIN_PASSWORD
   ```
3. **Publicar el panel**:
   ```bash
   npm run deploy
   ```
   Esto crea `admin.forwinnersec.com` automáticamente (ver `routes` en `wrangler.jsonc`).
4. Entra a admin.forwinnersec.com, deja el usuario vacío y usa la contraseña del paso 2. Después cámbiala en **Ajustes**. Desde **Usuarios** puedes crear la cuenta de tu hermana con los permisos que elijas.

## Desarrollo local

```bash
npm install
npm run build
npm run dev:api        # API + app en http://localhost:8788 (usa una base D1 local)
npm run dev            # opcional: app con recarga en http://localhost:5173
```

Crea un archivo `.dev.vars` (no se sube al repositorio):

```
ADMIN_PASSWORD=una-clave-de-prueba
SITE_URL=http://localhost:8787
```

Para tener las tablas en local, aplica las migraciones de `for-winners-website` con `--local --persist-to <carpeta>` y arranca ambos proyectos con el mismo `--persist-to`.

## Estructura

| Carpeta | Qué hay |
|---|---|
| `worker/` | Servidor: login, usuarios y permisos (`schema.js`), documentos con historial, tablas, imágenes |
| `src/pages/` | Pantallas del panel |
| `src/lib/calc.js` | Fórmulas del Excel (precios, cuotas, descuentos, ocupación, choques, rentabilidad) |
| `src/lib/people.js` | Cuotas, WhatsApp, fechas |
| `src/site/` | Contenido inicial de la web y publicación |
| `src/data/seed.json` | Datos iniciales sacados del Excel |

## Temática de temporada

Editor de la web → «Temática de temporada (Navidad, fiestas…)». Guarda `temporada` en el contenido del sitio:
`{ modo: 'auto'|'force'|'off', forzar, intensidad: 'baja'|'media'|'alta', saludo, temas: { id: { on, variante, desde, hasta, saludo, intensidad } } }`.
La web decide qué mostrar con `for-winners-website/web/src/season/calendar.js`; `src/site/seasonCalendar.js` es una copia
de ese archivo para que el panel muestre las mismas fechas y la temática de hoy. El ojo de cada temática la muestra en la vista previa.
