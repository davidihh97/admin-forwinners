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
function useDoc(key, initial, ready) {
  const [doc, setDoc] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | saving | saved | error
  const past = useRef([]);
  const future = useRef([]);
  const timer = useRef();
  const [, force] = useState(0);

  useEffect(() => {
    if (!ready) return;
    backend
      .load(key)
      .then((v) => setDoc(v ?? clone(initial)))
      .catch(() => {
        setStatus('error');
        setDoc(clone(initial));
      });
  }, [key, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  const persist = useCallback(
    (next) => {
      setStatus('saving');
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        backend
          .save(key, next)
          .then(() => setStatus('saved'))
          .catch(() => setStatus('error'));
      }, 800);
    },
    [key]
  );

  const docRef = useRef(null);
  docRef.current = doc;

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

  return {
    doc,
    update,
    replace,
    undo,
    redo,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
    status,
  };
}

export function StoreProvider({ children, ready }) {
  const ops = useDoc('operations', seed, ready);
  const site = useDoc('site_draft', defaultSite, ready);
  const [toast, setToast] = useState(null);

  const notify = useCallback((msg, kind = 'ok') => {
    setToast({ msg, kind, id: Date.now() });
    setTimeout(() => setToast(null), 3200);
  }, []);

  const value = { ops, site, data: ops.doc, notify, toast };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const SEED = seed;
