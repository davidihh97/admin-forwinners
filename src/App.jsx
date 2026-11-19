import { useEffect, useState } from 'react';
import {
  LayoutDashboard, CalendarDays, DoorOpen, GraduationCap, BookOpenCheck, Palette, Settings,
  LogOut, Undo2, Redo2, Menu, Calculator, Inbox, Users, UsersRound, Wallet, ClipboardCheck,
  Trophy, BellRing, Presentation, ShieldCheck,
} from 'lucide-react';
import { StoreProvider, useStore } from './lib/store';
import { me, logout } from './lib/backend';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Schedule from './pages/Schedule';
import Spaces from './pages/Spaces';
import Courses from './pages/Courses';
import Plans from './pages/Plans';
import SiteEditor from './pages/SiteEditor';
import SettingsPage from './pages/Settings';
import Simulator from './pages/Simulator';
import Leads from './pages/Leads';
import Students from './pages/Students';
import Groups from './pages/Groups';
import Payments from './pages/Payments';
import Teachers from './pages/Teachers';
import Attendance from './pages/Attendance';
import Grades from './pages/Grades';
import Reminders from './pages/Reminders';
import UsersPage from './pages/Users';

const PAGES = [
  { group: 'For Winners' },
  { id: 'inicio', label: 'Inicio', icon: LayoutDashboard, el: Dashboard },
  { id: 'horario', label: 'Horario', icon: CalendarDays, el: Schedule, perm: 'horario' },
  { id: 'espacios', label: 'Espacios', icon: DoorOpen, el: Spaces, perm: 'espacios' },
  { id: 'cursos', label: 'Cursos y precios', icon: GraduationCap, el: Courses, perm: 'cursos' },
  { id: 'temas', label: 'Plan de clases', icon: BookOpenCheck, el: Plans, perm: 'temas' },
  { id: 'simulador', label: 'Simulador', icon: Calculator, el: Simulator, perm: 'simulador' },
  { group: 'Estudiantes' },
  { id: 'interesados', label: 'Interesados', icon: Inbox, el: Leads, perm: 'interesados', table: true },
  { id: 'estudiantes', label: 'Estudiantes', icon: Users, el: Students, perm: 'estudiantes', table: true },
  { id: 'grupos', label: 'Grupos', icon: UsersRound, el: Groups, perm: 'grupos', table: true },
  { id: 'pagos', label: 'Pagos y cuotas', icon: Wallet, el: Payments, perm: 'pagos', table: true },
  { id: 'asistencia', label: 'Asistencia', icon: ClipboardCheck, el: Attendance, perm: 'asistencia', table: true },
  { id: 'notas', label: 'Notas de simulacros', icon: Trophy, el: Grades, perm: 'notas', table: true },
  { id: 'recordatorios', label: 'Recordatorios', icon: BellRing, el: Reminders, perm: 'recordatorios', table: true },
  { group: 'Equipo' },
  { id: 'profesores', label: 'Profesores', icon: Presentation, el: Teachers, perm: 'profesores', table: true },
  { group: 'Página web' },
  { id: 'web', label: 'Editor de la web', icon: Palette, el: SiteEditor, perm: 'web', uses: 'site' },
  { group: 'Sistema' },
  { id: 'usuarios', label: 'Usuarios', icon: ShieldCheck, el: UsersPage, owner: true, table: true },
  { id: 'ajustes', label: 'Ajustes', icon: Settings, el: SettingsPage },
];

const readHash = () => window.location.hash.replace('#/', '') || 'inicio';

function Shell({ onLogout }) {
  const { ops, site, toast, can, user } = useStore();
  const [page, setPage] = useState(readHash);
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    const h = () => setPage(readHash());
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);

  const allowed = (p) => !p.group && (p.owner ? user.role === 'owner' : !p.perm || can(p.perm));
  const visible = [];
  let header = null;
  for (const p of PAGES) {
    if (p.group) header = p;
    else if (allowed(p)) {
      if (header) visible.push(header);
      header = null;
      visible.push(p);
    }
  }
  const current = PAGES.find((p) => p.id === page && allowed(p)) || PAGES[1];
  const doc = current.uses === 'site' ? site : ops;

  useEffect(() => {
    const k = (e) => {
      if (current.table || !(e.ctrlKey || e.metaKey) || e.target.closest('input,textarea,select')) return;
      if (e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); doc.undo(); }
      if ((e.key.toLowerCase() === 'z' && e.shiftKey) || e.key.toLowerCase() === 'y') { e.preventDefault(); doc.redo(); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [doc, current]);

  if (!ops.doc || (can('web') && !site.doc)) return <div className="empty">Cargando…</div>;
  const Page = current.el;
  const statusText = { idle: 'Sin cambios', saving: 'Guardando…', saved: 'Guardado', error: 'Error al guardar' }[doc.status];

  const go = (id) => {
    window.location.hash = `#/${id}`;
    setMenu(false);
  };

  return (
    <div className="app">
      <div className="mobile-top">
        <button className="btn ghost icon" style={{ color: '#fff' }} onClick={() => setMenu(true)} aria-label="Menú">
          <Menu size={20} />
        </button>
        <b>For Winners</b>
      </div>
      <aside className={`side ${menu ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-badge">FW</div> For Winners
        </div>
        <nav className="side-nav">
          {visible.map((p, i) =>
            p.group ? (
              <div key={i} className="nav-group">{p.group}</div>
            ) : (
              <button key={p.id} className={`nav-btn ${p.id === current.id ? 'active' : ''}`} onClick={() => go(p.id)}>
                <p.icon size={17} /> {p.label}
              </button>
            )
          )}
        </nav>
        <div className="side-foot">
          <span>👤 {user.name}</span>
          <button className="nav-btn" onClick={onLogout}>
            <LogOut size={16} /> Cerrar sesión
          </button>
        </div>
      </aside>
      {menu && <div className="overlay" style={{ zIndex: 35 }} onClick={() => setMenu(false)} />}
      <main className="main">
        {!current.table && (
          <div className="row no-print" style={{ justifyContent: 'flex-end', marginBottom: 6 }}>
            <span className={`save-pill ${doc.status}`}>{statusText}</span>
            <button className="btn sm ghost" disabled={!doc.canUndo} onClick={doc.undo} title="Deshacer (Ctrl+Z)">
              <Undo2 size={15} /> Deshacer
            </button>
            <button className="btn sm ghost" disabled={!doc.canRedo} onClick={doc.redo} title="Rehacer (Ctrl+Y)">
              <Redo2 size={15} /> Rehacer
            </button>
          </div>
        )}
        <Page go={go} />
      </main>
      {toast && <div className={`toast ${toast.kind === 'bad' ? 'bad' : ''}`}>{toast.msg}</div>}
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(undefined);
  const refresh = () => me().then((s) => setSession(s.user ? s : null)).catch(() => setSession(null));
  useEffect(() => {
    refresh();
    const h = () => setSession(null);
    window.addEventListener('fw:logout', h);
    return () => window.removeEventListener('fw:logout', h);
  }, []);
  if (session === undefined) return null;
  if (!session) return <Login onDone={refresh} />;
  return (
    <StoreProvider session={session} key={session.user.id}>
      <Shell
        onLogout={async () => {
          await logout().catch(() => {});
          setSession(null);
        }}
      />
    </StoreProvider>
  );
}
