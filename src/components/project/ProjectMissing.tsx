import Link from "next/link";

export function ProjectMissing() {
  return (
    <main className="page">
      <div className="container narrow empty">
        <h1 className="h-sec">Projet introuvable</h1>
        <p className="mut" style={{ margin: "8px 0 20px" }}>Il a peut-être été supprimé, ou créé dans un autre navigateur. Les projets sont enregistrés sur l&apos;appareil où ils ont été créés.</p>
        <Link href="/tableau-de-bord" className="btn">Voir mes projets</Link>
      </div>
    </main>
  );
}
