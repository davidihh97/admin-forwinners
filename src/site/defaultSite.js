// Contenido inicial del diseñador. Son textos de ejemplo: reemplázalos desde el panel
// por los textos reales de forwinnersec.com.
export const SECTION_TYPES = {
  hero: { label: 'Portada (título grande)', icon: '🏁' },
  features: { label: 'Tarjetas / servicios', icon: '🧩' },
  courses: { label: 'Cursos y precios (automático)', icon: '🎓' },
  schedule: { label: 'Horario de clases (automático)', icon: '🗓️' },
  text: { label: 'Texto con imagen', icon: '📝' },
  cta: { label: 'Llamado a la acción', icon: '📣' },
  faq: { label: 'Preguntas frecuentes', icon: '❓' },
  contact: { label: 'Contacto', icon: '📍' },
};

export const BUTTON_STYLES = {
  primary: 'Destacado (amarillo)',
  secondary: 'Color principal',
  outline: 'Solo borde',
  whatsapp: 'WhatsApp (verde)',
};

export function newSection(type, id) {
  const base = { id, type, visible: true, align: 'left', bg: 'none', padding: 'm', title: '', subtitle: '', buttons: [], items: [] };
  switch (type) {
    case 'hero':
      return { ...base, bg: 'primary', title: 'Nuevo título', subtitle: 'Subtítulo', buttons: [{ label: 'Inscríbete', url: '#contacto', style: 'primary' }] };
    case 'features':
      return { ...base, title: 'Nuestros servicios', items: [{ icon: '⭐', title: 'Servicio', text: 'Descripción breve' }] };
    case 'courses':
      return { ...base, bg: 'light', title: 'Cursos', subtitle: '', showPrices: true, courseIds: [] };
    case 'schedule':
      return { ...base, title: 'Horarios', categoryIds: [] };
    case 'faq':
      return { ...base, title: 'Preguntas frecuentes', items: [{ title: '¿Pregunta?', text: 'Respuesta' }] };
    case 'contact':
      return { ...base, bg: 'light', title: 'Contáctanos', anchor: 'contacto', mapUrl: '' };
    case 'cta':
      return { ...base, bg: 'primary', align: 'center', title: '¿Listo para empezar?', buttons: [{ label: 'Escríbenos', url: '', style: 'whatsapp' }] };
    default:
      return { ...base, title: 'Título', body: 'Escribe aquí el texto.', image: '', imageSide: 'right' };
  }
}

export const defaultSite = {
  theme: { primary: '#0b3b8c', accent: '#f5b301', text: '#14213d', bg: '#ffffff', font: 'Inter', radius: 14 },
  announcement: {
    enabled: true,
    text: 'Inscripciones abiertas: Preuniversitario UTN Normal e Intensivo',
    link: '#cursos',
    linkLabel: 'Ver cursos',
    bg: '#f5b301',
    color: '#14213d',
  },
  contact: { whatsapp: '', phone: '', email: '', address: '', hours: 'Lunes a viernes 8:00–20:00 · Sábado y domingo 8:00–19:00' },
  // Textos sueltos de la página actual: en forwinnersec.com se marcan con data-fw="clave".
  bindings: [
    { key: 'hero_titulo', label: 'Título principal', type: 'text', value: '' },
    { key: 'hero_subtitulo', label: 'Subtítulo principal', type: 'text', value: '' },
    { key: 'boton_inscripcion', label: 'Botón de inscripción (enlace)', type: 'link', value: '', text: 'Inscríbete' },
    { key: 'whatsapp', label: 'Número de WhatsApp', type: 'text', value: '' },
  ],
  sections: [
    {
      ...newSection('hero', 'sec-hero'),
      kicker: 'Centro de preparación académica',
      title: 'Prepárate para ganar tu cupo universitario',
      subtitle: 'Cursos preuniversitarios para la UTN, Central, UPEC y Yachay, inglés Cambridge, nivelación y tutorías.',
      buttons: [
        { label: 'Ver cursos', url: '#cursos', style: 'primary' },
        { label: 'Escríbenos por WhatsApp', url: '', style: 'outline' },
      ],
    },
    {
      ...newSection('features', 'sec-servicios'),
      title: '¿Qué ofrecemos?',
      align: 'center',
      items: [
        { icon: '🎓', title: 'Preuniversitario UTN', text: 'Curso Normal de 7 meses (tardes y fines de semana) o Intensivo de 15 semanas (mañanas).' },
        { icon: '🧠', title: 'Razonamiento', text: 'Central, UPEC y Yachay: 86 horas en 9 semanas, sábados y domingos, con 4 simulacros.' },
        { icon: '🇬🇧', title: 'Inglés Cambridge', text: 'Niveles A1 a B2, dos clases de 2 horas por semana.' },
        { icon: '📚', title: 'Nivelación y tareas dirigidas', text: 'Primaria, bachillerato y universidad en grupos pequeños.' },
        { icon: '👩‍🏫', title: 'Tutorías y asesoría', text: 'Tutorías individuales, grupales y asesoría de tesis.' },
      ],
    },
    { ...newSection('courses', 'sec-cursos'), anchor: 'cursos', title: 'Cursos y precios', subtitle: 'Precios del curso completo. Pregunta por descuentos de preventa y seguidores.' },
    { ...newSection('cta', 'sec-cta'), title: '¿Tienes dudas? Te asesoramos gratis' },
    newSection('contact', 'sec-contacto'),
  ],
};
