import { useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutDashboard, CalendarDays, DoorOpen, GraduationCap, BookOpenCheck, Palette, Settings,
  LogOut, Undo2, Redo2, Menu, Calculator, Inbox, Users, Wallet, ClipboardCheck,
  Trophy, BellRing, Presentation, ShieldCheck, Search, PiggyBank, History, ExternalLink, ChevronRight,
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
import Payments from './pages/Payments';
import Teachers from './pages/Teachers';
import Attendance from './pages/Attendance';
import Grades from './pages/Grades';
import Reminders from './pages/Reminders';
import UsersPage from './pages/Users';
import Finance from './pages/Finance';
import Activity from './pages/Activity';

const PAGES = [
  { group: 'General' },
  { id: 'inicio', label: 'Inicio', icon: LayoutDashboard, el: Dashboard, table: true },
  { id: 'recordatorios', label: 'Recordatorios', icon: BellRing, el: Reminders, perm: 'recordatorios', table: true },
  { group: 'Estudiantes' },
  { id: 'interesados', label: 'Interesados', icon: Inbox, el: Leads, perm: 'interesados', table: true },
  { id: 'estudiantes', label: 'Estudiantes', icon: Users, el: Students, perm: 'estudiantes', table: true },
  { id: 'asistencia', label: 'Asistencia', icon: ClipboardCheck, el: Attendance, perm: 'asistencia', table: true },
  { id: 'notas', label: 'Notas de simulacros', icon: Trophy, el: Grades, perm: 'notas', table: true },
  { id: 'pagos', label: 'Pagos y cuotas', icon: Wallet, el: Payments, perm: 'pagos', table: true },
  { group: 'Académico' },
  { id: 'horario', label: 'Horario', icon: CalendarDays, el: Schedule, perm: 'horario' },
  { id: 'espacios', label: 'Espacios', icon: DoorOpen, el: Spaces, perm: 'espacios' },
  { id: 'cursos', label: 'Cursos y precios', icon: GraduationCap, el: Courses, perm: 'cursos' },
  { id: 'temas', label: 'Plan de clases', icon: BookOpenCheck, el: Plans, perm: 'temas' },
  { group: 'Administración' },
  { id: 'profesores', label: 'Profesores', icon: Presentation, el: Teachers, perm: 'profesores', table: true },
  { id: 'finanzas', label: 'Finanzas', icon: PiggyBank, el: Finance, perm: 'finanzas', table: true },
  { id: 'simulador', label: 'Simulador', icon: Calculator, el: Simulator, perm: 'simulador' },
  { group: 'Página web' },
  { id: 'web', label: 'Editor de la web', icon: Palette, el: SiteEditor, perm: 'web', uses: 'site' },
  { group: 'Sistema' },
  { id: 'usuarios', label: 'Usuarios', icon: ShieldCheck, el: UsersPage, owner: true, table: true },
  { id: 'actividad', label: 'Actividad', icon: History, el: Activity, owner: true, table: true },
  { id: 'ajustes', label: 'Ajustes', icon: Settings, el: SettingsPage },
];

const readHash = () => window.location.hash.replace('#/', '') || 'inicio';
const initials = (n) => String(n || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

function Palette_({ pages, onGo, onClose }) {
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);
  const list = pages.filter((p) => !q || p.label.toLowerCase().includes(q.toLowerCase()));
  const box = useRef();
  useEffect(() => setI(0), [q]);
  return (
    <div className="palette" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="palette-box" ref={box}>
        <div className="search"><Search size={17} />
          <input autoFocus placeholder="Ir a… (escribe una sección)" value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
              if (e.key === 'ArrowDown') { e.preventDefault(); setI((x) => Math.min(x + 1, list.length - 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setI((x) => Math.max(x - 1, 0)); }
              if (e.key === 'Enter' && list[i]) onGo(list[i].id);
            }} />
        </div>
        <div className="palette-list">
          {list.map((p, k) => (
            <button key={p.id} className={`palette-item ${k === i ? 'on' : ''}`} onMouseEnter={() => setI(k)} onClick={() => onGo(p.id)}>
              <p.icon size={16} /> {p.label} <small>{p.groupName}</small>
            </button>
          ))}
          {!list.length && <div className="empty small">Nada coincide con «{q}».</div>}
        </div>
      </div>
    </div>
  );
}

function Shell({ onLogout }) {
  const { ops, site, toast, can, user, siteUrl } = useStore();
  const [page, setPage] = useState(readHash);
  const [menu, setMenu] = useState(false);
  const [palette, setPalette] = useState(false);

  useEffect(() => {
    const h = () => setPage(readHash());
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);

  const allowed = (p) => !p.group && (p.owner ? user.role === 'owner' : !p.perm || can(p.perm));
  const { visible, flat } = useMemo(() => {
    const v = [];
    const f = [];
    let header = null;
    for (const p of PAGES) {
      if (p.group) header = p;
      else if (allowed(p)) {
        if (header && !v.includes(header)) v.push(header);
        v.push(p);
        f.push({ ...p, groupName: header?.group });
      }
    }
    return { visible: v, flat: f };
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps
  const current = flat.find((p) => p.id === page) || flat[0];
  const doc = current.uses === 'site' ? site : ops;

  useEffect(() => {
    const k = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette((x) => !x); return; }
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
    setPalette(false);
    window.scrollTo(0, 0);
  };

  return (
    <div className="app">
      <aside className={`side ${menu ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-badge">FW</div>
          <div><b>For Winners</b><small>Administración</small></div>
        </div>
        <button className="side-search" onClick={() => setPalette(true)}><Search size={15} /> Buscar sección <kbd>Ctrl K</kbd></button>
        <nav className="side-nav" aria-label="Secciones">
          {visible.map((p, i) =>
            p.group ? (
              <div key={i} className="nav-group">{p.group}</div>
            ) : (
              <button key={p.id} className={`nav-btn ${p.id === current.id ? 'active' : ''}`} onClick={() => go(p.id)} aria-current={p.id === current.id ? 'page' : undefined}>
                <p.icon size={17} /> {p.label}
              </button>
            )
          )}
        </nav>
        <div className="side-foot">
          <span className="avatar">{initials(user.name)}</span>
          <div className="who"><b>{user.name}</b><small>{user.role === 'owner' ? 'Administrador' : 'Equipo'}</small></div>
          <button className="btn ghost icon sm" onClick={onLogout} title="Cerrar sesión" aria-label="Cerrar sesión"><LogOut size={16} /></button>
        </div>
      </aside>
      {menu && <div className="overlay" style={{ zIndex: 35 }} onClick={() => setMenu(false)} />}

      <div className="main">
        <header className="appbar no-print">
          <button className="btn ghost icon menu-btn" onClick={() => setMenu(true)} aria-label="Abrir menú"><Menu size={19} /></button>
          <div className="crumbs grow">
            <span className="hide-sm">{current.groupName}</span>{current.groupName && <ChevronRight size={14} className="hide-sm" />}
            <b>{current.label}</b>
          </div>
          {!current.table && (
            <>
              <span className={`save-pill ${doc.status}`}>{statusText}</span>
              <button className="btn sm ghost" disabled={!doc.canUndo} onClick={doc.undo} title="Deshacer (Ctrl+Z)"><Undo2 size={15} /><span className="hide-sm">Deshacer</span></button>
              <button className="btn sm ghost" disabled={!doc.canRedo} onClick={doc.redo} title="Rehacer (Ctrl+Y)"><Redo2 size={15} /><span className="hide-sm">Rehacer</span></button>
            </>
          )}
          <a className="btn sm ghost hide-sm" href={siteUrl} target="_blank" rel="noopener"><ExternalLink size={14} /> Ver web</a>
        </header>
        <main className="content" id="main">
          <Page go={go} />
        </main>
      </div>
      {palette && <Palette_ pages={flat} onGo={go} onClose={() => setPalette(false)} />}
      {toast && <div className={`toast ${toast.kind === 'bad' ? 'bad' : ''}`} role="status">{toast.msg}</div>}
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
