import { useEffect, useState } from 'react';
import { Download, Upload, KeyRound, RotateCcw, Plus, Trash2, FileSpreadsheet, History } from 'lucide-react';
import { useStore, SEED } from '../lib/store';
import { changePassword, history, historyItem } from '../lib/backend';
import { allCourses, routeStats, spaceStats } from '../lib/calc';
import { hoursOf, uid } from '../lib/time';
import { PageHead, Num, Text } from '../components/ui';

const PARAMS = [
  ['costoProfesorHora', 'Costo del profesor por hora ($)', 0.5],
  ['tarifaNormal', 'Tarifa por hora, curso Normal ($)', 0.1],
  ['tarifaIntensivo', 'Tarifa por hora, curso Intensivo ($)', 0.1],
  ['semanasNormal', 'Semanas del curso Normal', 1],
  ['semanasIntensivo', 'Semanas del curso Intensivo', 1],
  ['mesesNormal', 'Meses (cuotas) del curso Normal', 1],
  ['cuotasIntensivo', 'Cuotas del curso Intensivo', 1],
  ['horasSimulacro', 'Horas por simulacro (prueba + revisión)', 0.5],
  ['estudiantesEsperados', 'Estudiantes esperados por grupo', 1],
  ['cupoMinimo', 'Cupo mínimo para abrir un grupo', 1],
  ['redondeo', 'Redondear precios a múltiplos de ($)', 1],
];

