import { allCourses } from '../lib/calc';

/** Datos públicos que acompañan al contenido publicado (sin costos ni márgenes). */
export function publicSnapshot(data) {
  const hidden = new Set(data.hiddenCourses || []);
  return {
    courses: allCourses(data)
      .filter((c) => !hidden.has(c.id))
      .map(({ id, name, group, hours, weeks, price, format }) => ({ id, name, group, hours, weeks, price, format })),
    schedule: data.schedule.map(({ day, start, end, service, categoryId }) => ({ day, start, end, service, categoryId })),
    categories: data.categories.map(({ id, name, color }) => ({ id, name, color })),
  };
}

export function buildPublished(site, data) {
  return { ...site, public: publicSnapshot(data), publishedAt: new Date().toISOString() };
}
