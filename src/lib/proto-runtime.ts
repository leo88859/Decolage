/* eslint-disable @typescript-eslint/no-explicit-any */
// Moteur des prototypes : une mini-application autonome, injectée telle quelle dans le HTML
// (via Function.prototype.toString). Elle ne doit donc dépendre d'AUCUNE variable extérieure.
// Aucune requête réseau. Les données sont gardées en mémoire, et enregistrées si `persist` est vrai :
// - dans le navigateur (localStorage) quand la page est ouverte directement (site publié, fichier exporté) ;
// - dans le projet Décollage, par messages à la page parente, quand le prototype est dans un iframe isolé.

export type ProtoData = {
  name: string; initials: string; logo: string; cible: string; description: string;
  style: string; prix: number; revenu: string; start: string;
  pages: { id: string; titre: string; kind: string; nav: boolean }[];
  mods: Record<string, boolean>; reglages: Record<string, string>; roles: string[];
  entity: { nom: string; pluriel: string; champs: string[] };
  rows: string[][]; status: number; statuses: string[];
  kpis: [string, number, string, number][]; serie: string;
  features: [string, string][]; seed: number;
  shell: string; dash: string; anim: string;
  /** Enregistrer les données de l'utilisateur. `storeKey` identifie l'application ; `initial` = données de départ. */
  persist?: boolean; storeKey?: string; initial?: unknown;
  /** Architecture de l'application (site public + espace utilisateur propre au type de SaaS). Absente = structure standard. */
  arch?: { id: string; frame: string; roles: Record<string, number>; home: string; accounts: boolean } | null;
  heroTitre?: string;
};

