"use client";

import { useEffect, useRef } from "react";

// Widget Cloudflare Turnstile (facultatif). N'est affiché que si NEXT_PUBLIC_TURNSTILE_SITE_KEY est défini ; le jeton obtenu est
// envoyé avec la commande et vérifié côté serveur (TURNSTILE_SECRET_KEY). Un jeton ne sert qu'une fois : `resetKey` le renouvelle.
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";

type Api = { render: (el: HTMLElement, o: Record<string, unknown>) => string; reset: (id?: string) => void; remove: (id?: string) => void };
declare global {
  interface Window { turnstile?: Api }
}
const SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export function TurnstileWidget({ onToken, resetKey }: { onToken: (t: string) => void; resetKey: number }) {
  const box = useRef<HTMLDivElement>(null);
  const wid = useRef<string | null>(null);
  const cb = useRef(onToken);
  useEffect(() => { cb.current = onToken; });

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    let annule = false;
    const monter = () => {
      if (annule || !box.current || !window.turnstile || wid.current) return;
      wid.current = window.turnstile.render(box.current, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: (t: string) => cb.current(t),
        "expired-callback": () => cb.current(""),
        "error-callback": () => cb.current(""),
      });
    };
    if (window.turnstile) monter();
    else {
      let s = document.querySelector<HTMLScriptElement>("script[data-turnstile]");
      if (!s) {
        s = document.createElement("script");
        s.src = SRC;
        s.async = true;
        s.dataset.turnstile = "1";
        document.head.appendChild(s);
      }
      s.addEventListener("load", monter);
    }
    return () => {
      annule = true;
      if (wid.current && window.turnstile) window.turnstile.remove(wid.current);
      wid.current = null;
    };
  }, []);

  useEffect(() => {
    if (resetKey > 0 && wid.current && window.turnstile) {
      cb.current("");
      window.turnstile.reset(wid.current);
    }
  }, [resetKey]);

  if (!TURNSTILE_SITE_KEY) return null;
  return <div ref={box} className="vt-field" aria-label="Vérification anti-robot" />;
}
