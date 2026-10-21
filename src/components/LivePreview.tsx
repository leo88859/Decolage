"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Aperçu sans clignotement : deux iframes superposés. Le nouveau rendu se charge dans celui
 * qui est caché, puis prend la place de l'ancien d'un fondu, une fois prêt.
 * `onPage` reçoit la page affichée quand on navigue dans le prototype.
 */
export function LivePreview({ html, title, onPage, sandbox = "allow-scripts allow-forms allow-downloads" }: { html: string; title: string; onPage?: (id: string) => void; sandbox?: string }) {
  const [st, setSt] = useState<{ docs: [string, string]; front: 0 | 1; want: string }>({ docs: [html, ""], front: 0, want: html });
  // Nouveau rendu demandé : il part dans l'iframe caché (mise à jour d'état pendant le rendu, sans effet).
  if (html !== st.want) {
    const back = st.front === 0 ? 1 : 0;
    const docs: [string, string] = [...st.docs];
    docs[back] = html;
    setSt({ docs, front: st.front, want: html });
  }
  const frames = [useRef<HTMLIFrameElement>(null), useRef<HTMLIFrameElement>(null)];
  // Sécurité : si l'événement de chargement tarde, le nouveau rendu prend la place au bout de 700 ms.
  useEffect(() => {
    const want = st.want;
    const id = setTimeout(() => setSt((s) => {
      if (s.want !== want) return s;
      const ready = s.docs[0] === want ? 0 : s.docs[1] === want ? 1 : s.front;
      return ready === s.front ? s : { ...s, front: ready };
    }), 700);
    return () => clearTimeout(id);
  }, [st.want]);
  const pageCb = useRef(onPage);
  useEffect(() => { pageCb.current = onPage; });

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (!frames.some((f) => f.current && e.source === f.current.contentWindow)) return;
      const id = (e.data as { decollagePage?: unknown })?.decollagePage;
      if (typeof id === "string") pageCb.current?.(id);
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="lp">
      {([0, 1] as const).map((i) => (
        <iframe
          key={i}
          ref={frames[i]}
          title={i === st.front ? title : `${title} (préparation)`}
          aria-hidden={i !== st.front}
          tabIndex={i === st.front ? 0 : -1}
          className={i === st.front ? "on" : ""}
          srcDoc={st.docs[i]}
          sandbox={sandbox}
          onLoad={() => setSt((s) => (i !== s.front && s.docs[i] === s.want ? { ...s, front: i } : s))}
        />
      ))}
    </div>
  );
}
