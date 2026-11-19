// Todas las fórmulas que antes vivían en el Excel, en un solo lugar.
import { DAYS, WEEKEND, toMin, hoursOf } from './time';

const roundTo = (x, step) => Math.round(x / step) * step;
const roundHalfUp = (x) => Math.floor(x + 0.5);

export const FORMATS = [
  { id: 'normal', label: 'Normal' },
  { id: 'intensivo', label: 'Intensivo' },
];

export const moduleHours = (m, fmt) => m[fmt].hoursPerWeek * m[fmt].weeks;

/** Horas, precios y cuotas de cada ruta UTN (hoja "Rutas y precios UTN"). */
export function routeStats(data) {
  const p = data.params;
  return data.routes.map((r) => {
    const mods = data.modules.filter((m) => m.routeIds.includes(r.id));
    const simH = r.simulacros * p.horasSimulacro;
    const out = { route: r, modules: mods };
    for (const fmt of ['normal', 'intensivo']) {
      const modH = mods.reduce((s, m) => s + moduleHours(m, fmt), 0);
      const total = modH + simH;
      const weeks = fmt === 'normal' ? p.semanasNormal : p.semanasIntensivo;
      const rate = fmt === 'normal' ? p.tarifaNormal : p.tarifaIntensivo;
      const price = roundTo(total * rate, p.redondeo);
      const cuotas = fmt === 'normal' ? p.mesesNormal : p.cuotasIntensivo;
      out[fmt] = {
        moduleHours: modH,
        simHours: simH,
        total,
        perWeek: total / weeks,
        price,
        cuota: roundHalfUp(price / cuotas),
        cuotas,
        seguidores: roundHalfUp(price * (1 - p.descSeguidores)),
        preventa: roundHalfUp(price * (1 - p.descPreventa)),
        perHour: total ? price / total : 0,
      };
    }
    return out;
  });
}

/** Lista unificada de cursos (manuales + UTN calculados) = hoja "Carga horaria". */
export function allCourses(data) {
  const stats = routeStats(data);
  const utn = FORMATS.flatMap(({ id: fmt, label }) =>
    stats.map((s) => ({
      id: `utn-${fmt}-${s.route.id}`,
      name: `UTN ${label} · ${s.route.name}`,
      group: `UTN ${label}`,
      hours: s[fmt].total,
      weeks: fmt === 'normal' ? data.params.semanasNormal : data.params.semanasIntensivo,
      price: s[fmt].price,
      minStudents: data.params.cupoMinimo,
      maxStudents: 10,
      format:
        fmt === 'normal'
          ? 'Tardes entre semana y sábado/domingo por la tarde (estudiantes de colegio)'
          : 'Mañanas de lunes a viernes (bachilleres graduados)',
      computed: true,
      published: true,
    }))
  );
  const manual = data.courses.map((c) => ({ ...c, group: c.group || 'Otros cursos', computed: false }));
  return [...manual, ...utn];
}

/** Rentabilidad por estudiante (hoja "Rentabilidad"). */
export function profitability(course, p, students) {
  const teacher = course.hours * p.costoProfesorHora;
  const n = students || p.estudiantesEsperados;
  const costPer = teacher / n;
  const costMin = teacher / p.cupoMinimo;
  const preventa = roundHalfUp(course.price * (1 - p.descPreventa));
  return {
    teacher,
    costPer,
    margin: course.price - costPer,
    marginPct: course.price ? (course.price - costPer) / course.price : 0,
    costMin,
    marginMinPct: course.price ? (course.price - costMin) / course.price : 0,
    breakEven: course.price ? Math.ceil(teacher / course.price) : 0,
    preventaMarginMin: preventa - costMin,
    revenue: course.price * n,
    profit: course.price * n - teacher,
  };
}

export function openHours(p, day) {
  return WEEKEND.has(day)
    ? [p.aperturaFinde, p.cierreFinde]
    : [p.aperturaSemana, p.cierreSemana];
}

export function availableHoursPerWeek(p) {
  const wd = (toMin(p.cierreSemana) - toMin(p.aperturaSemana)) / 60;
  const we = (toMin(p.cierreFinde) - toMin(p.aperturaFinde)) / 60;
  return wd * 5 + we * 2;
}

/** Ocupación por espacio (hoja "Espacios"). */
export function spaceStats(data) {
  const avail = availableHoursPerWeek(data.params);
  return data.spaces.map((s) => {
    const blocks = data.schedule.filter((b) => b.spaceId === s.id);
    const used = blocks.reduce((a, b) => a + hoursOf(b), 0);
    const byCat = {};
    for (const b of blocks) byCat[b.categoryId] = (byCat[b.categoryId] || 0) + hoursOf(b);
    const byDay = DAYS.map((d) =>
      blocks.filter((b) => b.day === d).reduce((a, b) => a + hoursOf(b), 0)
    );
    return { space: s, used, avail, occupancy: avail ? used / avail : 0, byCat, byDay, count: blocks.length };
  });
}

/** Choques: bloques que se cruzan en el mismo espacio, o fuera del horario de atención. */
export function findConflicts(data) {
  const out = new Map();
  const add = (id, msg) => out.set(id, [...(out.get(id) || []), msg]);
  const byKey = {};
  for (const b of data.schedule) (byKey[`${b.spaceId}|${b.day}`] ||= []).push(b);
  for (const list of Object.values(byKey)) {
    list.sort((a, b) => toMin(a.start) - toMin(b.start));
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        if (toMin(list[j].start) < toMin(list[i].end)) {
          add(list[i].id, `Se cruza con "${list[j].service}" (${list[j].start}–${list[j].end})`);
          add(list[j].id, `Se cruza con "${list[i].service}" (${list[i].start}–${list[i].end})`);
        }
      }
  }
  for (const b of data.schedule) {
    const [open, close] = openHours(data.params, b.day);
    if (toMin(b.start) < toMin(open) || toMin(b.end) > toMin(close))
      add(b.id, `Fuera del horario de atención (${open}–${close})`);
    if (toMin(b.end) <= toMin(b.start)) add(b.id, 'La hora de fin es igual o anterior a la de inicio');
  }
  return out;
}

export function categoryHours(data) {
  const res = {};
  for (const b of data.schedule) res[b.categoryId] = (res[b.categoryId] || 0) + hoursOf(b);
  return res;
}

/** Semana tipo de una ruta UTN (hoja "Horario por ruta"). */
export function routeTimetable(data, routeId, fmt) {
  const mods = data.modules.filter((m) => m.routeIds.includes(routeId));
  const prefix = fmt === 'normal' ? 'Normal · ' : 'Intensivo · ';
  return data.schedule
    .filter((b) => b.service.startsWith(prefix))
    .filter((b) => {
      const name = b.service.slice(prefix.length);
      return mods.some((m) => m.name === name) || name.startsWith('Simulacro');
    })
    .sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || toMin(a.start) - toMin(b.start));
}
