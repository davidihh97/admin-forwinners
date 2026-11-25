// Contenido inicial del editor: los mismos valores que hoy tiene forwinnersec.com
// (public/js/main.js, cronogramas.js e index.html). Si no se cambia nada, la web se ve igual.

export const PAGES = [
  ['index.html', 'Portada'],
  ['servicios.html', 'Servicios'],
  ['preuniversitario.html', 'Preuniversitario'],
  ['simuladores.html', 'Simuladores'],
  ['practica.html', 'Práctica'],
  ['diagnostico.html', 'Diagnóstico'],
  ['ingles.html', 'Inglés'],
  ['nivelacion.html', 'Nivelación'],
  ['asesoria.html', 'Asesoría'],
  ['computacion.html', 'Computación e IA'],
  ['test-vocacional.html', 'Test vocacional'],
  ['guias.html', 'Guías'],
  ['contacto.html', 'Contacto'],
];

export const SECTION_TYPES = {
  hero: { label: 'Título grande con botones', icon: '🏁' },
  features: { label: 'Tarjetas (servicios, beneficios)', icon: '🧩' },
  courses: { label: 'Cursos y precios (automático)', icon: '🎓' },
  schedule: { label: 'Horario de clases (automático)', icon: '🗓️' },
  text: { label: 'Texto con imagen', icon: '📝' },
  cta: { label: 'Llamado a la acción', icon: '📣' },
  faq: { label: 'Preguntas frecuentes', icon: '❓' },
};

export const BUTTON_STYLES = {
  primary: 'Principal (relleno)',
  outline: 'Secundario (solo borde)',
  whatsapp: 'Abre WhatsApp',
};

export function newSection(type, id, page = 'index.html') {
  const base = { id, type, page, position: 'bottom', visible: true, bg: 'none', title: '', subtitle: '', buttons: [], items: [] };
  switch (type) {
    case 'hero':
      return { ...base, bg: 'dark', title: 'Nuevo título', subtitle: 'Subtítulo', buttons: [{ label: 'Escríbenos', url: '', style: 'whatsapp' }] };
    case 'features':
      return { ...base, bg: 'alt', title: 'Título', items: [{ icon: '⭐', title: 'Tarjeta', text: 'Descripción breve' }] };
    case 'courses':
      return { ...base, bg: 'alt', title: 'Cursos y precios', showPrices: true, courseIds: [] };
    case 'schedule':
      return { ...base, title: 'Horarios', categoryIds: [] };
    case 'faq':
      return { ...base, title: 'Preguntas frecuentes', items: [{ title: '¿Pregunta?', text: 'Respuesta' }] };
    case 'cta':
      return { ...base, bg: 'dark', title: '¿Listo para empezar?', buttons: [{ label: 'Escríbenos por WhatsApp', url: '', style: 'whatsapp' }] };
    default:
      return { ...base, title: 'Título', body: 'Escribe aquí el texto.', image: '', imageSide: 'right' };
  }
}

export const SERVICE_KEYS = [
  ['pre', 'Preuniversitario'], ['sim', 'Simuladores de admisión'], ['voc', 'Test vocacional'], ['diag', 'Diagnóstico gratis'],
  ['eng', 'Inglés'], ['niv', 'Nivelación y tareas dirigidas'], ['ase', 'Asesoría académica'], ['comp', 'Computación e IA'],
];
/** Servicios que aparecen en el menú de la portada (los demás solo salen en la portada grande). */
export const MENU_KEYS = ['pre', 'niv', 'eng', 'ase', 'comp'];

export const defaultSite = {
  config: {
    whatsapp: '593999769785',
    waMsg: 'Hola For Winners, quiero información.',
    canalWa: '',
  },
  aviso: {
    enabled: true,
    texto: 'Registro Nacional 2027: del 24 al 28 de noviembre. Es gratis y obligatorio.',
    link: 'preuniversitario.html#fechas',
    linkLabel: 'Ver fechas y cómo hacerlo',
    hasta: '2026-11-28',
    id: 'rn-2027',
  },
  nivelacion: [
    { n: 'Primaria', p: 6, li: [] },
    { n: 'Bachillerato', p: 7, li: [] },
    { n: 'Universidad', p: 8, li: [] },
  ],
  unis: {
    UTN: { t: 'Universidad Técnica del Norte', d: ['Un curso por facultad: FICA-FICAYA (Ingenierías), FECYT-FACAE y Ciencias de la Salud.', 'Modalidad intensiva o regular, según el tiempo que tengas.', 'Temario y simulacros según tu carrera.'] },
    Central: { t: 'Universidad Central del Ecuador', d: ['Curso conjunto con UPEC y Yachay: comparten razonamiento verbal, lógico, numérico y abstracto.', 'Clases en bloques de fin de semana, mañana o tarde.', 'Simulacros cronometrados del formato UCE.'] },
    UPEC: { t: 'Universidad Politécnica Estatal del Carchi', d: ['Curso conjunto con Central y Yachay.', 'Práctica de razonamiento con el formato de tu prueba.', 'Grupos reducidos y seguimiento semanal.'] },
    Yachay: { t: 'Universidad Yachay Tech', d: ['Curso conjunto con Central y UPEC.', 'Enfoque en razonamiento lógico y numérico.', 'Simulacros y revisión personalizada de errores.'] },
  },
  cursos: {
    presencial: { lugar: 'Ibarra', precio: '', inicio: '', horario: '' },
    virtual: { precio: '', inicio: '', horario: '', porModulo: '' },
  },
  faq: [
    { q: '¿Cuándo empiezan los cursos?', a: 'Abrimos grupos nuevos según la demanda. Escríbenos por WhatsApp y te confirmamos la próxima fecha.' },
    { q: '¿Cuántos estudiantes hay por grupo?', a: 'Trabajamos con grupos pequeños para que el profesor pueda resolver las dudas de cada uno.' },
    { q: '¿Puedo probar antes de inscribirme?', a: 'Sí. Haz un simulador gratis de tu universidad o el test vocacional, y escríbenos para una primera orientación.' },
    { q: '¿Cómo pago?', a: 'Te enviamos los datos por WhatsApp. Pregunta por las opciones de pago disponibles.' },
  ],
  testimonios: [],
  portada: { media: {}, services: {}, order: [], hidden: [], heroHidden: [] },
  theme: {},
  overrides: {},
  sections: [],
  seo: {},
};
