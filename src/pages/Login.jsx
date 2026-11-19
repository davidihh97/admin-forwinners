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
      <form className="login-card" onSubmit={submit}>
        <div className="row">
          <div className="brand-badge">FW</div>
          <div>
            <h2>For Winners</h2>
            <div className="muted small">Panel de administración</div>
          </div>
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
        <button className="btn primary" disabled={!pass || busy} style={{ justifyContent: 'center', padding: 12 }}>
          <Lock size={16} /> {busy ? 'Verificando…' : 'Entrar'}
        </button>
        <p className="small muted" style={{ margin: 0 }}>Si eres el administrador, puedes dejar el usuario vacío.</p>
      </form>
    </div>
  );
}
