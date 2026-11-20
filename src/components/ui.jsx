import { useEffect } from 'react';
import { X } from 'lucide-react';

export function Modal({ title, onClose, children, footer, wide }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true">
        <div className="modal-h">
          <h2 className="grow">{title}</h2>
          <button className="btn ghost icon" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        <div className="modal-b">{children}</div>
        {footer && <div className="modal-f">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </label>
  );
}

export function Text({ label, hint, value, onChange, area, ...rest }) {
  const Tag = area ? 'textarea' : 'input';
  return (
    <Field label={label} hint={hint}>
      <Tag value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...rest} />
    </Field>
  );
}

export function Num({ label, hint, value, onChange, step = 'any', ...rest }) {
  return (
    <Field label={label} hint={hint}>
      <input
        type="number"
        step={step}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
        {...rest}
      />
    </Field>
  );
}

export function Select({ label, hint, value, onChange, options }) {
  return (
    <Field label={label} hint={hint}>
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) =>
          typeof o === 'string' ? (
            <option key={o} value={o}>{o}</option>
          ) : (
            <option key={o.value} value={o.value}>{o.label}</option>
          )
        )}
      </select>
    </Field>
  );
}

export function Seg({ value, onChange, options }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)} type="button">
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Check({ label, checked, onChange }) {
  return (
    <label className="check">
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

export function Bar({ parts, max = 1 }) {
  return (
    <div className="bar">
      {parts.map((p, i) => (
        <div key={i} title={p.title} style={{ width: `${Math.min(100, (p.value / max) * 100)}%`, background: p.color }} />
      ))}
    </div>
  );
}

export function Kpi({ label, value, sub, icon: Icon, tone, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag className={`card kpi ${tone ? `tone-${tone}` : ''} ${onClick ? 'clickable' : ''}`} onClick={onClick} type={onClick ? 'button' : undefined}>
      <div className="l">{Icon && <span className="ki"><Icon size={15} /></span>}{label}</div>
      <div className="v">{value}</div>
      {sub && <div className="small">{sub}</div>}
    </Tag>
  );
}

export function PageHead({ title, desc, children }) {
  return (
    <div className="topbar">
      <div className="grow">
        <h1>{title}</h1>
        {desc && <p className="muted">{desc}</p>}
      </div>
      {children}
    </div>
  );
}

export function occTag(x) {
  if (x >= 0.9) return 'tag-bad';
  if (x >= 0.7) return 'tag-warn';
  return 'tag-ok';
}
