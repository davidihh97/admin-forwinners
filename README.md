# For Winners · Panel de administración

Panel privado (`admin.forwinnersec.com`) para:

- **Administrar For Winners**: horario semanal visual (arrastrar y soltar), espacios y ocupación, cursos y precios, rutas y módulos UTN, rentabilidad, plan de clases por semana con avance, y un simulador de grupos.
- **Diseñar la página principal** (`forwinnersec.com`) sin tocar código: secciones, textos, botones, colores, imágenes, barra de anuncios, contacto y SEO, con vista previa y botón **Publicar**.

Los datos iniciales salen del Excel `For_Winners_Carga_Horaria_y_Espacios_v2.xlsx` (`src/data/seed.json`). Todas las fórmulas del Excel están en `src/lib/calc.js` y dan los mismos resultados.

## Cómo funciona

```
admin.forwinnersec.com (este panel) ──guarda──► Supabase (base de datos + login + imágenes)
                                                    │
forwinnersec.com ── <script fw-content.js> ──lee lo publicado──┘
```

- **Login**: una sola contraseña. Es el único usuario de Supabase; el registro público está desactivado.
- **Borrador y publicado**: lo que editas en el diseñador es un borrador; la web solo cambia cuando pulsas **Publicar**.
- **Seguridad**: la web pública solo puede leer el contenido publicado (cursos visibles y horario). Costos, márgenes y planes de clase son privados.
- **Deshacer / Rehacer** (Ctrl+Z / Ctrl+Y), guardado automático y versiones anteriores automáticas en la nube.

## Puesta en marcha (una sola vez)

### 1. Supabase (gratis)
1. Crea un proyecto en <https://supabase.com>.
2. **SQL Editor → New query** → pega `supabase/schema.sql` → **Run**.
3. **Authentication → Providers → Email**: desactiva *Allow new users to sign up*.
4. **Authentication → Users → Add user**: crea tu usuario (correo + contraseña). Esa será la contraseña del panel.
5. **Project Settings → API**: copia *Project URL* y *anon public key*.

### 2. Publicar el panel en admin.forwinnersec.com (Vercel, gratis)
1. En <https://vercel.com> → *Add New Project* → importa este repositorio.
2. Variables de entorno (ver `.env.example`):
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_ADMIN_EMAIL` (el correo del paso 1.4).
3. Build command `npm run build`, output `dist` (Vercel lo detecta solo).
4. *Settings → Domains* → agrega `admin.forwinnersec.com`. En el proveedor del dominio crea el registro **CNAME** `admin` → `cname.vercel-dns.com`.

### 3. Conectar la página principal (una sola vez)
En el diseñador, **Conectar con la web** muestra el código exacto. Resumen:

```html
<!-- antes de </body> en forwinnersec.com -->
<script src="https://admin.forwinnersec.com/fw-content.js"
        data-url="https://XXXX.supabase.co" data-key="ANON_KEY" defer></script>

<!-- donde quieras las secciones del diseñador -->
<div id="fw-root"></div>
<!-- o solo una sección, por su ancla -->
<div data-fw-section="cursos"></div>

<!-- textos que ya existen: si el panel no tiene valor, se queda el original -->
<h1 data-fw="hero_titulo">Texto actual</h1>
<a data-fw="boton_inscripcion" href="...">Inscríbete</a>
```

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # genera dist/ (panel + fw-content.js)
```

Sin variables de Supabase el panel funciona en **modo local** (datos solo en ese navegador, contraseña inicial `forwinners`), útil para probar.

## Estructura

| Carpeta | Qué hay |
|---|---|
| `src/pages/` | Pantallas: Inicio, Horario, Espacios, Cursos y precios, Plan de clases, Simulador, Diseñador web, Ajustes |
| `src/lib/calc.js` | Fórmulas (precios, cuotas, descuentos, ocupación, choques de horario, rentabilidad) |
| `src/lib/backend.js` | Login, guardado y subida de imágenes (Supabase o modo local) |
| `src/site/render.js` | Dibuja las secciones; lo usan la vista previa y la web pública |
| `src/embed/fw-content.js` | Script que se inserta en forwinnersec.com |
| `supabase/schema.sql` | Tablas, permisos e historial |
