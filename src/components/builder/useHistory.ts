"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Historique annuler / rétablir. Les modifications successives d'un même champ en moins de
 * 800 ms (frappe au clavier) sont regroupées en une seule étape.
 */
export function useHistory<T>(initial: T, limit = 80) {
  const [state, setState] = useState({ past: [] as T[], present: initial, future: [] as T[] });
  const last = useRef({ key: "", at: 0 });

  const commit = useCallback((next: T, key = "") => {
    const now = Date.now();
    const merge = key !== "" && key === last.current.key && now - last.current.at < 800;
    last.current = { key, at: now };
    setState((s) => (merge ? { ...s, present: next, future: [] } : { past: [...s.past, s.present].slice(-limit), present: next, future: [] }));
  }, [limit]);

  const undo = useCallback(() => {
    last.current.key = "";
    setState((s) => (s.past.length ? { past: s.past.slice(0, -1), present: s.past[s.past.length - 1]!, future: [s.present, ...s.future] } : s));
  }, []);

  const redo = useCallback(() => {
    last.current.key = "";
    setState((s) => (s.future.length ? { past: [...s.past, s.present], present: s.future[0]!, future: s.future.slice(1) } : s));
  }, []);

  return { value: state.present, commit, undo, redo, canUndo: state.past.length > 0, canRedo: state.future.length > 0 };
}
