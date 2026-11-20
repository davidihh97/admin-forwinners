// Qué puede tocar cada módulo del panel. El servidor revisa estos permisos en cada petición.

export const MODULES = [
  'horario', 'espacios', 'cursos', 'temas', 'simulador', 'ajustes', 'web',
  'interesados', 'estudiantes', 'grupos', 'pagos', 'profesores', 'asistencia', 'notas', 'recordatorios', 'finanzas',
];

// Documento 'operations': qué módulo permite cambiar cada parte.
export const OPS_KEYS = {
  schedule: ['horario'],
  spaces: ['espacios'],
  categories: ['horario', 'ajustes'],
  params: ['ajustes', 'espacios', 'cursos'],
  courses: ['cursos'],
  routes: ['cursos'],
  modules: ['cursos'],
  hiddenCourses: ['cursos', 'web'],
  plans: ['temas'],
  version: ['ajustes'],
};

export const CONTENT = {
  operations: { read: null, write: 'ops' }, // null = cualquier usuario del panel
  site_draft: { read: ['web'], write: ['web'] },
  site_published: { read: ['web'], write: ['web'] },
  kiosk: { read: ['asistencia'], write: ['asistencia'] },
};

const P = (...cols) => cols;
// Tablas de gestión: columnas que se pueden escribir y módulos con acceso.
export const TABLES = {
  people: {
    cols: P('full_name', 'email', 'phone', 'person_type', 'status', 'notes', 'hourly_rate', 'guardian_name', 'guardian_phone', 'school', 'target', 'subjects'),
    read: ['estudiantes', 'profesores', 'grupos', 'pagos', 'asistencia', 'notas', 'interesados', 'recordatorios'],
    write: ['estudiantes', 'profesores', 'interesados'],
  },
  courses: {
    cols: P('name', 'category', 'description', 'modality', 'price', 'status', 'course_key'),
    read: ['grupos', 'estudiantes', 'pagos', 'notas', 'interesados', 'recordatorios'],
    write: ['grupos', 'estudiantes', 'interesados'],
    quiet: true,
  },
  course_groups: {
    cols: P('course_id', 'teacher_id', 'group_name', 'start_date', 'end_date', 'capacity', 'status', 'schedule_note', 'plan_id'),
    read: ['grupos', 'estudiantes', 'pagos', 'asistencia', 'notas', 'profesores', 'recordatorios', 'interesados'],
    write: ['grupos', 'estudiantes', 'interesados'],
    quiet: true,
  },
  enrollments: {
    cols: P('student_id', 'group_id', 'status', 'agreed_price', 'installments', 'discount', 'notes'),
    read: ['estudiantes', 'grupos', 'pagos', 'asistencia', 'notas', 'recordatorios'],
    write: ['estudiantes', 'grupos', 'interesados'],
  },
  payments: {
    cols: P('enrollment_id', 'amount', 'payment_date', 'payment_method', 'reference', 'status', 'notes', 'due_date', 'installment_no'),
    read: ['pagos', 'estudiantes', 'recordatorios', 'finanzas'],
    write: ['pagos', 'estudiantes', 'interesados'],
  },
  class_sessions: {
    cols: P('group_id', 'session_date', 'start_time', 'end_time', 'topic', 'notes', 'teacher_id'),
    read: ['asistencia', 'profesores', 'grupos'],
    write: ['asistencia'],
  },
  attendance: {
    cols: P('session_id', 'student_id', 'status', 'notes'),
    read: ['asistencia', 'estudiantes'],
    write: ['asistencia'],
    upsert: ['session_id', 'student_id'],
  },
  exam_scores: {
    cols: P('student_id', 'group_id', 'exam_name', 'exam_date', 'score', 'max_score', 'sections', 'notes'),
    read: ['notas', 'estudiantes'],
    write: ['notas'],
  },
  inquiries: {
    cols: P('full_name', 'email', 'phone', 'interested_course', 'message', 'status', 'notes', 'student_id', 'updated_at'),
    read: ['interesados', 'recordatorios'],
    write: ['interesados'],
  },
  assessments: {
    cols: P(),
    select: 'id, quiz, level, full_name, email, phone, score_pct, created_at',
    read: ['interesados'],
    write: [],
  },
  attendance_log: {
    cols: P('person_id', 'person_name', 'person_type', 'day', 'check_in', 'check_out', 'minutes', 'notes', 'source', 'created_by'),
    select: 'id, person_id, person_name, person_type, day, check_in, check_out, minutes, source, notes, created_by, (sign_in IS NOT NULL) AS has_sign_in, (sign_out IS NOT NULL) AS has_sign_out',
    read: ['asistencia', 'estudiantes', 'profesores', 'recordatorios'],
    write: ['asistencia'],
    dateCol: 'day',
  },
  expenses: {
    cols: P('date', 'category', 'description', 'amount', 'method', 'notes'),
    read: ['finanzas'],
    write: ['finanzas'],
    dateCol: 'date',
  },
  audit_log: {
    cols: P(),
    read: [], // solo el administrador
    write: [],
    dateCol: 'at',
  },
  teacher_payouts: {
    cols: P('teacher_id', 'period', 'hours', 'amount', 'paid_at', 'notes'),
    read: ['profesores', 'finanzas'],
    write: ['profesores'],
    upsert: ['teacher_id', 'period'],
  },
};