export function protoRuntime(D: ProtoData, archModule?: (x: any) => any) {
  const esc = (s: unknown) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as any)[c]);
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let rnd = D.seed || 7;
  const rand = () => { rnd = (rnd * 16807) % 2147483647; return rnd / 2147483647; };

  const ICONS: Record<string, string> = {
    accueil: "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
    dashboard: "M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z",
    tableau: "M4 5h16v14H4zM4 10h16M10 10v9",
    liste: "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01",
    grille: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
    kanban: "M4 4h4v16H4zM10 4h4v10h-4zM16 4h4v13h-4z",
    calendrier: "M5 6h14v14H5zM5 10h14M9 3v4M15 3v4",
    formulaire: "M12 5v14M5 12h14",
    detail: "M6 3h9l4 4v14H6zM9 12h7M9 16h7",
    connexion: "M10 17l5-5-5-5M15 12H3M14 4h5v16h-5",
    profil: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
    tarifs: "M4 7h16v10H4zM4 11h16M8 15h3",
    facturation: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6",
    parametres: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7 7 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z",
    admin: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
    graphique: "M4 19h16M6 16l4-5 3 3 5-7",
    historique: "M12 7v5l3 2M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4",
    notifications: "M6 16V11a6 6 0 1 1 12 0v5l2 2H4zM10 20h4",
    cours: "M5 4l14 8-14 8z",
    editeur: "M4 20h4L19 9l-4-4L4 16zM13 7l4 4",
    heart: "M12 20s-7-4.5-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.5-9 9-9 9z",
    search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-5-5",
    moon: "M20 14A8 8 0 1 1 10 4a6 6 0 0 0 10 10z",
    plus: "M12 5v14M5 12h14",
    trash: "M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
    download: "M12 4v11M7 10l5 5 5-5M5 20h14",
    panier: "M3 4h2l2.5 11h11L21 7H6.5M9 20h.01M18 20h.01",
    mois: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M8 14h2M12 14h2M16 14h2M8 17h2",
    waitlist: "M4 7l8 6 8-6M4 7h16v11H4z",
    objectifs: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
    relances: "M4 12a8 8 0 0 1 14-5.3M20 4v4h-4M20 12a8 8 0 0 1-14 5.3M4 20v-4h4",
    timeline: "M6 4v16M6 7h10M6 12h13M6 17h8",
    certificat: "M12 15a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM9 14l-2 7 5-3 5 3-2-7",
    conversation: "M4 5h16v11H9l-5 4z",
    resultats: "M5 20V10M12 20V4M19 20v-7",
    carte: "M9 4L3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14",
  };
  const icon = (k: string, s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICONS[k] || ICONS.liste}"/></svg>`;

  const NEG = /annul|refus|rupture|ouvert|haute|retard|dépense/i;
  const POS = /confirm|valid|gagn|pay|résolu|livr|termin|en ligne|100|abonnés|envoy/i;
  const priceOf = (s: string) => parseFloat(String(s).replace(",", ".").replace(/[^0-9.]/g, "")) || 0;
  const money = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
  const tone = (s: string) => (NEG.test(s) ? "bad" : POS.test(s) ? "ok" : D.statuses.indexOf(s) % 2 ? "warn" : "info");

  const S: any = {
    page: D.start, prev: [] as string[], q: "", sort: -1, dir: 1, chip: "",
    rows: D.rows.map((r, i) => ({ id: i + 1, v: r.slice(), fav: i === 1 })), next: D.rows.length + 1,
    sel: 1, logged: !D.mods.auth, user: { nom: "Camille Martin", email: "camille@exemple.fr", role: D.roles[0] || "Utilisateur" },
    dark: false, range: 30, annual: false, notifsOn: true,
    notifs: [{ t: `Nouveau : ${D.rows[0] ? D.rows[0][0] : D.entity.nom}`, read: false }, { t: `Bienvenue sur ${D.name} !`, read: false }, { t: "Ton profil est complet à 80 %", read: true }],
    log: [{ t: "Connexion au prototype", at: "à l'instant" }],
    lessons: D.rows.map((r) => /termin/i.test(r[D.status] || "")),
    users: D.roles.map((r, i) => ({ nom: ["Camille Martin", "Léo Dubois", "Sarah Kone", "Hugo Lefèvre"][i % 4], role: r, actif: true })),
    cart: {} as Record<number, number>,
    goals: [{ nom: "Acheter un vélo", cible: 400, actuel: 250 }, { nom: "Vacances d'été", cible: 1200, actuel: 380 }, { nom: "Fonds d'urgence", cible: 1000, actuel: 640 }],
    doneRel: [] as number[],
    msgs: [
      { me: false, t: `Bonjour ! J'ai une question au sujet de « ${D.rows[0] ? D.rows[0][0] : D.entity.nom} ».`, at: "09:12" },
      { me: true, t: "Bonjour, bien sûr : dites-moi tout.", at: "09:14" },
      { me: false, t: "Est-ce qu'on peut avancer la date prévue ?", at: "09:15" },
    ],
    signups: D.kpis[0] ? Math.round(D.kpis[0][1]) : 120, myPos: 0,
    month: new Date(),
    // Architectures : notes par élément, commandes, listes et vues.
    notes: {} as Record<string, string>, orders: [] as any[], nextOrder: 1001,
    list: "all", drawer: false, period: "tout", card: 0, flip: false, noteT: 0,
  };
  // Un aperçu qui démarre dans l'espace utilisateur est considéré comme connecté.
  if (D.arch && D.arch.accounts) S.logged = !String((D.pages.find((p) => p.id === D.start) || { kind: "site-" }).kind).startsWith("site-");
  const log = (t: string) => { S.log.unshift({ t, at: "à l'instant" }); };
  let AR: any = null;

  // ─── Données enregistrées ───
  const KEY = `decollage-app:${D.storeKey || D.name}`;
  const canLocal = (() => { try { localStorage.setItem("__decollage", "1"); localStorage.removeItem("__decollage"); return true; } catch { return false; } })();
  const mode: "local" | "parent" | "none" = !D.persist ? "none" : canLocal ? "local" : parent !== window ? "parent" : "none";
  const snap = () => JSON.stringify({ v: 1, rows: S.rows.map((r: any) => ({ id: r.id, v: r.v, fav: !!r.fav, ...(typeof r.day === "number" ? { day: r.day } : {}) })), next: S.next, lessons: S.lessons, goals: S.goals, doneRel: S.doneRel, cart: S.cart, msgs: S.msgs.slice(-50), notes: S.notes, orders: S.orders.slice(0, 500), nextOrder: S.nextOrder });
  let last = snap();
  /** Recharge un état enregistré, en vérifiant chaque champ (il peut venir d'un stockage modifié à la main). */
  function restore(raw: any): boolean {
    if (!raw || typeof raw !== "object" || !Array.isArray(raw.rows)) return false;
    const n = D.entity.champs.length;
    const rows = raw.rows.filter((r: any) => r && typeof r.id === "number" && Array.isArray(r.v) && r.v.length === n && r.v.every((c: any) => typeof c === "string")).slice(0, 5000);
    if (raw.rows.length && !rows.length) return false; // données d'un autre type de SaaS : on garde l'exemple
    S.rows = rows.map((r: any) => ({ id: r.id, v: r.v.map((c: string) => c.slice(0, 500)), fav: !!r.fav, ...(typeof r.day === "number" ? { day: r.day } : {}) }));
    S.next = Math.max(typeof raw.next === "number" ? raw.next : 1, ...S.rows.map((r: any) => r.id + 1));
    S.lessons = S.rows.map((_: any, i: number) => Array.isArray(raw.lessons) && raw.lessons[i] === true);
    if (Array.isArray(raw.goals)) S.goals = raw.goals.filter((g: any) => g && typeof g.nom === "string" && typeof g.cible === "number" && typeof g.actuel === "number").slice(0, 50);
    if (Array.isArray(raw.doneRel)) S.doneRel = raw.doneRel.filter((x: any) => typeof x === "number");
    if (raw.cart && typeof raw.cart === "object") { const c: Record<string, number> = {}; for (const [k, q] of Object.entries(raw.cart)) if (typeof q === "number" && q > 0) c[k] = Math.min(999, Math.floor(q)); S.cart = c; }
    if (Array.isArray(raw.msgs)) S.msgs = raw.msgs.filter((m: any) => m && typeof m.t === "string").slice(-50).map((m: any) => ({ me: !!m.me, t: m.t.slice(0, 1000), at: String(m.at || "") }));
    if (raw.notes && typeof raw.notes === "object") { const n: Record<string, string> = {}; for (const [k, t] of Object.entries(raw.notes)) if (typeof t === "string" && /^\d{1,9}$/.test(k)) n[k] = t.slice(0, 20000); S.notes = n; }
    if (Array.isArray(raw.orders)) S.orders = raw.orders.filter((o: any) => o && typeof o.id === "number" && typeof o.nom === "string" && typeof o.total === "number" && typeof o.qte === "number").slice(0, 500).map((o: any) => ({ id: o.id, pid: Number(o.pid), nom: o.nom.slice(0, 200), qte: o.qte, total: o.total, client: String(o.client || "").slice(0, 120), statut: String(o.statut || "À préparer").slice(0, 40), date: String(o.date || "").slice(0, 20) }));
    if (typeof raw.nextOrder === "number") S.nextOrder = Math.max(raw.nextOrder, ...S.orders.map((o: any) => o.id + 1));
    last = snap();
    return true;
  }
  function save() {
    if (mode === "none") return;
    const s = snap();
    if (s === last) return;
    last = s;
    if (mode === "local") { try { localStorage.setItem(KEY, s); } catch { toast("Stockage plein : la dernière modification n'est pas enregistrée", "bad"); } }
    else parent.postMessage({ decollageData: JSON.parse(s), key: D.storeKey }, "*");
  }
  const queueSave = () => { setTimeout(save, 0); };
  function resetData() {
    S.rows = D.rows.map((r, i) => ({ id: i + 1, v: r.slice(), fav: i === 1 }));
    S.next = D.rows.length + 1; S.lessons = D.rows.map((r) => /termin/i.test(r[D.status] || "")); S.doneRel = []; S.cart = {}; S.notes = {}; S.orders = [];
    log("Données d'exemple restaurées");
  }
  function parseCsv(txt: string): string[][] {
    const t = txt.replace(/^﻿/, "");
    const first = t.split(/\r?\n/)[0] || "";
    const sep = (first.match(/;/g) || []).length >= (first.match(/,/g) || []).length ? ";" : ",";
    const out: string[][] = [];
    let row: string[] = [], cell = "", q = false;
    for (let i = 0; i < t.length; i++) {
      const c = t[i];
      if (q) { if (c === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
      else if (c === '"') q = true;
      else if (c === sep) { row.push(cell); cell = ""; }
      else if (c === "\n" || c === "\r") { if (c === "\r" && t[i + 1] === "\n") i++; row.push(cell); cell = ""; if (row.some((x) => x.trim())) out.push(row); row = []; }
      else cell += c;
    }
    row.push(cell);
    if (row.some((x) => x.trim())) out.push(row);
    return out;
  }
  function importCsv() {
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = ".csv,text/csv";
    inp.onchange = () => {
      const f = inp.files && inp.files[0];
      if (!f) return;
      if (f.size > 2_000_000) { toast("Fichier trop lourd (2 Mo maximum)", "bad"); return; }
      f.text().then((txt) => {
        const lines = parseCsv(txt);
        const low = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
        const head = (lines[0] || []).map(low);
        const idx = D.entity.champs.map((c) => head.indexOf(low(c)));
        const hasHead = idx.some((j) => j >= 0);
        const data = (hasHead ? lines.slice(1) : lines).slice(0, 2000);
        let added = 0;
        for (const l of data.reverse()) {
          const v = D.entity.champs.map((_, i) => String((hasHead ? (idx[i]! >= 0 ? l[idx[i]!] : "") : l[i]) ?? "").trim().slice(0, 500));
          if (!v[0]) continue;
          if (!D.statuses.includes(v[D.status]!)) v[D.status] = D.statuses[0] || v[D.status]!;
          S.rows.unshift({ id: S.next++, v, fav: false });
          S.lessons.unshift(false);
          added++;
        }
        log(`Import CSV : ${added} ligne${added > 1 ? "s" : ""}`);
        toast(added ? `${added} ligne${added > 1 ? "s" : ""} importée${added > 1 ? "s" : ""}` : "Aucune ligne reconnue", added ? "ok" : "bad");
        render(false); save();
      }, () => toast("Fichier illisible", "bad"));
    };
    inp.click();
  }
  const page = () => D.pages.find((p) => p.id === S.page) || D.pages[0];
  const hasCart = D.pages.some((p) => p.kind === "panier");
  const dataPage = () => D.pages.find((p) => ["tableau", "liste", "grille", "kanban"].includes(p.kind) && p.id !== "favoris");
  const visible = () => {
    const q = S.q.trim().toLowerCase();
    let rows = S.rows.filter((r: any) => (!q || r.v.join(" ").toLowerCase().includes(q)) && (!S.chip || r.v[D.status] === S.chip));
    if (S.sort >= 0) rows = rows.slice().sort((a: any, b: any) => a.v[S.sort].localeCompare(b.v[S.sort], "fr", { numeric: true }) * S.dir);
    return rows;
  };

  // ─── Petits composants ───
  const badge = (s: string) => `<span class="bdg ${tone(s)}">${esc(s)}</span>`;
  const avatar = (n: string, size = 32) => `<span class="av" style="width:${size}px;height:${size}px;--h:${(n.charCodeAt(0) * 37) % 360}">${esc(n.split(" ").map((w) => w[0]).slice(0, 2).join(""))}</span>`;
  const head = (title: string, sub = "", actions = "") => `<div class="ph"><div><h1>${esc(title)}</h1>${sub ? `<p class="mut">${sub}</p>` : ""}</div><div class="row">${actions}</div></div>`;
  const addBtn = () => (D.mods.formulaires ? `<button class="b primary" data-act="add">${icon("plus", 16)} ${esc(D.entity.nom)}</button>` : "");
  const csvBtn = () => (D.mods["export-csv"] ? `<button class="b" data-act="csv">${icon("download", 16)} CSV</button>` : "");
  const importBtn = () => (D.mods.formulaires || D.mods["export-csv"] ? `<button class="b" data-act="csvimport" title="Importer un fichier CSV (Excel, Google Sheets…)">${icon("plus", 16)} Importer</button>` : "");
  const chips = () => `<div class="chips">${["", ...D.statuses].map((s) => `<button class="chip${S.chip === s ? " on" : ""}" data-act="chip" data-v="${esc(s)}">${s ? esc(s) : "Tous"}</button>`).join("")}</div>`;
  const empty = (t: string, sub: string) => `<div class="empty"><div class="empty-ic">${icon("search", 26)}</div><b>${esc(t)}</b><p class="mut">${esc(sub)}</p></div>`;

  function series(n: number) {
    rnd = (D.seed || 7) + n;
    let v = 30 + rand() * 20;
    return Array.from({ length: n }, () => (v = Math.max(5, v + (rand() - 0.35) * 12)));
  }
  function chart(n: number, kind: string) {
    const data = series(n);
    const W = 640, H = 220, P = 8, max = Math.max(...data) * 1.15;
    const x = (i: number) => P + (i * (W - P * 2)) / (n - 1);
    const y = (v: number) => H - 24 - (v / max) * (H - 40);
    if (kind === "Barres") {
      const bw = Math.max(4, (W - P * 2) / n - 6);
      return `<svg viewBox="0 0 ${W} ${H}" class="chart">${data.map((v, i) => `<rect class="bar" style="--i:${i}" x="${x(i) - bw / 2}" y="${y(v)}" width="${bw}" height="${H - 24 - y(v)}" rx="4"><title>${Math.round(v)}</title></rect>`).join("")}<line x1="0" x2="${W}" y1="${H - 24}" y2="${H - 24}" class="axis"/></svg>`;
    }
    const line = data.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
    return `<svg viewBox="0 0 ${W} ${H}" class="chart"><defs><linearGradient id="g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--p)" stop-opacity=".28"/><stop offset="1" stop-color="var(--p)" stop-opacity="0"/></linearGradient></defs>${[0.25, 0.5, 0.75].map((t) => `<line x1="0" x2="${W}" y1="${(H - 24) * t}" y2="${(H - 24) * t}" class="grid"/>`).join("")}<path class="area" d="${line} L${x(n - 1)},${H - 24} L${x(0)},${H - 24} Z" fill="url(#g)"/><path class="line" d="${line}" pathLength="1"/>${data.map((v, i) => `<circle class="pt" cx="${x(i)}" cy="${y(v)}" r="10"><title>${Math.round(v)}</title></circle>`).join("")}<line x1="0" x2="${W}" y1="${H - 24}" y2="${H - 24}" class="axis"/></svg>`;
  }
  const kpis = () => `<div class="kpis">${D.kpis.map(([l, v, u, d], i) => `<div class="card kpi" style="--i:${i}"><span class="mut sm">${esc(l)}</span><div class="big"><span data-count="${v}">0</span>${esc(u)}</div><span class="delta ${d >= 0 ? "up" : "down"}">${d >= 0 ? "▲" : "▼"} ${Math.abs(d)} %</span></div>`).join("")}</div>`;

  // ─── Tableaux de bord : un par design ───
  const hello = (sub = "Voici ce qui se passe aujourd'hui.") => head(`Bonjour ${S.user.nom.split(" ")[0]} 👋`, sub, addBtn());
  const recent = (n = 4) => `<div class="mini-list">${S.rows.slice(0, n).map((r: any) => `<button class="mini" data-act="open" data-id="${r.id}">${avatar(r.v[0], 30)}<span class="grow"><b>${esc(r.v[0])}</b><span class="mut sm">${esc(r.v[1])}</span></span>${badge(r.v[D.status])}</button>`).join("")}</div>`;
  const counts = () => D.statuses.map((s) => ({ s, n: S.rows.filter((r: any) => r.v[D.status] === s).length }));
  const PAL = ["var(--p)", "var(--a)", "color-mix(in srgb,var(--p) 50%,var(--a))", "color-mix(in srgb,var(--ink) 28%,var(--sf))", "color-mix(in srgb,var(--p) 30%,var(--sf))"];
  const kv = (i: number) => { const k = D.kpis[i] || D.kpis[0]; return k ? `<span data-count="${k[1]}">0</span>${esc(k[2])}` : ""; };
  const delta = (d: number) => `<span class="delta ${d >= 0 ? "up" : "down"}">${d >= 0 ? "▲" : "▼"} ${Math.abs(d)} %</span>`;
  function donut(size = 150) {
    const c = counts(), tot = Math.max(1, c.reduce((a, x) => a + x.n, 0));
    const R = 54, C = 2 * Math.PI * R;
    let off = 0;
    const segs = c.map((x, i) => { const len = (x.n / tot) * C; const s = x.n ? `<circle class="seg" style="--i:${i};stroke:${PAL[i % PAL.length]}" r="${R}" cx="70" cy="70" stroke-dasharray="${Math.max(0, len - 3).toFixed(1)} ${C.toFixed(1)}" stroke-dashoffset="${(-off).toFixed(1)}"><title>${esc(x.s)} : ${x.n}</title></circle>` : ""; off += len; return s; }).join("");
    return `<div class="donut-w"><svg class="donut" width="${size}" height="${size}" viewBox="0 0 140 140"><circle class="seg-bg" r="${R}" cx="70" cy="70"/><g transform="rotate(-90 70 70)">${segs}</g><text x="70" y="68" class="donut-n">${S.rows.length}</text><text x="70" y="88" class="donut-l">${esc(D.entity.pluriel.toLowerCase().slice(0, 14))}</text></svg><div class="legend">${c.map((x, i) => `<span><i style="background:${PAL[i % PAL.length]}"></i>${esc(x.s)}<b>${x.n}</b></span>`).join("")}</div></div>`;
  }
  function wave(n = 24) {
    const W = 640, H = 200, a = series(n), b = series(n + 5).slice(0, n).map((v) => v * 0.6);
    const max = Math.max(...a, ...b) * 1.2;
    const x = (i: number) => (i * W) / (n - 1), y = (v: number) => H - (v / max) * H;
    const path = (d: number[]) => d.map((v, i) => (i ? `Q${x(i - 1).toFixed(1)},${y(d[i - 1]).toFixed(1)} ${((x(i - 1) + x(i)) / 2).toFixed(1)},${((y(d[i - 1]) + y(v)) / 2).toFixed(1)}` : `M0,${y(v).toFixed(1)}`)).join(" ") + ` L${W},${y(d[n - 1]).toFixed(1)}`;
    return `<svg viewBox="0 0 ${W} ${H}" class="chart wave" preserveAspectRatio="none"><path class="wave-b" d="${path(b)} L${W},${H} L0,${H} Z"/><path class="wave-a" d="${path(a)} L${W},${H} L0,${H} Z"/><path class="line" d="${path(a)}" pathLength="1"/></svg>`;
  }
  const ringsRow = () => `<div class="rings">${D.kpis.map(([l, v, u, d], i) => { const pct = Math.max(12, Math.min(96, 48 + d * 2 + i * 7)); return `<div class="card ring-c" style="--i:${i}"><div class="ring big-ring" style="--v:${pct}"><span>${pct} %</span></div><b class="sm">${esc(l)}</b><span class="mut xs"><span data-count="${v}">0</span>${esc(u)} · objectif</span></div>`; }).join("")}</div>`;
  const statusBars = () => { const c = counts(), m = Math.max(1, ...c.map((x) => x.n)); return `<div class="hbars">${c.map((x, i) => `<div class="hbar" style="--i:${i}"><span class="sm">${esc(x.s)}</span><div class="gbar"><i style="width:${(x.n / m) * 100}%;background:${PAL[i % PAL.length]}"></i></div><b class="sm">${x.n}</b></div>`).join("")}</div>`; };
  const DASH: Record<string, () => string> = {
    "kpi-chart": () => `${hello()}${kpis()}<div class="split"><div class="card"><div class="row between"><b>${esc(D.serie)}</b><span class="mut sm">30 derniers jours</span></div>${chart(30, "Courbe")}</div><div class="card"><b>Récemment</b>${recent()}</div></div>`,
    bento: () => `${hello()}<div class="bento"><div class="card bt-a"><div class="row between"><b>${esc(D.serie)}</b>${delta(D.kpis[0] ? D.kpis[0][3] : 0)}</div><div class="big xl">${kv(0)}</div>${chart(20, "Courbe")}</div><div class="card bt-b"><span class="mut sm">${esc(D.kpis[1] ? D.kpis[1][0] : "")}</span><div class="big">${kv(1)}</div>${delta(D.kpis[1] ? D.kpis[1][3] : 0)}</div><div class="card bt-c"><span class="mut sm">${esc(D.kpis[2] ? D.kpis[2][0] : "")}</span><div class="big">${kv(2)}</div>${delta(D.kpis[2] ? D.kpis[2][3] : 0)}</div><div class="card bt-d">${donut(120)}</div><div class="card bt-e"><b>Récemment</b>${recent(3)}</div></div>`,
    donut: () => `${hello()}<div class="split"><div class="card"><b>Répartition par statut</b>${donut(190)}</div><div class="stack">${D.kpis.slice(0, 3).map(([l, v, u, d], i) => `<div class="card kpi row between" style="--i:${i}"><span><span class="mut sm">${esc(l)}</span><div class="big"><span data-count="${v}">0</span>${esc(u)}</div></span>${delta(d)}</div>`).join("")}</div></div><div class="card"><b>Récemment</b>${recent()}</div>`,
    editorial: () => `<div class="edito"><span class="tag">${new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</span><h1 class="edito-t">${esc(D.serie)} : <em>${kv(0)}</em></h1><p class="mut">${esc(D.kpis[0] ? D.kpis[0][0] : "")}, ${D.kpis[0] && D.kpis[0][3] >= 0 ? "en hausse" : "en baisse"} de ${Math.abs(D.kpis[0] ? D.kpis[0][3] : 0)} % sur le mois.</p></div><div class="edito-k">${D.kpis.slice(1).map(([l, v, u, d], i) => `<div class="rowin" style="--i:${i}"><div class="big"><span data-count="${v}">0</span>${esc(u)}</div><span class="mut sm">${esc(l)}</span>${delta(d)}</div>`).join("")}</div><div class="edito-l">${S.rows.slice(0, 5).map((r: any, k: number) => `<button class="edito-r rowin" style="--i:${k}" data-act="open" data-id="${r.id}"><span class="edito-n">${String(k + 1).padStart(2, "0")}</span><span class="grow"><b>${esc(r.v[0])}</b><span class="mut sm">${esc(r.v[1])}</span></span>${badge(r.v[D.status])}</button>`).join("")}</div>`,
    bars: () => `${hello()}${kpis()}<div class="split"><div class="card"><div class="row between"><b>${esc(D.serie)}</b><span class="mut sm">12 dernières semaines</span></div>${chart(12, "Barres")}</div><div class="card"><b>Par statut</b>${statusBars()}</div></div>`,
    table: () => `${head(D.entity.pluriel, `Vue d'ensemble · ${S.rows.length} ${esc(D.entity.pluriel.toLowerCase())}`, csvBtn() + addBtn())}<div class="strip">${D.kpis.map(([l, v, u, d]) => `<div><span class="mut xs">${esc(l)}</span><b><span data-count="${v}">0</span>${esc(u)}</b>${delta(d)}</div>`).join("")}</div>${table(S.rows.slice(0, 6))}`,
    wave: () => `${hello()}<div class="card wave-c"><div class="row between"><span><span class="mut sm">${esc(D.serie)}</span><div class="big xl">${kv(0)}</div></span>${delta(D.kpis[0] ? D.kpis[0][3] : 0)}</div>${wave()}</div>${kpis()}<div class="card"><b>Récemment</b>${recent()}</div>`,
    rings: () => `${hello("Tes objectifs du mois en un coup d'œil.")}${ringsRow()}<div class="split"><div class="card"><b>${esc(D.serie)}</b>${chart(30, "Courbe")}</div><div class="card"><b>Récemment</b>${recent()}</div></div>`,
    terminal: () => `${head(`~/${D.name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, "session ouverte · données d'exemple", addBtn())}<div class="term card"><div class="term-h"><i></i><i></i><i></i><span class="mut xs">activité</span></div>${S.rows.slice(0, 6).map((r: any, k: number) => `<div class="term-l" style="--i:${k}"><span class="mut">[${String(9 + k).padStart(2, "0")}:${String((k * 17) % 60).padStart(2, "0")}]</span> <b class="${tone(r.v[D.status])}">${POS.test(r.v[D.status]) ? "✓" : NEG.test(r.v[D.status]) ? "✗" : "›"}</b> ${esc(r.v[0])} <span class="mut">— ${esc(r.v[D.status])}</span></div>`).join("")}<div class="term-l cur" style="--i:6">$ <span class="caret"></span></div></div><div class="strip">${D.kpis.map(([l, v, u, d]) => `<div><span class="mut xs">${esc(l)}</span><b><span data-count="${v}">0</span>${esc(u)}</b>${delta(d)}</div>`).join("")}</div>`,
    mosaic: () => `<div class="banner"><div><span class="tag">Aujourd'hui</span><h1>Bonjour ${esc(S.user.nom.split(" ")[0])} ✨</h1><p>${esc(D.serie)} : <b>${kv(0)}</b> ${D.kpis[0] && D.kpis[0][3] >= 0 ? "· en hausse" : ""}</p></div>${addBtn()}</div>${ringsRow()}<div class="split"><div class="card"><b>Par statut</b>${statusBars()}</div><div class="card"><b>Récemment</b>${recent()}</div></div>`,
  };

  function table(rows: any[]) {
    if (!rows.length) return empty("Aucun résultat", "Modifie ta recherche ou tes filtres.");
    return `<div class="card flush"><table><thead><tr>${D.entity.champs.map((c, i) => `<th><button data-act="sort" data-v="${i}">${esc(c)} ${S.sort === i ? (S.dir > 0 ? "↑" : "↓") : ""}</button></th>`).join("")}<th></th></tr></thead><tbody>${rows.map((r: any, k: number) => `<tr class="rowin" style="--i:${k}" data-act="open" data-id="${r.id}">${r.v.map((c: string, i: number) => `<td>${i === 0 ? `<span class="cell-main">${avatar(c, 28)}<b>${esc(c)}</b></span>` : i === D.status ? badge(c) : esc(c)}</td>`).join("")}<td class="r">${D.mods.favoris ? `<button class="ib fav${r.fav ? " on" : ""}" data-act="fav" data-id="${r.id}" aria-label="Favori">${icon("heart", 16)}</button>` : ""}<button class="ib" data-act="del" data-id="${r.id}" aria-label="Supprimer">${icon("trash", 16)}</button></td></tr>`).join("")}</tbody></table></div>`;
  }

  // ─── Pages ───
  const P: Record<string, () => string> = {
    accueil: () => `<section class="hero"><div class="blob b1"></div><div class="blob b2"></div><span class="tag">${esc(D.cible || D.entity.pluriel)}</span><h1 class="hero-t">${esc(D.name)}</h1><p class="mut hero-s">${esc(D.description)}</p><div class="row center"><button class="b primary lg" data-act="${D.mods.auth && !S.logged ? "go" : "go"}" data-v="${D.mods.auth && !S.logged ? "connexion" : (dataPage() || D.pages[1] || D.pages[0]).id}">${D.mods.auth && !S.logged ? "Créer un compte" : "Commencer"} →</button><button class="b lg" data-act="go" data-v="${(D.pages.find((p) => p.kind === "dashboard") || dataPage() || D.pages[0]).id}">Voir la démo</button></div></section><div class="feats">${D.features.map(([a, b], i) => `<div class="card feat" style="--i:${i}"><span class="feat-ic">${icon(["dashboard", "grille", "graphique", "notifications"][i % 4], 20)}</span><b>${esc(a)}</b><p class="mut sm">${esc(b)}</p></div>`).join("")}</div>`,
    dashboard: () => (DASH[D.dash] || DASH["kpi-chart"])(),
    tableau: () => `${head(D.entity.pluriel, `${S.rows.length} ${esc(D.entity.pluriel.toLowerCase())}`, csvBtn() + importBtn() + addBtn())}${chips()}${table(visible())}`,
    liste: () => {
      const fav = page().id === "favoris";
      const rows = fav ? S.rows.filter((r: any) => r.fav) : visible();
      return `${head(page().titre, fav ? "Les éléments que tu as gardés." : "", fav ? "" : addBtn())}${fav && !rows.length ? empty("Aucun favori", "Clique sur ♡ dans une liste pour en ajouter.") : `<div class="stack">${rows.map((r: any, k: number) => `<button class="card li rowin" style="--i:${k}" data-act="open" data-id="${r.id}">${avatar(r.v[0], 38)}<span class="grow"><b>${esc(r.v[0])}</b><span class="mut sm">${esc(r.v.slice(1, 3).join(" · "))}</span></span>${badge(r.v[D.status])}</button>`).join("")}</div>`}`;
    },
    grille: () => `${head(page().titre, `${visible().length} ${esc(D.entity.pluriel.toLowerCase())}`, addBtn())}${chips()}${visible().length ? `<div class="gridc">${visible().map((r: any, k: number) => `<div class="card tile rowin" style="--i:${k}" data-act="open" data-id="${r.id}"><div class="thumb" style="--h:${(r.id * 53) % 360}"><span>${esc(r.v[0][0])}</span>${D.mods.favoris ? `<button class="ib fav${r.fav ? " on" : ""}" data-act="fav" data-id="${r.id}" aria-label="Favori">${icon("heart", 16)}</button>` : ""}</div><b>${esc(r.v[0])}</b><p class="mut sm">${esc(r.v[1])} · ${esc(r.v[2])}</p><div class="row between">${badge(r.v[D.status])}${hasCart ? `<button class="b sm primary" data-act="cart" data-id="${r.id}">+ Panier</button>` : ""}</div></div>`).join("")}</div>` : empty("Aucun résultat", "Essaie une autre recherche.")}`,
    kanban: () => `${head(page().titre, "Glisse les cartes d'une colonne à l'autre.", addBtn())}<div class="kanban">${D.statuses.map((s) => { const rows = visible().filter((r: any) => r.v[D.status] === s); return `<div class="col" data-drop="${esc(s)}"><div class="col-h">${badge(s)}<span class="mut sm">${rows.length}</span></div>${rows.map((r: any) => `<div class="card kc" draggable="true" data-drag="${r.id}" data-act="open" data-id="${r.id}"><b>${esc(r.v[0])}</b><span class="mut sm">${esc(r.v[1])}</span><div class="row between">${avatar(r.v[0], 24)}<span class="mut xs">${esc(r.v[extra] || "")}</span></div></div>`).join("")}</div>`; }).join("")}</div>`,
    calendrier: () => {
      const days = ["Lun.", "Mar.", "Mer.", "Jeu.", "Ven."];
      const hours = ["09:00", "10:00", "11:00", "14:00", "14:30", "16:00"];
      return `${head(page().titre, "Clique sur un créneau libre pour réserver.")}<div class="cal">${days.map((d) => `<div class="day"><b class="day-h">${d}</b>${hours.map((hh) => { const r = S.rows.find((x: any) => x.v[1] === `${d} ${hh}` || x.v[1] === `${d.replace(".", "")} ${hh}`); return r ? `<button class="slot busy ${tone(r.v[D.status])}" data-act="open" data-id="${r.id}"><b>${hh}</b><span>${esc(r.v[0])}</span></button>` : `<button class="slot" data-act="book" data-v="${d} ${hh}"><b>${hh}</b><span>Libre</span></button>`; }).join("")}</div>`).join("")}</div>`;
    },
    formulaire: () => `${head(page().titre, `Ajouter : ${esc(D.entity.nom.toLowerCase())}`)}<form class="card form" data-form="add">${fields()}<div class="row"><button class="b primary">Enregistrer</button><button type="button" class="b" data-act="back">Annuler</button></div></form>`,
    detail: () => {
      const r = S.rows.find((x: any) => x.id === S.sel) || S.rows[0];
      if (!r) return empty("Rien à afficher", "Ajoute d'abord un élément.");
      return `<button class="b ghost" data-act="back">← Retour</button><div class="card det"><div class="det-h" style="--h:${(r.id * 53) % 360}">${avatar(r.v[0], 64)}<div><h1>${esc(r.v[0])}</h1><p class="mut">${esc(D.entity.nom)} · ${esc(r.v[1])}</p></div><div class="row r">${D.mods.favoris ? `<button class="ib fav${r.fav ? " on" : ""}" data-act="fav" data-id="${r.id}" aria-label="Favori">${icon("heart", 18)}</button>` : ""}<button class="b danger" data-act="del" data-id="${r.id}">Supprimer</button></div></div><div class="kvs">${D.entity.champs.map((c, i) => `<label class="kv"><span class="mut sm">${esc(c)}</span>${i === D.status ? `<select data-edit="${i}" data-id="${r.id}">${D.statuses.map((s) => `<option${s === r.v[i] ? " selected" : ""}>${esc(s)}</option>`).join("")}</select>` : `<input data-edit="${i}" data-id="${r.id}" value="${esc(r.v[i])}">`}</label>`).join("")}</div><div class="timeline"><b>Activité</b>${S.log.slice(0, 4).map((l: any) => `<div class="tl"><i></i><span>${esc(l.t)}</span><span class="mut xs">${esc(l.at)}</span></div>`).join("")}</div></div>`;
    },
    connexion: () => `<div class="auth"><div class="card auth-c"><div class="logo-l">${logo(44)}</div><h1>${S.logged ? "Tu es connecté·e" : "Connexion"}</h1><p class="mut">${S.logged ? `Bienvenue, ${esc(S.user.nom)}.` : `Accède à ton espace ${esc(D.name)}.`}</p>${S.logged ? `<button class="b primary lg" data-act="go" data-v="${(D.pages.find((p) => p.nav && p.kind !== "accueil") || D.pages[0]).id}">Continuer →</button>` : `<form class="form" data-form="login"><label>Email<input type="email" required placeholder="toi@exemple.fr"></label>${D.reglages["auth.methode"] === "Lien magique par email" ? "" : `<label>Mot de passe<input type="password" required minlength="4" placeholder="••••••••"></label>`}<button class="b primary lg">${D.reglages["auth.methode"] === "Lien magique par email" ? "Recevoir mon lien" : "Se connecter"}</button></form>`}<p class="mut xs">Prototype : aucune vérification réelle.</p></div></div>`,
    profil: () => `${head(page().titre)}<form class="card form" data-form="profil"><div class="row">${avatar(S.user.nom, 72)}<div><b>${esc(S.user.nom)}</b><p class="mut sm">${esc(S.user.role)}</p></div></div><label>Nom<input name="nom" value="${esc(S.user.nom)}"></label><label>Email<input name="email" type="email" value="${esc(S.user.email)}"></label><label>Rôle<select name="role">${D.roles.map((r) => `<option${r === S.user.role ? " selected" : ""}>${esc(r)}</option>`).join("")}</select></label><button class="b primary">Enregistrer</button></form>`,
    tarifs: () => {
      const essai = D.reglages["abonnement.essai"];
      const p = D.prix || 9;
      const plans = [["Gratuit", 0, ["L'essentiel", "1 utilisateur"]], ["Pro", p, ["Tout illimité", "Support par email", "Exports"]], ["Équipe", Math.round(p * 2.5), ["Tout Pro", "5 utilisateurs", "Support prioritaire"]]] as [string, number, string[]][];
      const once = D.revenu === "paiement-unique";
      const toggle = once ? "" : `<div class="toggle"><button class="${S.annual ? "" : "on"}" data-act="annual" data-v="0">Mensuel</button><button class="${S.annual ? "on" : ""}" data-act="annual" data-v="1">Annuel <span class="bdg ok">2 mois offerts</span></button></div>`;
      const per = once ? " une fois" : S.annual ? " / an" : " / mois";
      return `${head(page().titre, essai && essai !== "Aucune" ? `Essai gratuit : ${esc(essai)}` : once ? "Un seul paiement, accès à vie." : "Change d'offre quand tu veux.")}${toggle}<div class="plans">${plans.map(([n, v, f], i) => `<div class="card plan${i === 1 ? " hl" : ""}" style="--i:${i}">${i === 1 ? `<span class="pop">Populaire</span>` : ""}<b>${n}</b><div class="price">${v === 0 ? "0 €" : `${S.annual && !once ? v * 10 : v} €`}<span class="mut sm">${v === 0 ? "" : per}</span></div><ul>${f.map((x) => `<li>${esc(x)}</li>`).join("")}</ul><button class="b ${i === 1 ? "primary" : ""}" data-act="plan" data-v="${n}">${v === 0 ? "Commencer" : "Choisir"}</button></div>`).join("")}</div>`;
    },
    facturation: () => `${head(page().titre, "Paiements et factures (exemples).")}<div class="card flush"><table><thead><tr><th>Date</th><th>Offre</th><th>Montant</th><th>Statut</th><th></th></tr></thead><tbody>${["1er juin", "1er mai", "1er avril", "1er mars"].map((d, k) => `<tr class="rowin" style="--i:${k}"><td>${d}</td><td>Pro</td><td><b>${D.prix || 9} €</b></td><td>${badge("Payée")}</td><td class="r"><button class="b sm" data-act="toast" data-v="Facture d'exemple : rien à télécharger dans le prototype">${icon("download", 14)} PDF</button></td></tr>`).join("")}</tbody></table></div>`,
    parametres: () => `${head(page().titre)}<div class="card form"><label class="sw"><span><b>Notifications</b><span class="mut sm">Recevoir les alertes dans l'application</span></span><input type="checkbox" data-act="notifs"${S.notifsOn ? " checked" : ""}></label><label class="sw"><span><b>Mode sombre</b><span class="mut sm">Interface foncée</span></span><input type="checkbox" data-act="dark"${S.dark ? " checked" : ""}></label><label>Langue<select><option>Français</option><option>English</option></select></label></div><div class="card form" style="margin-top:14px"><b>Données de l'application</b><p class="mut sm">${mode === "none" ? "Aperçu : les données ne sont pas enregistrées." : `${S.rows.length} ${esc(D.entity.pluriel.toLowerCase())} enregistrés ${mode === "local" ? "sur cet appareil" : "dans ton projet"}.`}</p><div class="row"><button class="b" data-act="csv">${icon("download", 16)} Exporter en CSV</button><button class="b" data-act="csvimport">${icon("plus", 16)} Importer un CSV</button><button class="b danger" data-act="reset">Revenir aux données d'exemple</button></div></div><div class="card danger-z"><b>Zone sensible</b><p class="mut sm">La suppression du compte est définitive.</p><button class="b danger" data-act="confirm" data-v="Supprimer le compte ?">Supprimer mon compte</button></div>`,
    admin: () => `${head(page().titre, "Réservé au propriétaire.")}${kpis()}<div class="card flush"><table><thead><tr><th>Utilisateur</th><th>Rôle</th><th>Statut</th><th></th></tr></thead><tbody>${S.users.map((u: any, i: number) => `<tr class="rowin" style="--i:${i}"><td><span class="cell-main">${avatar(u.nom, 28)}<b>${esc(u.nom)}</b></span></td><td>${esc(u.role)}</td><td>${badge(u.actif ? "Actif" : "Suspendu")}</td><td class="r"><button class="b sm" data-act="user" data-v="${i}">${u.actif ? "Suspendre" : "Réactiver"}</button></td></tr>`).join("")}</tbody></table></div>`,
    graphique: () => `${head(page().titre, esc(D.serie))}<div class="toggle">${[7, 30, 90].map((n) => `<button class="${S.range === n ? "on" : ""}" data-act="range" data-v="${n}">${n} jours</button>`).join("")}</div><div class="card">${chart(S.range === 7 ? 7 : S.range === 30 ? 30 : 45, D.reglages["graphiques.type"] || "Courbe")}</div>${kpis()}`,
    historique: () => `${head(page().titre, "Les actions faites pendant cette session.")}<div class="card timeline">${S.log.map((l: any, k: number) => `<div class="tl rowin" style="--i:${k}"><i></i><span>${esc(l.t)}</span><span class="mut xs">${esc(l.at)}</span></div>`).join("")}</div>`,
    notifications: () => `${head(page().titre, "", `<button class="b" data-act="readall">Tout marquer comme lu</button>`)}<div class="stack">${S.notifs.map((n: any, i: number) => `<button class="card li rowin${n.read ? " read" : ""}" style="--i:${i}" data-act="read" data-v="${i}"><span class="dot${n.read ? "" : " on"}"></span><span class="grow">${esc(n.t)}</span><span class="mut xs">${n.read ? "Lu" : "Nouveau"}</span></button>`).join("")}</div>`,
    cours: () => {
      const done = S.lessons.filter(Boolean).length;
      const pct = Math.round((done / Math.max(1, S.lessons.length)) * 100);
      return `${head(page().titre, `${done} / ${S.lessons.length} leçons terminées`)}<div class="split"><div class="card"><div class="player" data-act="play"><span class="play">${icon("cours", 28)}</span><div class="prog"><i></i></div></div><b>${esc((S.rows[S.lessons.indexOf(false)] || S.rows[0]).v[0])}</b><p class="mut sm">Leçon en cours</p></div><div class="card"><div class="ring" style="--v:${pct}"><span>${pct} %</span></div>${S.rows.map((r: any, i: number) => `<label class="lesson"><input type="checkbox" data-act="lesson" data-v="${i}"${S.lessons[i] ? " checked" : ""}><span>${esc(r.v[0])}</span><span class="mut xs">${esc(r.v[2])}</span></label>`).join("")}</div></div>`;
    },
    panier: () => {
      const items = Object.entries(S.cart as Record<string, number>).map(([id, q]) => ({ r: S.rows.find((x: any) => x.id === Number(id)), q })).filter((x) => x.r && x.q > 0);
      const total = items.reduce((s, x: any) => s + priceOf(x.r.v[1]) * x.q, 0);
      if (!items.length) return `${head(page().titre)}${empty("Ton panier est vide", "Ajoute des produits depuis le catalogue.")}<div class="row center" style="margin-top:14px"><button class="b primary" data-act="go" data-v="${(D.pages.find((p) => p.kind === "grille") || D.pages[0]).id}">Voir le catalogue</button></div>`;
      return `${head(page().titre, `${items.length} produit${items.length > 1 ? "s" : ""}`)}<div class="split"><div class="stack">${items.map((x: any, k: number) => `<div class="card li rowin" style="--i:${k};cursor:default"><div class="thumb mini-thumb" style="--h:${(x.r.id * 53) % 360}"><span>${esc(x.r.v[0][0])}</span></div><span class="grow"><b>${esc(x.r.v[0])}</b><span class="mut sm">${esc(x.r.v[1])}</span></span><div class="qty"><button class="ib" data-act="qty" data-id="${x.r.id}" data-v="-1" aria-label="Retirer un">−</button><b>${x.q}</b><button class="ib" data-act="qty" data-id="${x.r.id}" data-v="1" aria-label="Ajouter un">+</button></div></div>`).join("")}</div><div class="card sum"><b>Récapitulatif</b><div class="kv"><span class="mut">Sous-total</span><b>${money(total)}</b></div><div class="kv"><span class="mut">Livraison</span><b>${total >= 50 ? "Offerte" : money(4.9)}</b></div><div class="kv tot"><span>Total</span><b>${money(total + (total >= 50 ? 0 : 4.9))}</b></div><button class="b primary lg" data-act="checkout">Commander</button><p class="mut xs">Paiement simulé : aucun débit dans le prototype.</p></div></div>`;
    },
    mois: () => {
      const d = S.month as Date;
      const y = d.getFullYear(), m = d.getMonth();
      const first = (new Date(y, m, 1).getDay() + 6) % 7;
      const days = new Date(y, m + 1, 0).getDate();
      const label = d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
      const byDay: Record<number, any[]> = {};
      S.rows.forEach((r: any) => { const day = Math.min(days, r.day || ((r.id * 4 + 3) % 28) + 1); (byDay[day] = byDay[day] || []).push(r); });
      const cells = Array.from({ length: first }, () => `<div class="mday off"></div>`).concat(Array.from({ length: days }, (_, i) => {
        const n = i + 1;
        const list = byDay[n] || [];
        return `<button class="mday" data-act="bookday" data-v="${n}"><span class="mnum">${n}</span>${list.slice(0, 2).map((r: any) => `<span class="mev ${tone(r.v[D.status])}">${esc(r.v[0])}</span>`).join("")}${list.length > 2 ? `<span class="mut xs">+${list.length - 2}</span>` : ""}</button>`;
      })).concat(Array.from({ length: (7 - ((first + days) % 7)) % 7 }, () => `<div class="mday off"></div>`));
      return `${head(page().titre, "Clique sur un jour pour ajouter un élément.", `<button class="ib" data-act="month" data-v="-1" aria-label="Mois précédent">‹</button><b style="text-transform:capitalize;min-width:140px;text-align:center">${esc(label)}</b><button class="ib" data-act="month" data-v="1" aria-label="Mois suivant">›</button>`)}<div class="card flush"><div class="mgrid">${["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((x) => `<div class="mhead">${x}</div>`).join("")}${cells.join("")}</div></div>`;
    },
    waitlist: () => {
      const joined = S.myPos > 0;
      return `<div class="wl-hero"><div class="blob b1"></div><div class="blob b2"></div><span class="tag">Bientôt disponible</span><h1 class="hero-t">${esc(D.name)}</h1><p class="mut hero-s">${esc(D.description)}</p>${joined
        ? `<div class="card wl-ok"><div class="sent">🎉</div><b>Tu es inscrit·e !</b><p class="mut">Ta place dans la file : <b class="big" style="font-size:34px;display:block">n°${S.myPos.toLocaleString("fr-FR")}</b></p><p class="mut sm">Invite des amis pour remonter dans la file :</p><div class="row center"><input readonly value="${esc(D.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"))}.fr/?ref=${S.myPos}" style="max-width:280px"><button class="b primary" data-act="toast" data-v="Lien copié (simulation)">Copier</button></div></div>`
        : `<form class="wl-form" data-form="waitlist"><input type="email" required placeholder="ton@email.fr" aria-label="Ton email"><button class="b primary lg">Rejoindre la liste</button></form><p class="mut sm"><b data-count="${S.signups}">0</b> personnes déjà inscrites</p>`}</div>`;
    },
    objectifs: () => `${head(page().titre, "Fixe un montant, ajoute au fil de l'eau.", `<button class="b primary" data-act="goal">+ Objectif</button>`)}<div class="gridc">${S.goals.map((g: any, i: number) => { const pct = Math.min(100, Math.round((g.actuel / g.cible) * 100)); return `<div class="card goal rowin${pct >= 100 ? " reached" : ""}" style="--i:${i}"><div class="row between"><b>${esc(g.nom)}</b>${pct >= 100 ? `<span class="bdg ok">Atteint</span>` : `<span class="mut sm">${pct} %</span>`}</div><div class="big">${money(g.actuel)}<span class="mut sm"> / ${money(g.cible)}</span></div><div class="gbar"><i style="width:${pct}%"></i></div><div class="row"><button class="b sm" data-act="addgoal" data-v="${i}" data-n="10">+ 10 €</button><button class="b sm" data-act="addgoal" data-v="${i}" data-n="50">+ 50 €</button></div></div>`; }).join("")}</div>`,
    relances: () => {
      const col = D.entity.champs.length - 1;
      const rows = S.rows.filter((r: any) => !POS.test(r.v[D.status]));
      return `${head(page().titre, `${rows.filter((r: any) => !S.doneRel.includes(r.id)).length} à faire aujourd'hui`)}${rows.length ? `<div class="stack">${rows.map((r: any, k: number) => { const done = S.doneRel.includes(r.id); return `<div class="card li rowin${done ? " read" : ""}" style="--i:${k};cursor:default"><input type="checkbox" data-act="rel" data-v="${r.id}"${done ? " checked" : ""} aria-label="Fait"><span class="grow"><b style="${done ? "text-decoration:line-through" : ""}">${esc(r.v[0])}</b><span class="mut sm">${esc(r.v[1])} · ${badge(r.v[D.status])}</span></span><span class="mut sm">${esc(r.v[col])}</span><button class="b sm" data-act="toast" data-v="Relance reportée à demain">Reporter</button></div>`; }).join("")}</div>` : empty("Aucune relance", "Tout le monde est à jour.")}`;
    },
    timeline: () => `${head(page().titre, "Les étapes clés et leur avancement.")}<div class="card tlv">${S.rows.map((r: any, k: number) => { const pct = Math.min(100, parseInt(r.v[D.status], 10) || 0); return `<div class="tlv-item rowin" style="--i:${k}"><span class="tlv-dot${pct >= 100 ? " ok" : ""}"></span><div class="grow"><div class="row between"><b>${esc(r.v[0])}</b><span class="mut sm">${esc(r.v[2])}</span></div><span class="mut sm">${esc(r.v[1])}</span><div class="gbar"><i style="width:${pct}%"></i></div></div><b class="sm">${pct} %</b></div>`; }).join("")}</div>`,
    certificat: () => {
      const done = S.lessons.filter(Boolean).length, total = S.lessons.length;
      if (done < total) return `${head(page().titre)}<div class="card cert-lock"><div class="ring" style="--v:${Math.round((done / total) * 100)}"><span>${done}/${total}</span></div><b>Termine toutes les leçons pour obtenir ton certificat</b><p class="mut sm">Il te reste ${total - done} leçon${total - done > 1 ? "s" : ""}.</p><button class="b primary" data-act="go" data-v="${(D.pages.find((p) => p.kind === "cours") || D.pages[0]).id}">Continuer</button></div>`;
      return `${head(page().titre)}<div class="cert rowin"><span class="xs" style="letter-spacing:.2em;text-transform:uppercase">Certificat de réussite</span><h2>${esc(S.user.nom)}</h2><p>a terminé la formation <b>${esc(D.name)}</b></p><p class="mut sm">${new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</p><div class="mark" style="width:56px;height:56px;margin:8px auto 0">${D.logo ? `<img src="${esc(D.logo)}" alt="">` : esc(D.initials)}</div></div><div class="row center" style="margin-top:14px"><button class="b primary" data-act="toast" data-v="Certificat d'exemple : rien à télécharger dans le prototype">Télécharger</button></div>`;
    },
    conversation: () => `${head(page().titre, "Réponses simulées dans le prototype.")}<div class="card chat"><div class="chat-list">${S.msgs.map((m: any, k: number) => `<div class="msg ${m.me ? "mine" : ""} rowin" style="--i:${k}"><div class="bubble">${esc(m.t)}</div><span class="mut xs">${esc(m.at)}</span></div>`).join("")}</div><form class="chat-form" data-form="msg"><input name="t" required placeholder="Écris un message…" autocomplete="off" aria-label="Message"><button class="b primary">Envoyer</button></form></div>`,
    resultats: () => {
      const counts = D.statuses.map((s) => ({ s, n: S.rows.filter((r: any) => r.v[D.status] === s).length }));
      const total = Math.max(1, counts.reduce((a, c) => a + c.n, 0));
      return `${head(page().titre, `${S.rows.length} réponses`)}<div class="card"><b>Répartition des réponses</b><div class="stack" style="margin-top:14px">${counts.map((c, i) => `<div class="res rowin" style="--i:${i}"><div class="row between"><span>${esc(c.s)}</span><b>${Math.round((c.n / total) * 100)} % <span class="mut sm">(${c.n})</span></b></div><div class="gbar big-bar"><i style="width:${(c.n / total) * 100}%"></i></div></div>`).join("")}</div></div>${kpis()}`;
    },
    carte: () => `${head(page().titre, "Clique sur un repère.")}<div class="card flush map-wrap"><svg class="map" viewBox="0 0 600 360" aria-hidden="true"><rect width="600" height="360" class="map-bg"/><path class="map-river" d="M-10 250 C 120 200, 200 300, 320 230 S 520 120, 620 160"/>${Array.from({ length: 9 }, (_, i) => `<line x1="${i * 75}" y1="0" x2="${i * 75}" y2="360" class="map-grid"/>`).join("")}${Array.from({ length: 6 }, (_, i) => `<line x1="0" y1="${i * 72}" x2="600" y2="${i * 72}" class="map-grid"/>`).join("")}</svg>${S.rows.map((r: any, k: number) => { rnd = r.id * 7919; const x = 10 + rand() * 80, y = 12 + rand() * 72; return `<button class="pin rowin" style="left:${x}%;top:${y}%;--i:${k}" data-act="open" data-id="${r.id}" aria-label="${esc(r.v[0])}"><span>${esc(r.v[0])}</span></button>`; }).join("")}</div>`,
    editeur: () => {
      const r = S.rows[0] || { v: D.entity.champs.map(() => "") };
      return `${head(page().titre, "Le document se met à jour pendant que tu tapes.", `<button class="b primary" data-act="toast" data-v="Document généré (exemple)">Générer</button>`)}<div class="split"><div class="card form">${D.entity.champs.map((c, i) => `<label>${esc(c)}<input data-live="${i}" value="${esc(r.v[i])}"></label>`).join("")}</div><div class="paper"><div class="paper-h">${logo(34)}<b>${esc(D.name)}</b></div><h2 data-out="0">${esc(r.v[0])}</h2>${D.entity.champs.slice(1).map((c, i) => `<p><span class="mut">${esc(c)} :</span> <b data-out="${i + 1}">${esc(r.v[i + 1])}</b></p>`).join("")}<div class="paper-f mut xs">Document d'exemple généré à partir d'un modèle</div></div></div>`;
    },
  };

  function fields() {
    return D.entity.champs.map((c, i) => `<label>${esc(c)}${i === D.status ? `<select name="f${i}">${D.statuses.map((s) => `<option>${esc(s)}</option>`).join("")}</select>` : `<input name="f${i}" required placeholder="${esc(c)}">`}</label>`).join("");
  }
  const logo = (s: number) => `<span class="mark" style="width:${s}px;height:${s}px">${D.logo ? `<img src="${esc(D.logo)}" alt="">` : esc(D.initials)}</span>`;

  // ─── Coquille ───
  // Champ secondaire affiché sur les cartes : ni le titre, ni le sous-titre, ni le statut.
  const extra = D.entity.champs.findIndex((_, i) => i > 1 && i !== D.status);
  const cartCount = () => Object.values(S.cart as Record<string, number>).reduce((a, b) => a + b, 0);
  const nav = D.pages.filter((p) => p.nav);
  const unread = () => S.notifs.filter((n: any) => !n.read).length;
  function shell() {
    if (AR) { AR.shell(); return; }
    document.body.className = "";
    document.body.innerHTML = `<aside class="side"><div class="brand">${logo(32)}<b>${esc(D.name)}</b></div><nav>${nav.map((p) => `<a data-act="go" data-v="${p.id}" data-t="${esc(p.titre)}" class="${p.id === S.page ? "on" : ""}">${icon(p.kind)}<span>${esc(p.titre)}</span>${p.kind === "notifications" && unread() ? `<em>${unread()}</em>` : ""}${p.kind === "panier" && cartCount() ? `<em>${cartCount()}</em>` : ""}</a>`).join("")}</nav><div class="side-f">${S.logged && D.mods.auth ? `<button class="me" data-act="go" data-v="${D.mods.profil ? "profil" : S.page}">${avatar(S.user.nom, 30)}<span><b>${esc(S.user.nom)}</b><span class="mut xs">${esc(S.user.role)}</span></span></button>` : ""}</div></aside>
<div class="wrap"><header class="top">${D.mods.recherche ? `<label class="search">${icon("search", 16)}<input data-in="q" placeholder="Rechercher…" value="${esc(S.q)}"></label>` : `<span></span>`}<div class="row">${D.mods.notifications ? `<button class="ib" data-act="go" data-v="notifications" aria-label="Notifications">${icon("notifications")}${unread() ? `<em class="pip">${unread()}</em>` : ""}</button>` : ""}<button class="ib" data-act="dark" aria-label="Mode sombre">${icon("moon")}</button>${D.mods.auth ? (S.logged ? avatar(S.user.nom, 32) : `<button class="b primary sm" data-act="go" data-v="connexion">Se connecter</button>`) : ""}</div></header><main id="m"></main></div>
<div id="toasts"></div>${badgeProto()}`;
  }
  function badgeProto() {
    return `<div class="badge-proto${mode === "none" ? "" : " saved"}" title="${mode === "none" ? "Rien n'est enregistré : c'est un aperçu" : "Ajouts, modifications et suppressions sont gardés après rechargement"}">${mode === "none" ? "Prototype · données d'exemple" : mode === "local" ? "● Données enregistrées sur cet appareil" : "● Données enregistrées dans ton projet"}</div>`;
  }

  function render(anim = true) {
    const pg = page();
    const m = document.getElementById("m");
    if (!m) return;
    m.innerHTML = `<div class="${anim && !reduced ? "enter" : ""}">${(P[pg.kind] || P.accueil)()}</div>`;
    document.querySelectorAll(".side a").forEach((a: any) => a.classList.toggle("on", a.dataset.v === pg.id));
    countUp(m);
  }
  function countUp(root: HTMLElement) {
    root.querySelectorAll("[data-count]").forEach((el: any) => {
      const to = Number(el.dataset.count);
      const dec = to % 1 ? 1 : 0;
      if (reduced) { el.textContent = to.toLocaleString("fr-FR", { maximumFractionDigits: dec }); return; }
      const t0 = performance.now();
      const step = (t: number) => {
        const k = Math.min(1, (t - t0) / 900);
        el.textContent = (to * (1 - Math.pow(1 - k, 3))).toLocaleString("fr-FR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }
  function go(id: string, back = false) {
    if (!D.pages.some((p) => p.id === id)) return;
    if (!back && id !== S.page) S.prev.push(S.page);
    S.page = id; S.q = ""; S.chip = "";
    shell(); render();
    window.scrollTo(0, 0);
    if (parent !== window) parent.postMessage({ decollagePage: id }, "*");
  }
  function toast(t: string, kind = "ok") {
    const el = document.createElement("div");
    el.className = `toast ${kind}`;
    el.innerHTML = `<span>${kind === "ok" ? "✓" : "!"}</span>${esc(t)}`;
    document.getElementById("toasts")!.appendChild(el);
    setTimeout(() => el.classList.add("out"), 2200);
    setTimeout(() => el.remove(), 2600);
  }
  function modal(title: string, body: string, cta: string, onOk: (f: FormData) => void, danger = false) {
    const wrap = document.createElement("div");
    wrap.className = "modal-bg";
    wrap.innerHTML = `<form class="modal"><div class="row between"><h2>${esc(title)}</h2><button type="button" class="ib" data-x aria-label="Fermer">✕</button></div>${body}<div class="row r"><button type="button" class="b" data-x>Annuler</button><button class="b ${danger ? "danger" : "primary"}">${esc(cta)}</button></div></form>`;
    document.body.appendChild(wrap);
    const close = () => { wrap.classList.add("out"); setTimeout(() => wrap.remove(), 200); };
    wrap.addEventListener("click", (e: any) => { if (e.target === wrap || e.target.closest("[data-x]")) close(); });
    wrap.querySelector("form")!.addEventListener("submit", (e) => { e.preventDefault(); onOk(new FormData(e.target as HTMLFormElement)); close(); });
    (wrap.querySelector("input, select, button.primary, button.danger") as HTMLElement)?.focus();
  }
  function addRow(v: string[]) {
    const r = { id: S.next++, v, fav: false, fresh: true };
    S.rows.unshift(r);
    log(`${D.entity.nom} ajouté : ${v[0]}`);
    S.notifs.unshift({ t: `Nouveau : ${v[0]}`, read: false });
    return r;
  }
  function confetti() {
    if (reduced) return;
    for (let i = 0; i < 40; i++) {
      const c = document.createElement("i");
      c.className = "conf";
      c.style.cssText = `left:${50 + (Math.random() - 0.5) * 30}%;--x:${(Math.random() - 0.5) * 500}px;--r:${Math.random() * 720}deg;background:${i % 2 ? "var(--p)" : "var(--a)"};animation-delay:${Math.random() * 0.15}s`;
      document.body.appendChild(c);
      setTimeout(() => c.remove(), 1400);
    }
  }

  // ─── Interactions ───
  document.addEventListener("click", (e: any) => {
    queueSave();
    const t = e.target.closest("[data-act]");
    if (!t || t.tagName === "INPUT") return;
    const act = t.dataset.act, v = t.dataset.v, id = Number(t.dataset.id);
    if (act !== "open" || !e.target.closest("[data-act=fav],[data-act=del]")) e.preventDefault();
    if (act === "fav" || act === "del") e.stopPropagation();
    if (AR && AR.click(act, t)) return;
    const r = S.rows.find((x: any) => x.id === id);
    switch (act) {
      case "go": go(v); break;
      case "back": go(S.prev.pop() || D.start, true); break;
      case "open": if (e.target.closest("[data-act=fav],[data-act=del]")) return; S.sel = id; if (D.pages.some((p) => p.id === "detail")) go("detail"); else toast(`${r ? r.v[0] : ""} : active la brique « Pages de détail » pour ouvrir une fiche`); break;
      case "fav": r.fav = !r.fav; log(`${r.fav ? "Ajouté aux" : "Retiré des"} favoris : ${r.v[0]}`); render(false); toast(r.fav ? "Ajouté aux favoris" : "Retiré des favoris"); break;
      case "del": modal("Supprimer ?", `<p class="mut">« ${esc(r.v[0])} » sera supprimé du prototype.</p>`, "Supprimer", () => { S.rows = S.rows.filter((x: any) => x.id !== id); log(`Supprimé : ${r.v[0]}`); toast("Supprimé"); if (S.page === "detail") go(S.prev.pop() || D.start, true); else render(false); }, true); break;
      case "add": if (D.pages.some((p) => p.id === "nouveau")) go("nouveau"); else modal(`Ajouter : ${D.entity.nom.toLowerCase()}`, `<div class="form">${fields()}</div>`, "Ajouter", (f) => { addRow(D.entity.champs.map((_, i) => String(f.get(`f${i}`) || ""))); render(false); toast(`${D.entity.nom} ajouté`); }); break;
      case "csv": {
        const sep = (D.reglages["csv.separateur"] || "").startsWith("Virgule") ? "," : ";";
        const csv = [D.entity.champs, ...S.rows.map((x: any) => x.v)].map((l: string[]) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(sep)).join("\n");
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv" }));
        a.download = `${D.entity.pluriel.toLowerCase()}.csv`;
        a.click();
        log("Export CSV"); toast("Export CSV téléchargé"); break;
      }
      case "chip": S.chip = v; render(false); break;
      case "sort": S.dir = S.sort === Number(v) ? -S.dir : 1; S.sort = Number(v); render(false); break;
      case "book": modal(`Réserver ${v}`, `<div class="form"><label>Nom<input name="n" required placeholder="Ton nom"></label><label>${esc(D.entity.champs[2] || "Détail")}<input name="d" value="${esc((S.rows[0] && S.rows[0].v[2]) || "")}"></label></div>`, "Confirmer", (f) => { const st = D.statuses.find((s) => POS.test(s)) || D.statuses[0]; const vals = D.entity.champs.map((_, i) => (i === 0 ? String(f.get("n")) : i === 1 ? v : i === D.status ? st : String(f.get("d")))); addRow(vals); render(false); toast("Créneau réservé"); confetti(); }); break;
      case "annual": S.annual = v === "1"; render(false); break;
      case "plan": modal(`Offre ${v}`, `<p class="mut">Dans le prototype, aucun paiement n'est effectué. Dans la vraie application, cette étape ouvrirait le paiement sécurisé.</p>`, "Simuler l'abonnement", () => { log(`Offre choisie : ${v}`); toast(`Offre ${v} activée (simulation)`); confetti(); }); break;
      case "toast": toast(v); break;
      case "confirm": modal(v, `<p class="mut">Simulation : rien n'est supprimé.</p>`, "Confirmer", () => toast("Action simulée"), true); break;
      case "user": { const u = S.users[Number(v)]; u.actif = !u.actif; log(`${u.nom} ${u.actif ? "réactivé" : "suspendu"}`); render(false); toast(u.actif ? "Utilisateur réactivé" : "Utilisateur suspendu"); break; }
      case "range": S.range = Number(v); render(false); break;
      case "read": S.notifs[Number(v)].read = true; shell(); render(false); break;
      case "readall": S.notifs.forEach((n: any) => (n.read = true)); shell(); render(false); toast("Tout est lu"); break;
      case "dark": S.dark = !S.dark; document.documentElement.classList.toggle("dark", S.dark); if (S.page === "parametres") render(false); break;
      case "play": t.classList.add("playing"); break;
      case "cart": S.cart[id] = (S.cart[id] || 0) + 1; log(`Ajouté au panier : ${r.v[0]}`); shell(); render(false); toast("Ajouté au panier"); break;
      case "qty": S.cart[id] = Math.max(0, (S.cart[id] || 0) + Number(v)); shell(); render(false); break;
      case "checkout": modal("Valider la commande", `<p class="mut">Dans le prototype, aucun paiement n'est effectué. Dans la vraie boutique, cette étape ouvrirait le paiement sécurisé.</p>`, "Simuler la commande", () => { const n = cartCount(); S.cart = {}; log(`Commande passée (${n} article${n > 1 ? "s" : ""})`); S.notifs.unshift({ t: "Commande confirmée", read: false }); shell(); render(false); toast("Commande confirmée (simulation)"); confetti(); }); break;
      case "month": { const d = S.month as Date; S.month = new Date(d.getFullYear(), d.getMonth() + Number(v), 1); render(false); break; }
      case "bookday": modal(`Ajouter le ${v}`, `<div class="form"><label>${esc(D.entity.champs[0])}<input name="n" required placeholder="${esc(D.entity.champs[0])}"></label></div>`, "Ajouter", (f) => { const st = D.statuses.find((s) => POS.test(s)) || D.statuses[0]; const vals = D.entity.champs.map((c, i) => (i === 0 ? String(f.get("n")) : i === D.status ? st : (S.rows[0] && S.rows[0].v[i]) || "")); const nr = addRow(vals); (nr as any).day = Number(v); render(false); toast("Ajouté au calendrier"); }); break;
      case "goal": modal("Nouvel objectif", `<div class="form"><label>Nom<input name="n" required placeholder="Ex. : Permis de conduire"></label><label>Montant visé (€)<input name="c" type="number" min="1" required value="500"></label></div>`, "Créer", (f) => { S.goals.push({ nom: String(f.get("n")), cible: Math.max(1, Number(f.get("c"))), actuel: 0 }); log(`Objectif créé : ${f.get("n")}`); render(false); toast("Objectif créé"); }); break;
      case "csvimport": importCsv(); break;
      case "reset": modal("Revenir aux données d'exemple ?", `<p class="mut">Tes ${esc(D.entity.pluriel.toLowerCase())} seront remplacés par les données d'exemple. Exporte-les d'abord en CSV si tu veux les garder.</p>`, "Réinitialiser", () => { resetData(); render(false); toast("Données d'exemple restaurées"); }, true); break;
      case "addgoal": { const g = S.goals[Number(v)]; const was = g.actuel >= g.cible; g.actuel += Number(t.dataset.n); render(false); if (!was && g.actuel >= g.cible) { toast(`Objectif « ${g.nom} » atteint !`); confetti(); } break; }
    }
  });
  document.addEventListener("change", (e: any) => {
    queueSave();
    const t = e.target;
    if (AR && AR.change(t)) return;
    if (t.dataset.act === "lesson") { S.lessons[Number(t.dataset.v)] = t.checked; if (t.checked) { log(`Leçon terminée : ${S.rows[Number(t.dataset.v)].v[0]}`); toast("Leçon terminée"); if (S.lessons.every(Boolean)) confetti(); } render(false); }
    if (t.dataset.act === "dark") { S.dark = t.checked; document.documentElement.classList.toggle("dark", S.dark); }
    if (t.dataset.act === "rel") { const rid = Number(t.dataset.v); S.doneRel = t.checked ? [...S.doneRel, rid] : S.doneRel.filter((x: number) => x !== rid); if (t.checked) toast("Relance faite"); render(false); }
    if (t.dataset.act === "notifs") { S.notifsOn = t.checked; toast(t.checked ? "Notifications activées" : "Notifications désactivées"); }
    if (t.dataset.edit) { const r = S.rows.find((x: any) => x.id === Number(t.dataset.id)); r.v[Number(t.dataset.edit)] = t.value; log(`${r.v[0]} modifié`); toast("Modification enregistrée"); }
  });
  document.addEventListener("input", (e: any) => {
    const t = e.target;
    if (AR && AR.input(t)) return;
    if (t.dataset.in === "q") { S.q = t.value; render(false); const i = document.querySelector("[data-in=q]") as HTMLInputElement; i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
    if (t.dataset.live) { const o = document.querySelector(`[data-out="${t.dataset.live}"]`); if (o) o.textContent = t.value; }
  });
  document.addEventListener("submit", (e: any) => {
    queueSave();
    const f = e.target.closest("[data-form]");
    if (!f) return;
    e.preventDefault();
    const fd = new FormData(f);
    if (AR && AR.submit(f, fd)) return;
    if (f.dataset.form === "add") { addRow(D.entity.champs.map((_, i) => String(fd.get(`f${i}`) || ""))); toast(`${D.entity.nom} ajouté`); const dp = dataPage(); go(dp ? dp.id : D.start); }
    if (f.dataset.form === "login") {
      const magic = D.reglages["auth.methode"] === "Lien magique par email";
      f.innerHTML = `<div class="sent">${magic ? "✉️" : "✓"}</div><p><b>${magic ? "Lien envoyé !" : "Connexion…"}</b></p>`;
      setTimeout(() => { S.logged = true; log("Connexion"); toast("Connecté·e"); go((D.pages.find((p) => p.nav && p.kind !== "accueil") || D.pages[0]).id); }, magic ? 1300 : 700);
    }
    if (f.dataset.form === "waitlist") { S.signups++; S.myPos = S.signups; log("Inscription à la liste d'attente"); render(false); confetti(); }
    if (f.dataset.form === "msg") {
      const txt = String(fd.get("t") || "").trim();
      if (!txt) return;
      const hh = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
      S.msgs.push({ me: true, t: txt, at: hh });
      render(false);
      setTimeout(() => { S.msgs.push({ me: false, t: "Merci pour ton message, on regarde ça ! (réponse simulée)", at: hh }); save(); if (S.page === page().id && page().kind === "conversation") render(false); }, 1100);
    }
    if (f.dataset.form === "profil") { S.user = { nom: String(fd.get("nom")), email: String(fd.get("email")), role: String(fd.get("role")) }; log("Profil mis à jour"); toast("Profil enregistré"); shell(); render(false); }
  });
  // Glisser-déposer du kanban
  document.addEventListener("dragstart", (e: any) => { const c = e.target.closest("[data-drag]"); if (c) { e.dataTransfer.setData("text/plain", c.dataset.drag); c.classList.add("dragging"); } });
  document.addEventListener("dragend", (e: any) => { const c = e.target.closest && e.target.closest("[data-drag]"); if (c) c.classList.remove("dragging"); });
  document.addEventListener("dragover", (e: any) => { const col = e.target.closest("[data-drop]"); if (col) { e.preventDefault(); document.querySelectorAll(".col").forEach((x) => x.classList.toggle("over", x === col)); } });
  document.addEventListener("drop", (e: any) => {
    const col = e.target.closest("[data-drop]");
    if (!col) return;
    e.preventDefault();
    const r = S.rows.find((x: any) => x.id === Number(e.dataTransfer.getData("text/plain")));
    queueSave();
    if (r && r.v[D.status] !== col.dataset.drop) { r.v[D.status] = col.dataset.drop; log(`${r.v[0]} → ${col.dataset.drop}`); toast(`Déplacé vers « ${col.dataset.drop} »`); if (POS.test(col.dataset.drop)) confetti(); }
    render(false);
  });
  window.addEventListener("message", (e) => {
    if (e.data && typeof e.data.go === "string") go(e.data.go);
    // Réponse de la page parente : les données enregistrées dans le projet.
    if (mode === "parent" && e.source === parent && e.data && e.data.key === D.storeKey && "decollageLoad" in e.data) {
      if (e.data.decollageLoad) restore(e.data.decollageLoad);
      shell(); render(false);
      document.documentElement.style.visibility = "";
    }
  });

  // Architecture de l'application : ses écrans remplacent ou complètent les pages standard.
  AR = D.arch && archModule ? archModule({ D, S, esc, icon, badge, avatar, toast, modal, go, render, save, addRow, POS, money, logo, empty, P, fields, log, badgeProto }) : null;
  if (AR) Object.assign(P, AR.pages);

  if (mode === "local") {
    let raw: any = null;
    try { raw = JSON.parse(localStorage.getItem(KEY) || "null"); } catch { raw = null; }
    if (!restore(raw) && D.initial) restore(D.initial);
  } else if (D.initial) restore(D.initial);
  shell();
  render();
  if (mode === "parent") {
    // On attend les données du projet (courte attente) pour ne pas afficher l'exemple puis le remplacer.
    document.documentElement.style.visibility = "hidden";
    setTimeout(() => { document.documentElement.style.visibility = ""; }, 600);
    parent.postMessage({ decollageHello: true, key: D.storeKey }, "*");
  }
  if (parent !== window) parent.postMessage({ decollagePage: S.page }, "*");
}
