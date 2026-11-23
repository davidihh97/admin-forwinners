import { useState } from 'react';
import { Lock } from 'lucide-react';
import { login } from '../lib/backend';

export default function Login({ onDone }) {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      await login(user.trim() || 'admin', pass);
      onDone();
    } catch (e2) {
      setErr(e2.message);
      setPass('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <div className="login-art">
        <div className="row"><div className="brand-badge">FW</div><b style={{ fontFamily: 'var(--font-head)' }}>For Winners</b></div>
        <div>
          <h2>Todo For Winners en un solo lugar.</h2>
          <p>Estudiantes, asistencia, pagos, horario y la página web, con la información siempre al día.</p>
          <ul>
            <li>Asistencia con firma y horas por estudiante</li>
            <li>Cuotas, cobros y finanzas del mes</li>
            <li>Editor visual de forwinnersec.com</li>
          </ul>
        </div>
        <small style={{ color: '#8fa0bf' }}>Ibarra, Ecuador</small>
      </div>
      <div className="login-side">
        <form className="login-card" onSubmit={submit}>
          <div>
            <h1 style={{ fontSize: '1.4rem' }}>Ingresar al panel</h1>
            <p className="muted small" style={{ margin: '4px 0 0' }}>Usa tu usuario y contraseña del equipo.</p>
          </div>
          <label className="field">
            <span>Usuario</span>
            <input id="login-user" autoComplete="username" placeholder="admin" value={user} onChange={(e) => setUser(e.target.value)} />
          </label>
          <label className="field">
            <span>Contraseña</span>
            <input id="login-pass" type="password" autoFocus autoComplete="current-password" value={pass} onChange={(e) => setPass(e.target.value)} />
          </label>
          {err && <div className="alert bad">{err}</div>}
          <button className="btn primary" disabled={!pass || busy} style={{ height: 44 }}>
            <Lock size={16} /> {busy ? 'Verificando…' : 'Entrar'}
          </button>
          <p className="small muted" style={{ margin: 0 }}>Si eres el administrador, puedes dejar el usuario vacío.</p>
        </form>
      </div>
    </div>
  );
}
