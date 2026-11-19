import { useEffect, useState } from 'react';
import { Plus, KeyRound, Trash2 } from 'lucide-react';
import { useStore } from '../lib/store';
import { api } from '../lib/backend';
import { Modal, PageHead, Text, Check } from '../components/ui';

export const MODULE_LABELS = {
  horario: 'Horario', espacios: 'Espacios', cursos: 'Cursos y precios', temas: 'Plan de clases', simulador: 'Simulador',
  interesados: 'Interesados', estudiantes: 'Estudiantes', grupos: 'Grupos', pagos: 'Pagos y cuotas', asistencia: 'Asistencia',
  notas: 'Notas de simulacros', recordatorios: 'Recordatorios', profesores: 'Profesores', web: 'Editor de la web', ajustes: 'Ajustes (tarifas y categorías)',
};
const PRESETS = {
  'Atención y secretaría': ['horario', 'espacios', 'temas', 'interesados', 'estudiantes', 'grupos', 'pagos', 'asistencia', 'notas', 'recordatorios'],
  'Solo académico': ['horario', 'temas', 'asistencia', 'notas'],
  'Todo menos dinero': Object.keys(MODULE_LABELS).filter((m) => !['pagos', 'cursos', 'simulador', 'ajustes', 'profesores'].includes(m)),
};

export default function Users() {
  const { notify, user: me } = useStore();
  const [list, setList] = useState(null);
  const [edit, setEdit] = useState(null);
  const load = () => api.get('users').then(setList).catch((e) => notify(e.message, 'bad'));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    try {
      if (edit.id) await api.patch(`users/${edit.id}`, { name: edit.display_name, perms: edit.perms, active: edit.active, ...(edit.password ? { password: edit.password } : {}) });
      else await api.post('users', { username: edit.username, name: edit.display_name, password: edit.password, perms: edit.perms });
      setEdit(null);
      load();
      notify('Usuario guardado');
    } catch (e) { notify(e.message, 'bad'); }
  }

  if (!list) return <div className="empty">Cargando…</div>;
  return (
    <>
      <PageHead title="Usuarios" desc="Crea cuentas para tu equipo y elige qué secciones puede ver y editar cada persona.">
        <button className="btn primary" onClick={() => setEdit({ username: '', display_name: '', password: '', perms: PRESETS['Atención y secretaría'], active: 1 })}><Plus size={16} /> Nuevo usuario</button>
      </PageHead>
      <div className="grid g2">
        {list.map((u) => (
          <div key={u.id} className="card" style={{ opacity: u.active ? 1 : 0.55 }}>
            <div className="card-h" style={{ marginBottom: 6 }}>
              <h2 className="grow">{u.display_name || u.username}</h2>
              <span className={`chip ${u.role === 'owner' ? 'tag-info' : 'tag-mut'}`}>{u.role === 'owner' ? 'Administrador' : u.active ? 'Equipo' : 'Desactivado'}</span>
            </div>
            <div className="small muted">Usuario: <b>{u.username}</b></div>
            <div className="row" style={{ gap: 4, margin: '10px 0' }}>
              {u.role === 'owner' ? <span className="small">Acceso a todo</span> : u.perms.map((p) => <span key={p} className="chip tag-mut">{MODULE_LABELS[p] || p}</span>)}
            </div>
            {u.id !== me.id && u.role !== 'owner' && (
              <div className="row">
                <button className="btn sm" onClick={() => setEdit({ ...u, password: '' })}>Editar permisos</button>
                <button className="btn sm ghost danger right" onClick={async () => { if (!confirm(`¿Eliminar la cuenta de ${u.username}?`)) return; await api.del(`users/${u.id}`); load(); }}><Trash2 size={14} /></button>
              </div>
            )}
          </div>
        ))}
      </div>

      {edit && (
        <Modal title={edit.id ? `Editar ${edit.username}` : 'Nuevo usuario'} onClose={() => setEdit(null)} wide
          footer={<><button className="btn" onClick={() => setEdit(null)}>Cancelar</button><button className="btn primary" onClick={save}>Guardar</button></>}>
          <div className="grid g3">
            {!edit.id && <Text label="Usuario (para entrar)" value={edit.username} onChange={(v) => setEdit({ ...edit, username: v.toLowerCase().replace(/\s/g, '') })} placeholder="ej. andrea" />}
            <Text label="Nombre" value={edit.display_name} onChange={(v) => setEdit({ ...edit, display_name: v })} />
            <Text label={edit.id ? 'Nueva contraseña (opcional)' : 'Contraseña'} type="password" autoComplete="new-password" value={edit.password} onChange={(v) => setEdit({ ...edit, password: v })} hint="Mínimo 8 caracteres" />
          </div>
          <div>
            <div className="small muted" style={{ marginBottom: 6 }}><KeyRound size={13} /> Accesos rápidos</div>
            <div className="row">{Object.entries(PRESETS).map(([k, v]) => <button key={k} className="btn sm" onClick={() => setEdit({ ...edit, perms: v })}>{k}</button>)}</div>
          </div>
          <div className="grid g3">
            {Object.entries(MODULE_LABELS).map(([k, label]) => (
              <Check key={k} label={label} checked={edit.perms.includes(k)} onChange={(on) => setEdit({ ...edit, perms: on ? [...edit.perms, k] : edit.perms.filter((x) => x !== k) })} />
            ))}
          </div>
          {edit.id && <Check label="Cuenta activa" checked={!!edit.active} onChange={(v) => setEdit({ ...edit, active: v ? 1 : 0 })} />}
          <p className="small muted">La sección Usuarios y los respaldos son solo para el administrador.</p>
        </Modal>
      )}
    </>
  );
}
