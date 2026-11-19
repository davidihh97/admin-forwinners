import { useEffect, useState } from 'react';
import {
  LayoutDashboard, CalendarDays, DoorOpen, GraduationCap, BookOpenCheck, Palette, Settings,
  LogOut, Undo2, Redo2, Menu, Calculator,
} from 'lucide-react';
import { StoreProvider, useStore } from './lib/store';
import { currentSession, logout, isCloud } from './lib/backend';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Schedule from './pages/Schedule';
import Spaces from './pages/Spaces';
import Courses from './pages/Courses';
import Plans from './pages/Plans';
import SiteDesigner from './pages/SiteDesigner';
import SettingsPage from './pages/Settings';
import Simulator from './pages/Simulator';

const PAGES = [
  { group: 'For Winners' },
  { id: 'inicio', label: 'Inicio', icon: LayoutDashboard, el: Dashboard },
  { id: 'horario', label: 'Horario', icon: CalendarDays, el: Schedule },
  { id: 'espacios', label: 'Espacios', icon: DoorOpen, el: Spaces },
  { id: 'cursos', label: 'Cursos y precios', icon: GraduationCap, el: Courses },
  { id: 'temas', label: 'Plan de clases', icon: BookOpenCheck, el: Plans },
  { id: 'simulador', label: 'Simulador', icon: Calculator, el: Simulator },
  { group: 'Página web' },
  { id: 'web', label: 'Diseñador web', icon: Palette, el: SiteDesigner, uses: 'site' },
  { group: 'Sistema' },
  { id: 'ajustes', label: 'Ajustes', icon: Settings, el: SettingsPage },
];

const readHash = () => window.location.hash.replace('#/', '') || 'inicio';

function Shell({ onLogout }) {
  const { ops, site, toast } = useStore();
  const [page, setPage] = useState(readHash);
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    const h = () => setPage(readHash());
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);

  const current = PAGES.find((p) => p.id === page) || PAGES[1];
  const doc = current.uses === 'site' ? site : ops;

  useEffect(() => {
    const k = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.target.closest('input,textarea,select')) return;
      if (e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); doc.undo(); }
      if ((e.key.toLowerCase() === 'z' && e.shiftKey) || e.key.toLowerCase() === 'y') { e.preventDefault(); doc.redo(); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [doc]);

  if (!ops.doc || !site.doc) return <div className="empty">Cargando…</div>;
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
        {PAGES.map((p, i) =>
          p.group ? (
            <div key={i} className="nav-group">{p.group}</div>
          ) : (
            <button key={p.id} className={`nav-btn ${p.id === current.id ? 'active' : ''}`} onClick={() => go(p.id)}>
              <p.icon size={18} /> {p.label}
            </button>
          )
        )}
        <div className="side-foot">
          <span>{isCloud ? '☁️ Conectado a la nube' : '💾 Modo local (este navegador)'}</span>
          <button className="nav-btn" onClick={onLogout}>
            <LogOut size={16} /> Cerrar sesión
          </button>
        </div>
      </aside>
      {menu && <div className="overlay" style={{ zIndex: 35 }} onClick={() => setMenu(false)} />}
      <main className="main">
        <div className="row no-print" style={{ justifyContent: 'flex-end', marginBottom: 6 }}>
          <span className={`save-pill ${doc.status}`}>{statusText}</span>
          <button className="btn sm ghost" disabled={!doc.canUndo} onClick={doc.undo} title="Deshacer (Ctrl+Z)">
            <Undo2 size={15} /> Deshacer
          </button>
          <button className="btn sm ghost" disabled={!doc.canRedo} onClick={doc.redo} title="Rehacer (Ctrl+Y)">
            <Redo2 size={15} /> Rehacer
          </button>
        </div>
        <Page go={go} />
      </main>
      {toast && <div className={`toast ${toast.kind === 'bad' ? 'bad' : ''}`}>{toast.msg}</div>}
    </div>
  );
}

export default function App() {
  const [auth, setAuth] = useState(null);
  useEffect(() => {
    currentSession().then(setAuth);
  }, []);
  if (auth === null) return null;
  if (!auth) return <Login onDone={() => setAuth(true)} />;
  return (
    <StoreProvider ready={auth}>
      <Shell
        onLogout={async () => {
          await logout();
          setAuth(false);
        }}
      />
    </StoreProvider>
  );
}
