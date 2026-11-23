# Core Motion Studio

Estudio de motion graphics 3D en un solo archivo (`index.html`) con **Three.js** y **GSAP** por CDN, sin Remotion ni librerías de pago.

- Textura procedural de circuito neón generada con Canvas (núcleo, anillos y suelo).
- Logotipo SVG que se dibuja al iniciar.
- Núcleo de cristal/metal, 3 anillos giratorios, 300 partículas, luz ambiental, direccional con sombras y puntuales cian/magenta, bloom.
- Robot 3D que saluda a la audiencia con un bocadillo "¡Hola!".
- Línea de tiempo GSAP de 6 s en bucle (órbita de cámara, pulso de luz, anillos y núcleo).
- Interfaz: pausar/reanudar, cambiar paleta, **grabar 6 s y descargar** (.mp4 si el navegador lo admite, si no .webm) con `MediaRecorder`.

## Ver en el navegador

Los módulos ES necesitan un servidor local (no funciona con doble clic en `file://`):

```bash
cd motion-studio
npx serve .
```

y abre la URL que indique (p. ej. http://localhost:3000). También sirve `python3 -m http.server 8080`.

## Renderizar el video sin navegador visible

`render.mjs` abre la escena en Chromium sin ventana, la avanza fotograma a fotograma (sin saltos) y codifica un MP4 H.264 con ffmpeg.
Necesita Node 18+, ffmpeg y Playwright con Chromium (`npm i -D playwright && npx playwright install chromium`).

```bash
node render.mjs video/nucleo-energetico-1080p.mp4 12 30 1920 1080
```

Argumentos: archivo de salida, segundos (12 = dos bucles), fps, ancho, alto.
