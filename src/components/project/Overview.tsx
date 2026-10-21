"use client";

import Link from "next/link";
import { useFeatures } from "@/components/CloudSync";
import type { TabId } from "@/components/project/tabs";
import { Meter, Reveal } from "@/components/ui";
import { ANIM_LABEL, DASH_LABEL, DESIGN_BY_ID, SHELL_LABEL } from "@/data/designs";
import { MODULE_BY_ID } from "@/data/modules";
import { TEMPLATE_BY_ID } from "@/data/templates";
import { activePages, REVENUE_LABEL } from "@/lib/modules";
import { can } from "@/lib/plans";
import { projectProgress } from "@/lib/project";
import { useCloud } from "@/lib/cloud";
import { useData } from "@/lib/store";
import type { ModuleId, Project } from "@/lib/types";

const fmt = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Briques dont la version réelle demande un service externe (dans le prototype, elles sont simulées). */
const SERVICE: Partial<Record<ModuleId, string>> = {
  auth: "Comptes : Supabase Auth", profil: "Profils : base de données", donnees: "Données : base de données", formulaires: "Envois : base de données",
  favoris: "Favoris : base de données", historique: "Historique : base de données", abonnement: "Paiements : Stripe", facturation: "Factures : Stripe",
  notifications: "E-mails / SMS : service d'envoi", admin: "Rôles : authentification réelle",
};

