import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page">
      <div className="container narrow empty">
        <span className="eyebrow">Erreur 404</span>
        <h1 className="h-page" style={{ margin: "12px 0" }}>Cette page n&apos;existe pas.</h1>
        <p className="mut" style={{ marginBottom: 20 }}>Le lien est peut-être incorrect ou la page a été déplacée.</p>
        <div className="row" style={{ justifyContent: "center" }}>
          <Link href="/" className="btn">Retour à l&apos;accueil</Link>
          <Link href="/idees" className="btn btn-ghost">Voir les idées</Link>
        </div>
      </div>
    </main>
  );
}
