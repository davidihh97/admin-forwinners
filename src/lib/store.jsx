import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import * as backend from './backend';
import seed from '../data/seed.json';
import { defaultSite } from '../site/defaultSite';

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

const clone = (x) => structuredClone(x);
const HISTORY = 40;

/**
 * Un documento con guardado automático y deshacer/rehacer.
 * update(draft => { ...cambios... }) clona, aplica y guarda a los 800 ms.
 */
function useDoc(key, initial, enabled, notify) {
  const [doc, setDoc] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | saving | saved | error
  const past = useRef([]);
  const future = useRef([]);
  const timer = useRef();
  const version = useRef(null);
  const docRef = useRef(null);
  const [, force] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    backend
      .loadDoc(key)
      .then(({ value, version: v }) => {
        version.current = v;
        // Completa claves nuevas que no existían cuando se guardó por primera vez.
        const val = value ? { ...clone(initial), ...value } : clone(initial);
        docRef.current = val;
        setDoc(val);
        // Primera vez: guarda los datos iniciales para que todos trabajen sobre la misma copia.
        if (!value) persist(val);
      })
      .catch((e) => {
        setStatus('error');
        notify?.(`No se pudo cargar: ${e.message}`, 'bad');
      });
  }, [key, enabled]); // eslint-disable-line react-hooks/exhaustive-deps


  const persist = useCallback(
    (next) => {
      setStatus('saving');
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        backend
          .saveDoc(key, next, version.current)
          .then((r) => {
            version.current = r.version;
            setStatus('saved');
          })
          .catch((e) => {
            if (e.status === 409 && e.data?.value) {
              version.current = e.data.version;
              docRef.current = e.data.value;
              setDoc(e.data.value);
              past.current = [];
              future.current = [];
              notify?.(e.message, 'bad');
              setStatus('saved');
              return;
            }
            setStatus('error');
            notify?.(`No se guardó: ${e.message}`, 'bad');
          });
      }, 800);
    },
    [key, notify]
  );

  const commit = useCallback(
    (next, from, to) => {
      from.current = [...from.current.slice(-HISTORY), docRef.current];
      if (to) to.current = [];
      docRef.current = next;
      setDoc(next);
      persist(next);
    },
    [persist]
  );

  const update = useCallback(
    (fn) => {
      const next = clone(docRef.current);
      fn(next);
      commit(next, past, future);
    },
    [commit]
  );
  const replace = useCallback((value) => commit(value, past, future), [commit]);
  const undo = useCallback(() => {
    if (!past.current.length) return;
    const prev = past.current.pop();
    commit(prev, future);
    force((n) => n + 1);
  }, [commit]);
  const redo = useCallback(() => {
    if (!future.current.length) return;
    const next = future.current.pop();
    commit(next, past);
    force((n) => n + 1);
  }, [commit]);

  return { doc, update, replace, undo, redo, canUndo: past.current.length > 0, canRedo: future.current.length > 0, status };
}

export function StoreProvider({ children, session }) {
  const [toast, setToast] = useState(null);
  const notify = useCallback((msg, kind = 'ok') => {
    setToast({ msg, kind, id: Date.now() });
    setTimeout(() => setToast(null), kind === 'bad' ? 5000 : 3200);
  }, []);
  // Si alguna acción falla y la pantalla no lo avisa, se muestra igual el error.
  useEffect(() => {
    const h = (e) => { const m = e.reason?.message; if (m) notify(m, 'bad'); };
    window.addEventListener('unhandledrejection', h);
    return () => window.removeEventListener('unhandledrejection', h);
  }, [notify]);
  const user = session.user;
  const can = useCallback((mod) => user.role === 'owner' || user.perms.includes(mod), [user]);
  const ops = useDoc('operations', seed, true, notify);
  const site = useDoc('site_draft', defaultSite, can('web'), notify);

  const value = { ops, site, data: ops.doc, notify, toast, user, can, siteUrl: session.siteUrl };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Carga una tabla de la base de datos y la mantiene en memoria. */
export function useTable(name, deps = [], range) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const key = JSON.stringify(range || {});
  const reload = useCallback(() => {
    backend.db
      .list(name, {}, range || {})
      .then((r) => {
        setRows(r);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, [name, key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(reload, [reload, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
  return { rows, error, reload, setRows };
}

export const SEED = seed;