export function Overview({ project: p, go }: { project: Project; go: (t: TabId) => void }) {
  const { plan } = useData();
  const { cloud, loaded } = useFeatures();
  const { session } = useCloud();
  const prog = projectProgress(p, can(plan, "plansDetailles"));
  const t = TEMPLATE_BY_ID[p.config.templateId];
  const d = p.config.design ? DESIGN_BY_ID[p.config.design] : undefined;
  const tabFor: Record<string, TabId> = { valider: "validation", landing: "landing", feuille: "feuille", lancement: "lancement" };
  const services = [...new Set(p.config.modules.map((m) => SERVICE[m]).filter(Boolean))] as string[];
  const pages = activePages(p.config);

  return (
    <div className="ov">
      <dl className="ov-facts">
        <div><dt>{prog.pct}%</dt><dd>feuille de route</dd></div>
        <div><dt>{prog.done}/{prog.tasks}</dt><dd>tâches terminées</dd></div>
        <div><dt>{pages.length}</dt><dd>pages</dd></div>
        <div><dt>{p.config.modules.length}</dt><dd>briques</dd></div>
        <div><dt>{p.launch.date ? new Date(`${p.launch.date}T12:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : "—"}</dt><dd>{p.launch.date ? "lancement prévu" : <button className="ov-link" onClick={() => go("lancement")}>choisir une date</button>}</dd></div>
      </dl>

      <Reveal as="section" className="ov-journey">
        <div className="row between">
          <h2 className="h-sec">Parcours du projet</h2>
          <span className="badge badge-coral">Étape en cours : {prog.etape}</span>
        </div>
        <ol className="ov-steps">
          {prog.etapes.map((e, i) => (
            <li key={e.id} className={e.done ? "done" : e.label === prog.etape ? "now" : ""}>
              <span className="ov-n">{e.done ? "✓" : i + 1}</span>
              {e.id === "construire" ? <Link href={`/projets/${p.id}/constructeur`}>{e.label}</Link> : <button onClick={() => go(tabFor[e.id]!)}>{e.label}</button>}
            </li>
          ))}
        </ol>
      </Reveal>

      <div className="ov-grid">
        <Reveal as="section" className="ov-card ov-next">
          <div className="row between"><h2 className="h-sec">Feuille de route</h2><b>{prog.done}/{prog.tasks}</b></div>
          <Meter value={prog.pct} label="Avancement de la feuille de route" />
          {prog.next ? (
            <div>
              <span className="eyebrow">Prochaine tâche</span>
              <p className="ov-task">{prog.next.titre}</p>
              <p className="small mut">{prog.next.description}</p>
              <button className="btn btn-sm" style={{ marginTop: 12 }} onClick={() => go("feuille")}>Ouvrir la feuille de route <span className="arrow">→</span></button>
            </div>
          ) : <div className="alert alert-ok">Toutes les tâches sont terminées.</div>}
        </Reveal>

        <Reveal as="section" className="ov-card" delay={1}>
          <h2 className="h-sec" style={{ marginBottom: 10 }}>Configuration</h2>
          <div className="kv"><span className="mut">Type de SaaS</span><b>{t.nom}</b></div>
          <div className="kv"><span className="mut">Design</span><b>{d ? `${d.nom} · ${SHELL_LABEL[d.shell]}` : "Style seul"}</b></div>
          {d && <div className="kv"><span className="mut">Tableau de bord</span><b>{DASH_LABEL[d.dash]} · {ANIM_LABEL[d.anim]}</b></div>}
          <div className="kv"><span className="mut">Revenus</span><b>{REVENUE_LABEL[p.config.revenu]}{p.config.prix ? ` · ${p.config.prix} €` : ""}</b></div>
          <div className="row" style={{ gap: 6, marginTop: 12 }}>{p.config.modules.map((m) => <span key={m} className="badge">{MODULE_BY_ID[m].nom}</span>)}</div>
          <Link href={`/projets/${p.id}/constructeur?etape=type`} className="btn btn-ghost btn-sm" style={{ marginTop: 14, alignSelf: "flex-start" }}>Modifier dans le constructeur</Link>
        </Reveal>
      </div>

      {/* Ce qui marche vraiment aujourd'hui, ce qui est simulé et ce qui demande un service : vérifié dans le code. */}
      <Reveal as="section" className="ov-truth">
        <div className="row between" style={{ alignItems: "flex-end" }}>
          <div><span className="eyebrow">État réel</span><h2 className="h-sec" style={{ marginTop: 8 }}>Ce que ton projet fait vraiment</h2></div>
          <button className="btn btn-ghost btn-sm" onClick={() => go("production")}>Guide de mise en production</button>
        </div>
        <div className="ov-cols">
          <div className="ov-col ok">
            <b>Fonctionne maintenant</b>
            <ul>
              <li>Projet enregistré dans ce navigateur{session ? " et copié sur ton compte" : ""}</li>
              <li>Prototype cliquable dans ton design</li>
              <li>Page de vente rédigée et modifiable</li>
              <li>Ton application : ajouter, modifier, supprimer, avec données enregistrées dans ton projet et import / export CSV</li>
              <li>Export d&apos;un projet Next.js qui compile et fonctionne seul (données dans le navigateur)</li>
              <li>Export .zip : page de vente HTML/CSS, prototype autonome, configuration JSON</li>
              <li>Validation, feuille de route, prix, plan de lancement, indicateurs saisis à la main</li>
            </ul>
          </div>
          <div className="ov-col sim">
            <b>Simulé dans l&apos;aperçu</b>
            <ul>
              <li>Connexion, inscription et rôles</li>
              {p.config.modules.some((m) => m === "abonnement" || m === "facturation") && <li>Paiements et factures (aucun débit)</li>}
              {p.config.modules.includes("notifications") && <li>Notifications : rien n&apos;est envoyé</li>}
              <li>Messagerie et réponses automatiques</li>
            </ul>
          </div>
          <div className="ov-col ext">
            <b>Demande un service externe</b>
            <ul>
              <li>Publication en ligne et vraie liste d&apos;attente : {!loaded ? "vérification…" : cloud ? <>Supabase configuré sur ce site · <button className="ov-link" onClick={() => go("enligne")}>publier</button></> : "Supabase non configuré sur ce site"}</li>
              {services.map((s) => <li key={s}>{s}</li>)}
              <li>Hébergement d&apos;une application complète et nom de domaine</li>
            </ul>
          </div>
        </div>
        <p className="tiny mut">Les données de ton application restent sur cet appareil (et ton compte s&apos;il est connecté) : elles ne sont pas partagées avec d&apos;autres utilisateurs tant qu&apos;aucune base de données n&apos;est branchée.</p>
      </Reveal>

      <Reveal as="section" className="ov-card">
        <h2 className="h-sec" style={{ marginBottom: 12 }}>Dernière activité</h2>
        <ol className="ov-activity">
          {p.activity.slice(0, 8).map((a, i) => <li key={i}><span>{a.label}</span><time className="mut small" dateTime={a.date}>{fmt(a.date)}</time></li>)}
        </ol>
      </Reveal>

      <style>{`
        .ov{display:grid;gap:22px}
        .ov-link{border:0;background:none;padding:0;color:var(--blue-ink);font:inherit;font-weight:600;text-decoration:underline;cursor:pointer}
        .ov-facts{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:1px;margin:0;border-radius:20px;overflow:hidden;background:var(--line-2);border:1px solid var(--line-2)}
        .ov-facts > div{background:var(--paper);padding:16px 18px}
        .ov-facts dt{font:600 30px var(--display);letter-spacing:-.04em;line-height:1}
        .ov-facts dd{margin:6px 0 0;font-size:13px;color:var(--mut)}
        .ov-journey{padding:24px;border-radius:var(--r-lg);background:var(--navy);color:#fff}
        .ov-journey .h-sec{color:#fff}
        .ov-steps{list-style:none;padding:0;margin:22px 0 0;display:grid;grid-template-columns:repeat(5,1fr);gap:8px}
        .ov-steps li{display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center;font-size:14px;font-weight:600;position:relative}
        .ov-steps li:not(:last-child)::after{content:"";position:absolute;top:19px;left:calc(50% + 26px);right:calc(-50% + 26px);height:2px;background:rgba(255,255,255,.18)}
        .ov-steps li.done:not(:last-child)::after{background:var(--coral)}
        .ov-steps button,.ov-steps a{border:0;background:none;cursor:pointer;color:rgba(255,255,255,.8);font-weight:600}
        .ov-steps button:hover,.ov-steps a:hover{color:#fff;text-decoration:underline}
        .ov-n{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:rgba(255,255,255,.1);font-family:var(--display);transition:all .3s var(--ease)}
        .done .ov-n{background:var(--coral);color:var(--navy);animation:favPop .4s var(--ease)}
        .now .ov-n{background:#fff;color:var(--navy);box-shadow:0 0 0 5px rgba(255,107,74,.35)}
        .ov-grid{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr);gap:22px;align-items:start}
        .ov-card{display:flex;flex-direction:column;gap:12px;padding:22px;border-radius:var(--r-lg);background:var(--paper);border:1px solid var(--line)}
        .ov-next{box-shadow:inset 4px 0 0 var(--coral)}
        .ov-task{font:600 22px var(--display);letter-spacing:-.02em;margin:6px 0 4px}
        .ov-truth{display:grid;gap:16px;padding:24px;border-radius:var(--r-lg);background:var(--cream-2)}
        .ov-cols{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
        .ov-col{padding:18px;border-radius:16px;background:var(--paper);border-top:4px solid var(--c)}
        .ov-col.ok{--c:var(--ok)}.ov-col.sim{--c:var(--blue)}.ov-col.ext{--c:var(--warn)}
        .ov-col b{display:block;margin-bottom:8px}
        .ov-col ul{margin:0;padding-left:18px;display:grid;gap:6px;font-size:14px}
        .ov-col li::marker{color:var(--c)}
        .ov-activity{list-style:none;margin:0;padding:0;display:grid}
        .ov-activity li{display:flex;justify-content:space-between;gap:12px;padding:10px 0 10px 18px;border-bottom:1px solid var(--line);position:relative}
        .ov-activity li::before{content:"";position:absolute;left:0;top:17px;width:8px;height:8px;border-radius:50%;background:var(--coral)}
        .ov-activity li:last-child{border-bottom:0}
        @media(max-width:980px){.ov-grid,.ov-cols{grid-template-columns:minmax(0,1fr)}.ov-facts{grid-template-columns:repeat(2,minmax(0,1fr))}}
        @media(max-width:640px){.ov-steps{grid-template-columns:1fr;justify-items:start}.ov-steps li{flex-direction:row}.ov-steps li::after{display:none}}
      `}</style>
    </div>
  );
}
