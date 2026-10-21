/* eslint-disable @typescript-eslint/no-explicit-any */
// Architectures des prototypes : site public + espace utilisateur propre à chaque famille de SaaS
// (espace de travail, finance, formation, relation client, création, e-commerce).
// Comme proto-runtime.ts, ce module est injecté tel quel (Function.prototype.toString) :
// il ne doit dépendre d'AUCUNE variable extérieure. Il reçoit tout ce qu'il utilise dans `X`.

export function protoArch(X: any) {
  const { D, S, esc, icon, badge, avatar, toast, modal, go, render, save, addRow, POS, money, logo, empty, P } = X;
  const A = D.arch;
  const R = A.roles;
  const E = D.entity;
  const st = D.status;
  const v = (r: any, k: string) => (typeof R[k] === "number" ? r.v[R[k]] || "" : "");

  // ─── Lecture des données ───
  const amount = (s: string) => {
    const m = String(s).replace(/\s/g, "").replace("−", "-").replace(",", ".").match(/^([+-]?)(\d+(?:\.\d+)?)€?$/);
    return m ? (m[1] === "-" ? -Number(m[2]) : Number(m[2])) : null;
  };
  const MOIS = ["janv", "févr", "mars", "avr", "mai", "juin", "juil", "août", "sept", "oct", "nov", "déc"];
  const JOURS = ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  /** « 2 mai », « 1er juil. », « Demain », « Lundi »… → date (année en cours), sinon null. */
  function date(s: string): Date | null {
    const t = String(s).toLowerCase().trim();
    if (!t || t === "—") return null;
    if (/aujourd/.test(t)) return new Date(today);
    if (/demain/.test(t)) return new Date(today.getTime() + 86400000);
    if (/hier/.test(t)) return new Date(today.getTime() - 86400000);
    const m = t.match(/(\d{1,2})(?:er)?\s+([a-zéû]+)/);
    if (m) { const mo = MOIS.findIndex((x) => m[2]!.startsWith(x.slice(0, 3))); if (mo >= 0) return new Date(today.getFullYear(), mo, Number(m[1])); }
    const j = JOURS.findIndex((x) => t.startsWith(x));
    if (j >= 0) { const d = new Date(today); d.setDate(d.getDate() + ((j - d.getDay() + 7) % 7 || 7)); return d; }
    return null;
  }
  const fmtDate = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  const doneStatus = () => D.statuses.find((x: string) => POS.test(x)) || D.statuses[D.statuses.length - 1];
  const isDone = (r: any) => POS.test(r.v[st] || "") || /termin|livr|résolu/i.test(r.v[st] || "");
  const sel = () => S.rows.find((r: any) => r.id === S.sel) || S.rows[0];
  const note = (r: any) => (r && S.notes[r.id]) || "";
  const words = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0);
  const groupsOf = (k: string) => { const out: string[] = []; for (const r of S.rows) { const g = v(r, k); if (g && !out.includes(g)) out.push(g); } return out; };
  const addBtn = (label = E.nom) => `<button class="b primary" data-act="arch-add">${icon("plus", 16)} ${esc(label)}</button>`;
  const fieldInputs = (r: any) => E.champs.map((c: string, i: number) => `<label class="kv"><span class="mut sm">${esc(c)}</span>${i === st ? `<select data-edit="${i}" data-id="${r.id}">${D.statuses.map((x: string) => `<option${x === r.v[i] ? " selected" : ""}>${esc(x)}</option>`).join("")}</select>` : `<input data-edit="${i}" data-id="${r.id}" value="${esc(r.v[i])}">`}</label>`).join("");
  const appNav = () => D.pages.filter((p: any) => !String(p.kind).startsWith("site-"));
  const siteNav = () => D.pages.filter((p: any) => String(p.kind).startsWith("site-"));
  const findPage = (view: string) => D.pages.find((p: any) => p.kind === view);
  const ICON_OF: Record<string, string> = { "ws-list": "liste", "ws-board": "kanban", "ws-timeline": "calendrier", "fi-overview": "dashboard", "fi-ledger": "tableau", "fi-analysis": "graphique", "fi-goals": "objectifs", "le-courses": "grille", "le-player": "cours", "le-cards": "detail", "le-progress": "resultats", "crm-split": "profil", "crm-pipeline": "kanban", "crm-followup": "relances", "st-library": "grille", "st-editor": "editeur", "co-products": "grille", "co-orders": "facturation", "co-sales": "graphique", settings: "parametres" };

  // ─── Site public ───
  const appEntry = () => (A.accounts && !S.logged ? "connexion" : "app");
  function siteShell() {
    const cur = S.page;
    document.body.className = "mode-site";
    document.body.innerHTML = `<header class="site-h"><a class="brand" data-act="go" data-v="accueil">${logo(30)}<b>${esc(D.name)}</b></a><nav>${siteNav().filter((p: any) => !["site-login", "site-signup"].includes(p.kind)).map((p: any) => `<a data-act="go" data-v="${p.id}" class="${p.id === cur ? "on" : ""}">${esc(p.titre)}</a>`).join("")}</nav><div class="row">${A.accounts ? (S.logged ? `<button class="b primary sm" data-act="go" data-v="app">Mon espace →</button>` : `<button class="b sm ghost-l" data-act="go" data-v="connexion">Connexion</button><button class="b primary sm" data-act="go" data-v="inscription">Essai gratuit</button>`) : `<button class="b primary sm" data-act="go" data-v="app">Ouvrir l'application →</button>`}</div></header>
<main id="m" class="site-main"></main>
<footer class="site-f"><div><b>${esc(D.name)}</b><p class="mut sm">${esc(D.cible || "")}</p></div><div class="row">${siteNav().map((p: any) => `<a data-act="go" data-v="${p.id}">${esc(p.titre)}</a>`).join("")}</div></footer>
<div id="toasts"></div>${X.badgeProto()}`;
  }
  /** Aperçu de l'application affiché sur l'accueil : quelques vraies lignes, dans le cadre de l'architecture. */
  const mock = () => `<div class="mock-app frame-${A.frame}"><div class="mock-bar"><i></i><i></i><i></i><span>${esc(D.name)}</span></div><div class="mock-body"><div class="mock-nav">${appNav().slice(0, 4).map((p: any, i: number) => `<span class="${i ? "" : "on"}">${esc(p.titre)}</span>`).join("")}</div><div class="mock-rows">${S.rows.slice(0, 4).map((r: any) => `<div><b>${esc(r.v[R.titre] || r.v[0])}</b>${badge(r.v[st])}</div>`).join("")}</div></div></div>`;
  const feats = () => D.features.map(([a, b]: [string, string], i: number) => `<div class="hf rowin" style="--i:${i}"><span class="hf-n">${String(i + 1).padStart(2, "0")}</span><b>${esc(a)}</b><p class="mut">${esc(b)}</p></div>`).join("");
  const cta = () => `<button class="b primary lg" data-act="go" data-v="${A.accounts ? "inscription" : "app"}">${A.accounts ? "Créer mon compte" : "Commencer"} →</button><button class="b lg" data-act="go" data-v="fonctionnalites">Voir les fonctionnalités</button>`;
  function home() {
    const L = A.home;
    const title = esc(D.heroTitre || D.name);
    if (L === "editorial") return `<section class="h-ed"><span class="tag">${esc(D.cible)}</span><h1>${title}</h1><div class="h-ed-cols"><p class="lead">${esc(D.description)}</p><div class="row">${cta()}</div></div></section><section class="h-ed-list">${feats()}</section><section class="h-quote"><p>« ${esc(D.features[0] ? D.features[0][1] : D.description)} »</p></section>`;
    if (L === "bento") return `<section class="h-bento"><div class="hb-main"><span class="tag">${esc(D.cible)}</span><h1>${title}</h1><p class="lead">${esc(D.description)}</p><div class="row">${cta()}</div></div>${D.features.slice(0, 3).map(([a, b]: [string, string], i: number) => `<div class="hb-tile t${i}"><b>${esc(a)}</b><p>${esc(b)}</p></div>`).join("")}<div class="hb-tile t-app">${mock()}</div><div class="hb-tile t-num"><span class="big">${S.rows.length}</span><span>${esc(E.pluriel.toLowerCase())} d'exemple déjà prêts</span></div></section>`;
    if (L === "asym") return `<section class="h-asym"><h1><span>${title}</span></h1><div class="h-asym-side"><p class="lead">${esc(D.description)}</p><div class="row">${cta()}</div></div><div class="h-asym-mock">${mock()}</div></section><section class="h-asym-feats">${feats()}</section>`;
    if (L === "terminal") return `<section class="h-term"><div class="term-win"><div class="term-h"><i></i><i></i><i></i></div><p><span class="mut">$</span> ${esc(D.name.toLowerCase().replace(/\s+/g, "-"))} --demarrer</p><h1>${title}</h1><p class="mut">${esc(D.description)}</p>${D.features.map(([a]: [string]) => `<p><span class="ok">✓</span> ${esc(a)}</p>`).join("")}<div class="row" style="margin-top:18px">${cta()}</div></div></section>`;
    if (L === "split") return `<section class="h-split"><div><span class="tag">${esc(D.cible)}</span><h1>${title}</h1><p class="lead">${esc(D.description)}</p><div class="row">${cta()}</div></div>${mock()}</section><section class="h-grid">${feats()}</section>`;
    return `<section class="h-centre"><span class="tag">${esc(D.cible)}</span><h1>${title}</h1><p class="lead">${esc(D.description)}</p><div class="row center">${cta()}</div>${mock()}</section><section class="h-grid">${feats()}</section>`;
  }
  function features() {
    return `<section class="site-sec"><span class="tag">Fonctionnalités</span><h1>Tout ce que fait ${esc(D.name)}</h1><div class="h-grid">${feats()}</div></section><section class="site-sec alt"><h2>Dans l'application</h2><div class="scr-list">${appNav().map((p: any, i: number) => `<div class="scr rowin" style="--i:${i}"><span class="feat-ic">${icon(ICON_OF[p.kind] || "liste", 20)}</span><b>${esc(p.titre)}</b></div>`).join("")}</div><div class="row" style="margin-top:22px">${cta()}</div></section>`;
  }
  function auth(signup: boolean) {
    return `<section class="site-auth"><div class="card auth-c"><div class="logo-l">${logo(44)}</div><h1>${signup ? "Créer un compte" : "Connexion"}</h1><form class="form" data-form="arch-login">${signup ? `<label>Nom<input name="nom" required placeholder="Ton nom"></label>` : ""}<label>Email<input type="email" name="email" required placeholder="toi@exemple.fr"></label><label>Mot de passe<input type="password" name="mdp" required minlength="4" placeholder="••••••••"></label><button class="b primary lg">${signup ? "Créer mon compte" : "Se connecter"}</button></form><p class="mut sm">${signup ? `Déjà inscrit ? <a data-act="go" data-v="connexion">Connexion</a>` : `Pas encore de compte ? <a data-act="go" data-v="inscription">Inscription</a>`}</p><p class="mut xs">Aperçu : connexion simulée, aucun compte n'est créé.</p></div></section>`;
  }

  // ─── Cadres de l'espace utilisateur ───
  function appShell() {
    const cur = S.page;
    const nav = appNav();
    const tabs = (cls: string) => `<nav class="${cls}">${nav.map((p: any) => `<a data-act="go" data-v="${p.id}" class="${p.id === cur ? "on" : ""}" data-t="${esc(p.titre)}">${icon(ICON_OF[p.kind] || "liste", 18)}<span>${esc(p.titre)}</span></a>`).join("")}</nav>`;
    const me = `<button class="me-c" data-act="go" data-v="${(findPage("settings") || nav[0]).id}" title="Paramètres">${avatar(S.user.nom, 30)}</button>`;
    const out = `<button class="b sm" data-act="go" data-v="accueil" title="Retour au site">Site</button>`;
    const f = A.frame;
    document.body.className = `mode-app frame-${f}`;
    let html = "";
    if (f === "board") {
      const lists = [["all", "Toutes", S.rows.filter((r: any) => !isDone(r)).length], ["soon", "Bientôt", S.rows.filter((r: any) => { const d = date(v(r, "date")); return d && d.getTime() - today.getTime() < 7 * 86400000 && !isDone(r); }).length], ["done", "Terminées", S.rows.filter(isDone).length]];
      const gk = typeof R.groupe === "number" ? "groupe" : "personne";
      html = `<header class="app-top">${logo(28)}<b>${esc(D.name)}</b>${tabs("tabs-h")}<div class="row" style="margin-left:auto">${out}${me}</div></header><div class="board-wrap"><aside class="lists"><span class="mut xs up">Listes</span>${lists.map(([k, l, n]) => `<a data-act="arch-list" data-v="${k}" class="${S.list === k ? "on" : ""}">${esc(l)}<em>${n}</em></a>`).join("")}<span class="mut xs up">${esc(E.champs[R[gk]] || "Groupes")}</span>${groupsOf(gk).map((g) => `<a data-act="arch-list" data-v="g:${esc(g)}" class="${S.list === `g:${g}` ? "on" : ""}"><i class="dotc" style="--h:${(g.charCodeAt(0) * 47) % 360}"></i>${esc(g)}<em>${S.rows.filter((r: any) => v(r, gk) === g).length}</em></a>`).join("")}</aside><main id="m"></main>${S.drawer ? drawer() : ""}</div>`;
    } else if (f === "ledger") {
      html = `<header class="ledger-h"><div class="row">${logo(30)}<b>${esc(D.name)}</b></div>${tabs("tabs-u")}<div class="row"><select data-act="arch-period" aria-label="Période">${[["tout", "Toute la période"], ["3m", "3 derniers mois"], ["1m", "Dernier mois"]].map(([k, l]) => `<option value="${k}"${S.period === k ? " selected" : ""}>${l}</option>`).join("")}</select>${out}${me}</div></header><main id="m" class="ledger-main"></main>`;
    } else if (f === "course") {
      html = `<header class="course-h"><div class="row">${logo(30)}<b>${esc(D.name)}</b></div>${tabs("tabs-c")}<div class="row">${out}${me}</div></header><main id="m" class="course-main"></main>`;
    } else if (f === "split") {
      html = `<aside class="rail-n">${logo(34)}${tabs("rail-links")}<div style="margin-top:auto">${me}</div></aside><div class="split-wrap"><header class="split-h"><b>${esc((nav.find((p: any) => p.id === cur) || nav[0]).titre)}</b><div class="row">${out}</div></header><main id="m" class="split-main"></main></div>`;
    } else if (f === "studio") {
      html = `<header class="studio-h">${logo(26)}<b>${esc(D.name)}</b>${tabs("tabs-s")}<div class="row" style="margin-left:auto">${out}${me}</div></header><main id="m" class="studio-main"></main>`;
    } else {
      html = `<header class="store-h"><div class="row">${logo(28)}<b>${esc(D.name)}</b><span class="mut sm">Administration</span></div><div class="row">${out}${me}</div></header>${tabs("store-sub")}<main id="m" class="store-main"></main>`;
    }
    document.body.innerHTML = `${html}<div id="toasts"></div>${X.badgeProto()}`;
  }
  function drawer() {
    const r = sel();
    if (!r) return "";
    return `<aside class="drawer"><div class="row between"><b>Détail</b><button class="ib" data-act="arch-drawer" aria-label="Fermer">✕</button></div><h2>${esc(r.v[R.titre])}</h2><div class="kvs1">${fieldInputs(r)}</div><label class="kv"><span class="mut sm">Notes</span><textarea data-note="${r.id}" rows="5" placeholder="Ajoute une note…">${esc(note(r))}</textarea></label><div class="row"><button class="b primary" data-act="arch-done" data-id="${r.id}">${isDone(r) ? "Rouvrir" : "Marquer terminé"}</button><button class="b danger" data-act="del" data-id="${r.id}">Supprimer</button></div></aside>`;
  }

  // ─── Écrans ───
  function wsList() {
    const gk = typeof R.groupe === "number" ? "groupe" : "personne";
    let rows = S.rows.slice();
    if (S.list === "all") rows = rows.filter((r: any) => !isDone(r));
    else if (S.list === "done") rows = rows.filter(isDone);
    else if (S.list === "soon") rows = rows.filter((r: any) => { const d = date(v(r, "date")); return d && d.getTime() - today.getTime() < 7 * 86400000 && !isDone(r); });
    else if (String(S.list).startsWith("g:")) rows = rows.filter((r: any) => v(r, gk) === S.list.slice(2));
    const q = S.q.trim().toLowerCase();
    if (q) rows = rows.filter((r: any) => r.v.join(" ").toLowerCase().includes(q));
    return `<div class="ws-head"><h1>${esc(page().titre)}</h1><div class="row"><label class="search">${icon("search", 16)}<input data-in="q" placeholder="Rechercher…" value="${esc(S.q)}"></label>${addBtn()}</div></div><form class="quick" data-form="arch-quick"><input name="t" required placeholder="+ Ajouter : ${esc(E.nom.toLowerCase())} (Entrée pour valider)" aria-label="Ajout rapide"></form>${rows.length ? `<div class="ws-rows">${rows.map((r: any, k: number) => `<div class="ws-row rowin${isDone(r) ? " done" : ""}${S.sel === r.id && S.drawer ? " on" : ""}" style="--i:${k}"><input type="checkbox" data-act="arch-check" data-id="${r.id}"${isDone(r) ? " checked" : ""} aria-label="Terminé"><button class="ws-t" data-act="arch-open" data-id="${r.id}">${esc(r.v[R.titre])}</button>${typeof R.progression === "number" ? `<span class="pbar"><i style="width:${parseInt(r.v[R.progression], 10) || 0}%"></i></span>` : ""}${v(r, gk) ? `<span class="chip-s">${esc(v(r, gk))}</span>` : ""}${v(r, "date") ? `<span class="mut sm">${esc(v(r, "date"))}</span>` : ""}${badge(r.v[st])}</div>`).join("")}</div>` : empty("Rien ici", "Change de liste ou ajoute un élément.")}`;
  }
  function wsTimeline() {
    const rows = S.rows.map((r: any) => ({ r, d: date(v(r, "date")) })).sort((a: any, b: any) => (a.d ? a.d.getTime() : 9e15) - (b.d ? b.d.getTime() : 9e15));
    const bucket = (d: Date | null) => (!d ? "Sans date" : d < today ? "En retard" : d.getTime() - today.getTime() < 7 * 86400000 ? "Cette semaine" : "Plus tard");
    const groups = ["En retard", "Cette semaine", "Plus tard", "Sans date"].map((b) => ({ b, list: rows.filter((x: any) => bucket(x.d) === b) })).filter((g) => g.list.length);
    return `<div class="ws-head"><h1>${esc(page().titre)}</h1>${addBtn()}</div>${groups.map((g) => `<section class="tl-group"><h3>${g.b} <span class="mut sm">${g.list.length}</span></h3>${g.list.map((x: any, k: number) => `<button class="tl-item rowin" style="--i:${k}" data-act="arch-open" data-id="${x.r.id}"><span class="tl-date">${x.d ? fmtDate(x.d) : "—"}</span><b>${esc(x.r.v[R.titre])}</b>${typeof R.progression === "number" ? `<span class="pbar"><i style="width:${parseInt(x.r.v[R.progression], 10) || 0}%"></i></span>` : ""}${badge(x.r.v[st])}</button>`).join("")}</section>`).join("")}`;
  }
  // Finance
  function tx() {
    const all = S.rows.map((r: any) => ({ r, a: amount(v(r, "montant")) || 0, d: date(v(r, "date")) }));
    if (S.period === "tout") return all;
    const max = Math.max(...all.map((x: any) => (x.d ? x.d.getTime() : 0)));
    const span = (S.period === "1m" ? 31 : 92) * 86400000;
    return all.filter((x: any) => x.d && max - x.d.getTime() <= span);
  }
  function lineChart(points: number[]) {
    if (points.length < 2) points = [0, ...points, ...(points.length ? [] : [0])];
    const W = 640, H = 200, min = Math.min(0, ...points), max = Math.max(1, ...points);
    const x = (i: number) => (i * W) / (points.length - 1), y = (n: number) => H - 14 - ((n - min) / (max - min || 1)) * (H - 28);
    const d = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(" ");
    return `<svg viewBox="0 0 ${W} ${H}" class="chart"><line x1="0" x2="${W}" y1="${y(0)}" y2="${y(0)}" class="axis"/><path class="area" d="${d} L${W},${y(0)} L0,${y(0)} Z" fill="color-mix(in srgb,var(--p) 14%,transparent)"/><path class="line" d="${d}" pathLength="1"/>${points.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p).toFixed(1)}" r="9" fill="transparent"><title>${money(p)}</title></circle>`).join("")}</svg>`;
  }
  function fiOverview() {
    const t = tx().slice().sort((a: any, b: any) => (a.d ? a.d.getTime() : 0) - (b.d ? b.d.getTime() : 0));
    const inc = t.filter((x: any) => x.a > 0).reduce((s: number, x: any) => s + x.a, 0);
    const exp = t.filter((x: any) => x.a < 0).reduce((s: number, x: any) => s + x.a, 0);
    let run = 0;
    const pts = t.map((x: any) => (run += x.a));
    const cats = groupsOf("groupe").map((g) => ({ g, n: t.filter((x: any) => v(x.r, "groupe") === g).reduce((s: number, x: any) => s + Math.abs(x.a), 0) })).filter((c) => c.n).sort((a, b) => b.n - a.n);
    const tot = Math.max(1, cats.reduce((s, c) => s + c.n, 0));
    return `<div class="fi-hero"><div><span class="mut sm">Solde de la période</span><div class="fi-big">${money(inc + exp)}</div></div><div class="fi-pair"><div><span class="mut sm">Entrées</span><b class="pos">${money(inc)}</b></div><div><span class="mut sm">Sorties</span><b class="neg">${money(-exp)}</b></div><div><span class="mut sm">${esc(E.pluriel)}</span><b>${t.length}</b></div></div></div><div class="split"><div class="card"><b>Évolution du solde</b>${lineChart(pts)}</div><div class="card"><b>Par ${esc((E.champs[R.groupe] || "catégorie").toLowerCase())}</b><div class="cat-bars">${cats.map((c, i) => `<div class="cat-b rowin" style="--i:${i}"><span>${esc(c.g)}</span><div class="gbar"><i style="width:${(c.n / tot) * 100}%"></i></div><b class="sm">${money(c.n)}</b></div>`).join("") || `<p class="mut sm">Aucune donnée sur la période.</p>`}</div></div></div>`;
  }
  function fiLedger() {
    const t = tx().slice().sort((a: any, b: any) => (b.d ? b.d.getTime() : 0) - (a.d ? a.d.getTime() : 0));
    const months: { k: string; list: any[] }[] = [];
    for (const x of t) { const k = x.d ? x.d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }) : "Sans date"; let m = months.find((y) => y.k === k); if (!m) months.push((m = { k, list: [] })); m.list.push(x); }
    return `<div class="ws-head"><h1>${esc(page().titre)}</h1><div class="row">${D.mods["export-csv"] ? `<button class="b" data-act="csv">${icon("download", 16)} CSV</button>` : ""}<button class="b" data-act="csvimport">Importer</button></div></div><form class="ledger-add card" data-form="arch-tx">${E.champs.map((c: string, i: number) => (i === st ? `<select name="f${i}" aria-label="${esc(c)}">${D.statuses.map((x: string) => `<option>${esc(x)}</option>`).join("")}</select>` : `<input name="f${i}" ${i === R.titre ? "required " : ""}placeholder="${esc(c)}${i === R.montant ? " (ex. −12 €)" : ""}" aria-label="${esc(c)}"${i === R.date ? ` value="${fmtDate(today)}"` : ""}>`)).join("")}<button class="b primary">Ajouter</button></form>${months.map((m) => { const sum = m.list.reduce((s, x) => s + x.a, 0); return `<section class="month"><div class="month-h"><b style="text-transform:capitalize">${esc(m.k)}</b><b class="${sum >= 0 ? "pos" : "neg"}">${money(sum)}</b></div>${m.list.map((x: any) => `<button class="tx-row" data-act="arch-open" data-id="${x.r.id}"><span class="mut sm">${esc(v(x.r, "date"))}</span><b>${esc(v(x.r, "titre"))}</b><span class="chip-s">${esc(v(x.r, "groupe"))}</span><b class="${x.a >= 0 ? "pos" : "neg"}">${esc(v(x.r, "montant"))}</b></button>`).join("")}</section>`; }).join("") || empty("Aucune transaction", "Ajoute ta première ligne ci-dessus.")}${S.drawer ? `<div class="modal-inline">${drawer()}</div>` : ""}`;
  }
  function fiAnalysis() {
    const t = tx();
    const cats = groupsOf("groupe").map((g) => { const l = t.filter((x: any) => v(x.r, "groupe") === g); return { g, n: l.length, s: l.reduce((a: number, x: any) => a + x.a, 0) }; }).filter((c) => c.n);
    const max = Math.max(1, ...cats.map((c) => Math.abs(c.s)));
    const top = t.slice().sort((a: any, b: any) => Math.abs(b.a) - Math.abs(a.a)).slice(0, 5);
    const avg = t.length ? t.reduce((s: number, x: any) => s + x.a, 0) / t.length : 0;
    return `<div class="ws-head"><h1>${esc(page().titre)}</h1><span class="mut">Moyenne par ligne : <b>${money(avg)}</b></span></div><div class="split"><div class="card"><b>Total par ${esc((E.champs[R.groupe] || "catégorie").toLowerCase())}</b><svg viewBox="0 0 420 ${cats.length * 36 + 6}" class="chart">${cats.map((c, i) => `<g transform="translate(0,${i * 36 + 4})"><text x="0" y="17" font-size="13" fill="currentColor">${esc(c.g)}</text><rect x="130" y="4" width="${Math.max(3, (Math.abs(c.s) / max) * 220)}" height="20" rx="5" class="bar" style="--i:${i};fill:${c.s >= 0 ? "#16a34a" : "#e11d48"}"/><text x="${140 + (Math.abs(c.s) / max) * 220}" y="18" font-size="12.5" fill="currentColor">${money(c.s)}</text></g>`).join("")}</svg></div><div class="card"><b>Plus gros montants</b><div class="mini-list">${top.map((x: any) => `<button class="mini" data-act="arch-open" data-id="${x.r.id}"><span class="grow"><b>${esc(v(x.r, "titre"))}</b><span class="mut sm">${esc(v(x.r, "groupe"))} · ${esc(v(x.r, "date"))}</span></span><b class="${x.a >= 0 ? "pos" : "neg"}">${money(x.a)}</b></button>`).join("")}</div></div></div>`;
  }
  // Formation
  function modules() { return groupsOf("groupe").map((g) => ({ g, list: S.rows.filter((r: any) => v(r, "groupe") === g) })); }
  const ring = (pct: number, size = 72) => `<span class="ring-s" style="--v:${pct};width:${size}px;height:${size}px"><span>${pct}%</span></span>`;
  function leCourses() {
    return `<div class="course-hero"><h1>${esc(page().titre)}</h1><p class="mut">${S.rows.filter(isDone).length} leçon(s) terminée(s) sur ${S.rows.length}</p></div><div class="course-grid">${modules().map((m, i) => { const done = m.list.filter(isDone).length; const pct = Math.round((done / Math.max(1, m.list.length)) * 100); const next = m.list.find((r: any) => !isDone(r)) || m.list[0]; return `<div class="course-card rowin" style="--i:${i};--h:${(i * 67 + 200) % 360}"><div class="course-cover"><span>${String(i + 1).padStart(2, "0")}</span></div><div class="course-body"><div class="row between"><b>${esc(m.g)}</b>${ring(pct, 56)}</div><p class="mut sm">${m.list.length} leçon(s) · ${esc(m.list.map((r: any) => r.v[R.titre]).slice(0, 2).join(", "))}</p><button class="b primary sm" data-act="arch-play" data-id="${next.id}">${pct === 100 ? "Revoir" : pct ? "Continuer" : "Commencer"} →</button></div></div>`; }).join("")}</div>`;
  }
  function lePlayer() {
    const r = sel();
    if (!r) return empty("Aucune leçon", "Ajoute une leçon pour commencer.");
    const all = S.rows;
    const i = all.indexOf(r);
    return `<div class="player-wrap"><aside class="syllabus">${modules().map((m) => `<b class="mut xs up">${esc(m.g)}</b>${m.list.map((x: any) => `<button class="syl${x.id === r.id ? " on" : ""}" data-act="arch-play" data-id="${x.id}"><span class="syl-c${isDone(x) ? " ok" : ""}">${isDone(x) ? "✓" : ""}</span>${esc(x.v[R.titre])}<span class="mut xs">${esc(v(x, "duree"))}</span></button>`).join("")}`).join("")}</aside><article class="lesson-a"><span class="tag">${esc(v(r, "groupe"))} · ${esc(v(r, "duree"))}</span><h1>${esc(r.v[R.titre])}</h1><div class="lesson-video"><span class="play">${icon("cours", 30)}</span></div><label class="kv"><span class="mut sm">Contenu de la leçon (modifiable)</span><textarea data-note="${r.id}" rows="7" placeholder="Écris ici le contenu de la leçon…">${esc(note(r))}</textarea></label><div class="row between"><button class="b" data-act="arch-play" data-id="${(all[i - 1] || r).id}"${i <= 0 ? " disabled" : ""}>← Précédente</button><button class="b primary" data-act="arch-done" data-id="${r.id}">${isDone(r) ? "Marquer à refaire" : "Marquer comme terminée ✓"}</button><button class="b" data-act="arch-play" data-id="${(all[i + 1] || r).id}"${i >= all.length - 1 ? " disabled" : ""}>Suivante →</button></div></article></div>`;
  }
  function leCards() {
    const r = S.rows[S.card % Math.max(1, S.rows.length)];
    if (!r) return empty("Aucune fiche", "Ajoute des leçons pour créer des fiches.");
    return `<div class="cards-wrap"><h1>${esc(page().titre)}</h1><p class="mut">Clique sur la carte pour la retourner. ${S.card % S.rows.length + 1} / ${S.rows.length}</p><button class="flash${S.flip ? " flip" : ""}" data-act="arch-flip"><span class="face front"><span class="mut xs up">${esc(v(r, "groupe"))}</span><b>${esc(r.v[R.titre])}</b></span><span class="face back">${esc(note(r) || `${v(r, "groupe")} · ${v(r, "duree")} · ${r.v[st]}`)}</span></button><div class="row center"><button class="b" data-act="arch-card" data-v="-1">← Précédente</button><button class="b primary" data-act="arch-card" data-v="1">Suivante →</button></div></div>`;
  }
  function leProgress() {
    const done = S.rows.filter(isDone).length;
    const pct = Math.round((done / Math.max(1, S.rows.length)) * 100);
    const minutes = S.rows.reduce((s: number, r: any) => s + (parseInt(v(r, "duree"), 10) || 0), 0);
    return `<div class="ws-head"><h1>${esc(page().titre)}</h1></div><div class="prog-hero card">${ring(pct, 120)}<div><b style="font-size:22px">${done} / ${S.rows.length} leçons</b><p class="mut">${minutes} min de contenu au total</p></div></div><div class="card" style="margin-top:14px">${modules().map((m) => { const d = m.list.filter(isDone).length; return `<div class="cat-b"><span>${esc(m.g)}</span><div class="gbar"><i style="width:${(d / Math.max(1, m.list.length)) * 100}%"></i></div><b class="sm">${d}/${m.list.length}</b></div>`; }).join("")}</div>`;
  }
  // Relation client
  function crmSplit() {
    const q = S.q.trim().toLowerCase();
    const rows = S.rows.filter((r: any) => !q || r.v.join(" ").toLowerCase().includes(q));
    const r = sel();
    const hist = r ? S.log.filter((l: any) => String(l.t).includes(r.v[R.titre])).slice(0, 6) : [];
    return `<div class="crm"><div class="crm-list"><div class="row"><label class="search" style="flex:1">${icon("search", 16)}<input data-in="q" placeholder="Rechercher…" value="${esc(S.q)}"></label><button class="ib" data-act="arch-add" aria-label="Ajouter">${icon("plus", 18)}</button></div>${rows.map((x: any) => `<button class="crm-item${r && x.id === r.id ? " on" : ""}" data-act="arch-select" data-id="${x.id}">${avatar(x.v[R.titre], 34)}<span class="grow"><b>${esc(x.v[R.titre])}</b><span class="mut sm">${esc(v(x, "personne"))}</span></span>${badge(x.v[st])}</button>`).join("") || `<p class="mut sm">Aucun résultat.</p>`}</div>${r ? `<div class="crm-sheet"><div class="crm-sheet-h">${avatar(r.v[R.titre], 56)}<div><h1>${esc(r.v[R.titre])}</h1><p class="mut">${esc(v(r, "personne"))}</p></div><div class="row r">${D.statuses.map((x: string) => `<button class="chip${r.v[st] === x ? " on" : ""}" data-act="arch-status" data-id="${r.id}" data-v="${esc(x)}">${esc(x)}</button>`).join("")}</div></div><div class="crm-cols"><div class="kvs1">${fieldInputs(r)}</div><div><label class="kv"><span class="mut sm">Notes</span><textarea data-note="${r.id}" rows="6" placeholder="Compte rendu d'appel, besoin, budget…">${esc(note(r))}</textarea></label><b class="sm">Historique</b><div class="timeline">${hist.map((l: any) => `<div class="tl"><i></i><span>${esc(l.t)}</span><span class="mut xs">${esc(l.at)}</span></div>`).join("") || `<p class="mut sm">Aucune action pour l'instant.</p>`}</div></div></div><div class="row"><button class="b danger" data-act="del" data-id="${r.id}">Supprimer</button></div></div>` : `<div class="crm-sheet">${empty("Aucune fiche", "Ajoute un premier élément.")}</div>`}</div>`;
  }
  // Création
  function stLibrary() {
    const gs = groupsOf("groupe");
    const rows = S.rows.filter((r: any) => !S.chip || v(r, "groupe") === S.chip);
    return `<div class="studio-lib"><aside class="lib-side"><b class="mut xs up">${esc(E.champs[R.groupe] || "Types")}</b><a data-act="chip" data-v="" class="${S.chip ? "" : "on"}">Tout <em>${S.rows.length}</em></a>${gs.map((g) => `<a data-act="chip" data-v="${esc(g)}" class="${S.chip === g ? "on" : ""}">${esc(g)} <em>${S.rows.filter((r: any) => v(r, "groupe") === g).length}</em></a>`).join("")}</aside><div><div class="ws-head"><h1>${esc(page().titre)}</h1>${addBtn(`Nouveau ${E.nom.toLowerCase()}`)}</div><div class="doc-grid">${rows.map((r: any, k: number) => `<button class="doc rowin" style="--i:${k}" data-act="arch-edit" data-id="${r.id}"><span class="doc-page"><b>${esc(r.v[R.titre])}</b><span>${esc(note(r).slice(0, 120) || "Document vide — clique pour écrire.")}</span></span><span class="row between"><span class="mut xs">${esc(v(r, "groupe"))} · ${words(note(r))} mots</span>${badge(r.v[st])}</span></button>`).join("") || empty("Aucun document", "Crée ton premier document.")}</div></div></div>`;
  }
  function stEditor() {
    const r = sel();
    if (!r) return empty("Aucun document", "Crée un document depuis la bibliothèque.");
    return `<div class="studio3"><aside class="lib-side">${S.rows.map((x: any) => `<a data-act="arch-edit" data-id="${x.id}" class="${x.id === r.id ? "on" : ""}">${esc(x.v[R.titre])}</a>`).join("")}<button class="b sm" data-act="arch-add">${icon("plus", 14)} Nouveau</button></aside><div class="editor"><input class="ed-title" data-edit="${R.titre}" data-id="${r.id}" value="${esc(r.v[R.titre])}" aria-label="Titre"><textarea class="ed-body" data-note="${r.id}" placeholder="Commence à écrire…">${esc(note(r))}</textarea><div class="row between mut xs"><span id="wc">${words(note(r))} mots</span><span id="saved">Enregistré automatiquement</span></div></div><aside class="props"><b class="sm">Propriétés</b><div class="kvs1">${fieldInputs(r)}</div><button class="b danger sm" data-act="del" data-id="${r.id}">Supprimer</button></aside></div>`;
  }
  // E-commerce
  const stockOf = (r: any) => { const n = parseInt(v(r, "stock"), 10); return Number.isFinite(n) ? n : null; };
  function coProducts() {
    return `<div class="ws-head"><h1>${esc(page().titre)}</h1><div class="row"><button class="b" data-act="csvimport">Importer</button>${addBtn()}</div></div><div class="prod-grid">${S.rows.map((r: any, k: number) => { const s = stockOf(r); return `<div class="prod rowin" style="--i:${k}"><div class="prod-img" style="--h:${(r.id * 53) % 360}"><span>${esc(String(r.v[R.titre])[0] || "?")}</span></div><b>${esc(r.v[R.titre])}</b><div class="row between"><span class="price-s">${esc(v(r, "prix"))}</span><span class="sm ${s !== null && s <= 3 ? "neg" : "mut"}">${s === null ? esc(v(r, "stock")) : `${s} en stock`}</span></div><div class="row between">${badge(r.v[st])}<div class="row"><button class="b sm" data-act="arch-edit-p" data-id="${r.id}">Modifier</button><button class="b sm primary" data-act="arch-order" data-id="${r.id}"${s === 0 ? " disabled" : ""}>Vendre</button></div></div></div>`; }).join("")}</div>`;
  }
  function coOrders() {
    const opts = S.rows.map((r: any) => `<option value="${r.id}">${esc(r.v[R.titre])} — ${esc(v(r, "prix"))}</option>`).join("");
    return `<div class="ws-head"><h1>${esc(page().titre)}</h1></div><form class="card ledger-add" data-form="arch-neworder"><select name="p" aria-label="Produit">${opts}</select><input name="q" type="number" min="1" value="1" aria-label="Quantité"><input name="c" required placeholder="Client" aria-label="Client"><button class="b primary">Créer la commande</button></form>${S.orders.length ? `<div class="card flush"><table><thead><tr><th>N°</th><th>Client</th><th>Produit</th><th>Qté</th><th>Total</th><th>Statut</th></tr></thead><tbody>${S.orders.map((o: any) => `<tr><td>#${o.id}</td><td>${esc(o.client)}</td><td>${esc(o.nom)}</td><td>${o.qte}</td><td><b>${money(o.total)}</b></td><td><select data-order="${o.id}">${["À préparer", "Expédiée", "Livrée", "Annulée"].map((x) => `<option${x === o.statut ? " selected" : ""}>${x}</option>`).join("")}</select></td></tr>`).join("")}</tbody></table></div>` : empty("Aucune commande", "Crée une commande ci-dessus ou clique sur « Vendre » dans les produits.")}<p class="mut xs" style="margin-top:10px">Aperçu : aucun paiement n'est encaissé. Une commande décompte le stock du produit.</p>`;
  }
  function coSales() {
    const ok = S.orders.filter((o: any) => o.statut !== "Annulée");
    const total = ok.reduce((s: number, o: any) => s + o.total, 0);
    const by = S.rows.map((r: any) => ({ r, n: ok.filter((o: any) => o.pid === r.id).reduce((s: number, o: any) => s + o.total, 0) })).filter((x: any) => x.n).sort((a: any, b: any) => b.n - a.n);
    const max = Math.max(1, ...by.map((x: any) => x.n));
    return `<div class="ws-head"><h1>${esc(page().titre)}</h1></div><div class="kpis"><div class="card kpi"><span class="mut sm">Chiffre d'affaires</span><div class="big">${money(total)}</div></div><div class="card kpi"><span class="mut sm">Commandes</span><div class="big">${ok.length}</div></div><div class="card kpi"><span class="mut sm">Panier moyen</span><div class="big">${money(ok.length ? total / ok.length : 0)}</div></div></div><div class="card"><b>Meilleurs produits</b>${by.length ? by.map((x: any, i: number) => `<div class="cat-b rowin" style="--i:${i}"><span>${esc(x.r.v[R.titre])}</span><div class="gbar"><i style="width:${(x.n / max) * 100}%"></i></div><b class="sm">${money(x.n)}</b></div>`).join("") : `<p class="mut sm">Pas encore de vente : crée une commande pour voir apparaître les chiffres.</p>`}</div>`;
  }
  function settings() {
    return `<div class="ws-head"><h1>${esc(page().titre)}</h1></div><form class="card form" data-form="profil"><b>Profil</b><label>Nom<input name="nom" value="${esc(S.user.nom)}"></label><label>Email<input name="email" type="email" value="${esc(S.user.email)}"></label><input type="hidden" name="role" value="${esc(S.user.role)}"><button class="b primary">Enregistrer</button></form><div class="card form" style="margin-top:14px"><b>Données</b><p class="mut sm">${S.rows.length} ${esc(E.pluriel.toLowerCase())}${S.orders.length ? ` et ${S.orders.length} commande(s)` : ""}.</p><div class="row"><button class="b" data-act="csv">${icon("download", 16)} Exporter en CSV</button><button class="b" data-act="csvimport">Importer un CSV</button><button class="b danger" data-act="reset">Revenir aux données d'exemple</button></div></div>${A.accounts ? `<div class="card form" style="margin-top:14px"><b>Compte</b><button class="b" data-act="arch-logout">Se déconnecter</button></div>` : ""}`;
  }
  const page = () => D.pages.find((p: any) => p.id === S.page) || D.pages[0];

  const pages: Record<string, () => string> = {
    "site-home": home, "site-features": features, "site-pricing": () => `<section class="site-sec">${P.tarifs()}</section>`, "site-login": () => auth(false), "site-signup": () => auth(true),
    "ws-list": wsList, "ws-board": () => P.kanban(), "ws-timeline": wsTimeline,
    "fi-overview": fiOverview, "fi-ledger": fiLedger, "fi-analysis": fiAnalysis, "fi-goals": () => P.objectifs(),
    "le-courses": leCourses, "le-player": lePlayer, "le-cards": leCards, "le-progress": leProgress,
    "crm-split": crmSplit, "crm-pipeline": () => P.kanban(), "crm-followup": () => P.relances(),
    "st-library": stLibrary, "st-editor": stEditor,
    "co-products": coProducts, "co-orders": coOrders, "co-sales": coSales,
    settings,
  };

  function shell() {
    if (String(page().kind).startsWith("site-")) siteShell(); else {
      // L'espace utilisateur demande une connexion quand le SaaS a des comptes.
      if (A.accounts && !S.logged) { S.page = "connexion"; siteShell(); return; }
      appShell();
    }
  }

  function openNew(after?: (r: any) => void) {
    modal(`Ajouter : ${E.nom.toLowerCase()}`, `<div class="form">${X.fields()}</div>`, "Ajouter", (f: FormData) => {
      const r = addRow(E.champs.map((_: string, i: number) => String(f.get(`f${i}`) || "")));
      S.sel = r.id; if (after) after(r); render(false); toast(`${E.nom} ajouté`); save();
    });
  }

  function click(act: string, t: any): boolean {
    const id = Number(t.dataset.id);
    const r = S.rows.find((x: any) => x.id === id);
    switch (act) {
      case "arch-add": openNew(page().kind === "st-library" ? () => go((findPage("st-editor") || page()).id) : undefined); return true;
      case "arch-list": S.list = t.dataset.v; S.drawer = false; shell(); render(false); return true;
      case "arch-open": S.sel = id; S.drawer = true; if (A.frame === "board") shell(); render(false); return true;
      case "arch-drawer": S.drawer = false; shell(); render(false); return true;
      case "arch-check": return false;
      case "arch-done": if (r) { r.v[st] = isDone(r) ? D.statuses[0] : doneStatus(); X.log(`${r.v[R.titre]} → ${r.v[st]}`); toast(isDone(r) ? "Terminé ✓" : "Rouvert"); } if (A.frame === "board") shell(); render(false); return true;
      case "arch-select": S.sel = id; render(false); return true;
      case "arch-status": if (r) { r.v[st] = t.dataset.v; X.log(`${r.v[R.titre]} → ${t.dataset.v}`); } render(false); return true;
      case "arch-play": S.sel = id; go((findPage("le-player") || page()).id); return true;
      case "arch-flip": S.flip = !S.flip; render(false); return true;
      case "arch-card": S.flip = false; S.card = (S.card + Number(t.dataset.v) + S.rows.length) % Math.max(1, S.rows.length); render(false); return true;
      case "arch-edit": S.sel = id; go((findPage("st-editor") || page()).id); return true;
      case "arch-edit-p": if (r) modal(`Modifier : ${r.v[R.titre]}`, `<div class="form">${E.champs.map((c: string, i: number) => `<label>${esc(c)}${i === st ? `<select name="f${i}">${D.statuses.map((x: string) => `<option${x === r.v[i] ? " selected" : ""}>${esc(x)}</option>`).join("")}</select>` : `<input name="f${i}" value="${esc(r.v[i])}">`}</label>`).join("")}</div>`, "Enregistrer", (f: FormData) => { r.v = E.champs.map((_: string, i: number) => String(f.get(`f${i}`) || "")); X.log(`${r.v[R.titre]} modifié`); render(false); toast("Produit mis à jour"); save(); }); return true;
      case "arch-order": if (r) { order(r, 1, "Vente directe"); render(false); } return true;
      case "arch-logout": S.logged = false; go("accueil"); toast("Déconnecté·e"); return true;
    }
    return false;
  }
  function order(r: any, qte: number, client: string) {
    const s = stockOf(r);
    if (s !== null && s < qte) { toast(`Stock insuffisant (${s})`, "bad"); return; }
    const unit = amount(v(r, "prix")) || 0;
    S.orders.unshift({ id: S.nextOrder++, pid: r.id, nom: r.v[R.titre], qte, total: unit * qte, client, statut: "À préparer", date: fmtDate(today) });
    if (s !== null) r.v[R.stock] = String(s - qte);
    X.log(`Commande : ${qte} × ${r.v[R.titre]}`);
    toast(`Commande #${S.nextOrder - 1} créée`);
    save();
  }
  function change(t: any): boolean {
    if (t.dataset.act === "arch-check") { const r = S.rows.find((x: any) => x.id === Number(t.dataset.id)); if (r) { r.v[st] = t.checked ? doneStatus() : D.statuses[0]; X.log(`${r.v[R.titre]} → ${r.v[st]}`); } shell(); render(false); return true; }
    if (t.dataset.act === "arch-period") { S.period = t.value; render(false); return true; }
    if (t.dataset.order) { const o = S.orders.find((x: any) => x.id === Number(t.dataset.order)); if (o) { o.statut = t.value; toast(`Commande #${o.id} : ${o.statut}`); } return true; }
    if (t.dataset.note) return true;
    return false;
  }
  function input(t: any): boolean {
    if (t.dataset.note) {
      S.notes[t.dataset.note] = t.value.slice(0, 20000);
      const wc = document.getElementById("wc"); if (wc) wc.textContent = `${words(t.value)} mots`;
      clearTimeout(S.noteT); S.noteT = setTimeout(save, 400);
      return true;
    }
    return false;
  }
  function submit(f: any, fd: FormData): boolean {
    const kind = f.dataset.form;
    if (kind === "arch-login") { S.logged = true; if (fd.get("nom")) S.user = { ...S.user, nom: String(fd.get("nom")), email: String(fd.get("email")) }; X.log("Connexion"); toast("Bienvenue !"); go("app"); return true; }
    if (kind === "arch-quick") { const txt = String(fd.get("t") || "").trim(); if (!txt) return true; const vals = E.champs.map((_: string, i: number) => (i === R.titre ? txt : i === st ? D.statuses[0] : "")); addRow(vals); shell(); render(false); toast(`${E.nom} ajouté`); const i = document.querySelector(".quick input") as HTMLInputElement; if (i) i.focus(); return true; }
    if (kind === "arch-tx") { addRow(E.champs.map((_: string, i: number) => String(fd.get(`f${i}`) || ""))); render(false); toast("Transaction ajoutée"); return true; }
    if (kind === "arch-neworder") { const r = S.rows.find((x: any) => x.id === Number(fd.get("p"))); if (r) order(r, Math.max(1, Number(fd.get("q")) || 1), String(fd.get("c") || "Client")); render(false); return true; }
    return false;
  }
  return { pages, shell, click, change, input, submit, appEntry };
}