export default function Settings() {
  const { data, ops, site, notify, can, user } = useStore();
  const owner = user.role === 'owner';
  const [pass, setPass] = useState({ cur: '', a: '', b: '' });
  const [hist, setHist] = useState(null);
  const setP = (k) => (v) => ops.update((d) => { d.params[k] = v; });

  useEffect(() => {
    history('operations').then(setHist).catch(() => setHist([]));
  }, []);

  async function savePass() {
    if (pass.a !== pass.b) return notify('Las contraseñas no coinciden', 'bad');
    try {
      await changePassword(pass.cur, pass.a);
      setPass({ cur: '', a: '', b: '' });
      notify('Contraseña cambiada');
    } catch (e) {
      notify(e.message, 'bad');
    }
  }

  function download(name, blob) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const stamp = new Date().toISOString().slice(0, 10);

  function backup() {
    download(`forwinners-respaldo-${stamp}.json`, new Blob([JSON.stringify({ operations: data, site: site.doc }, null, 1)], { type: 'application/json' }));
  }
  function restore(e) {
    const f = e.target.files[0];
    if (!f) return;
    f.text().then((t) => {
      try {
        const j = JSON.parse(t);
        if (!j.operations?.schedule) throw new Error();
        if (!confirm('Esto reemplaza todos los datos actuales por los del respaldo. ¿Continuar?')) return;
        ops.replace(j.operations);
        if (j.site) site.replace(j.site);
        notify('Respaldo restaurado');
      } catch {
        notify('Ese archivo no es un respaldo válido', 'bad');
      }
    });
    e.target.value = '';
  }

  async function exportExcel() {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    const add = (name, rows) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), name);
    const sp = (id) => data.spaces.find((s) => s.id === id)?.name;
    const ct = (id) => data.categories.find((c) => c.id === id)?.name;
    add('Carga horaria', allCourses(data).map((c) => ({ Curso: c.name, 'Horas totales': c.hours, Semanas: c.weeks, 'Horas por semana': +(c.hours / c.weeks).toFixed(2), 'Precio ($)': c.price, 'Cupo mínimo': c.minStudents, 'Cupo máximo': c.maxStudents, Formato: c.format })));
    add('Rutas y precios UTN', routeStats(data).flatMap((s) => ['normal', 'intensivo'].map((f) => ({ Ruta: s.route.name, Formato: f, 'Horas totales': s[f].total, 'Precio ($)': s[f].price, 'Cuota ($)': s[f].cuota, Cuotas: s[f].cuotas, 'Precio seguidores': s[f].seguidores, 'Precio preventa': s[f].preventa }))));
    add('Módulos UTN', data.modules.map((m) => ({ Módulo: m.name, 'Normal h/sem': m.normal.hoursPerWeek, 'Normal semanas': m.normal.weeks, 'Normal inicio': m.normal.startWeek, 'Intensivo h/sem': m.intensivo.hoursPerWeek, 'Intensivo semanas': m.intensivo.weeks, 'Intensivo inicio': m.intensivo.startWeek, Rutas: m.routeIds.map((r) => data.routes.find((x) => x.id === r)?.name).join(', ') })));
    add('Espacios', spaceStats(data).map((s) => ({ Espacio: s.space.name, Capacidad: s.space.capacity, Uso: s.space.use, 'Horas ocupadas': s.used, 'Horas disponibles': s.avail, Ocupación: +s.occupancy.toFixed(3) })));
    add('Horario semanal', data.schedule.map((b) => ({ Día: b.day, Inicio: b.start, Fin: b.end, Espacio: sp(b.spaceId), Servicio: b.service, Categoría: ct(b.categoryId), Horas: hoursOf(b), Observaciones: b.notes })));
    for (const p of data.plans) add(`Clases ${p.name}`.slice(0, 31), p.classes.map((c) => ({ Semana: c.week, Día: c.day, Horario: c.time, Horas: c.hours, Módulo: c.module, Contenido: c.content, Temas: c.topics, Rutas: c.routes, Dictada: c.done ? 'Sí' : '' })));
    XLSX.writeFile(wb, `ForWinners-${stamp}.xlsx`);
  }

  return (
    <>
      <PageHead title="Ajustes" desc="Parámetros de precios, categorías, contraseña y respaldos." />
      <div className="grid g2">
        {can('ajustes') && <div className="card">
          <div className="card-h"><h2>Parámetros de precios y cursos</h2></div>
          <div className="grid g2">
            {PARAMS.map(([k, label, step]) => <Num key={k} label={label} step={step} value={data.params[k]} onChange={setP(k)} />)}
            <Num label="Descuento seguidores (%)" value={Math.round(data.params.descSeguidores * 100)} onChange={(v) => setP('descSeguidores')(v / 100)} />
            <Num label="Descuento preventa (%)" value={Math.round(data.params.descPreventa * 100)} onChange={(v) => setP('descPreventa')(v / 100)} />
          </div>
          <p className="small muted">Al cambiar cualquier valor, los precios de las rutas UTN y la rentabilidad se recalculan al instante.</p>
        </div>}

        <div className="col" style={{ gap: 16 }}>
          {can('ajustes') && <div className="card">
            <div className="card-h"><h2 className="grow">Categorías del horario</h2>
              <button className="btn sm" onClick={() => ops.update((d) => { d.categories.push({ id: uid('cat'), name: 'Nueva categoría', color: '#64748b' }); })}><Plus size={14} /> Agregar</button>
            </div>
            <div className="col">
              {data.categories.map((c, i) => (
                <div key={c.id} className="row" style={{ flexWrap: 'nowrap' }}>
                  <input type="color" value={c.color} onChange={(e) => ops.update((d) => { d.categories[i].color = e.target.value; })} style={{ width: 36, height: 32, border: 0, background: 'none', padding: 0 }} />
                  <input className="input grow" value={c.name} onChange={(e) => ops.update((d) => { d.categories[i].name = e.target.value; })} />
                  <button className="btn sm ghost danger" onClick={() => {
                    const n = data.schedule.filter((b) => b.categoryId === c.id).length;
                    if (n) return notify(`Hay ${n} clases con esta categoría; cámbialas primero.`, 'bad');
                    ops.update((d) => { d.categories.splice(i, 1); });
                  }}><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          </div>}

          <div className="card">
            <div className="card-h"><KeyRound size={18} /><h2>Cambiar contraseña</h2></div>
            <Text label="Contraseña actual" type="password" autoComplete="current-password" value={pass.cur} onChange={(v) => setPass({ ...pass, cur: v })} />
            <div className="grid g2" style={{ marginTop: 10 }}>
              <Text label="Nueva contraseña" type="password" autoComplete="new-password" value={pass.a} onChange={(v) => setPass({ ...pass, a: v })} />
              <Text label="Repítela" type="password" autoComplete="new-password" value={pass.b} onChange={(v) => setPass({ ...pass, b: v })} />
            </div>
            <div className="row" style={{ marginTop: 10 }}><button className="btn primary" disabled={!pass.a} onClick={savePass}>Guardar contraseña</button></div>
          </div>
        </div>
      </div>

      {owner && <div className="card" style={{ marginTop: 16 }}>
        <div className="card-h"><h2>Respaldos y exportación</h2></div>
        <div className="row">
          <button className="btn" onClick={exportExcel}><FileSpreadsheet size={16} /> Descargar Excel</button>
          <button className="btn" onClick={backup}><Download size={16} /> Descargar respaldo</button>
          <label className="btn"><Upload size={16} /> Restaurar respaldo<input type="file" accept=".json" hidden onChange={restore} /></label>
          <button className="btn danger" onClick={() => confirm('¿Volver a los datos originales del Excel? Se pierden los cambios hechos en el panel (puedes deshacer).') && ops.replace(structuredClone(SEED))}>
            <RotateCcw size={16} /> Volver a los datos del Excel
          </button>
        </div>
        {hist && hist.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div className="row" style={{ marginBottom: 8 }}><History size={16} /><b>Versiones anteriores (automáticas)</b></div>
            <div className="col" style={{ gap: 4 }}>
              {hist.slice(0, 10).map((h) => (
                <div key={h.id} className="row small">
                  <span className="grow">{new Date(`${h.saved_at.replace(' ', 'T')}Z`).toLocaleString('es-EC')} · {h.saved_by}</span>
                  <button className="btn sm" onClick={async () => { if (confirm('¿Restaurar esta versión? (Puedes deshacer)')) ops.replace(await historyItem(h.id)); }}>Restaurar</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>}
    </>
  );
}
