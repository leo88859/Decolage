"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/boutique", label: "Vue d'ensemble" },
  { href: "/boutique/produits", label: "Produits" },
  { href: "/boutique/categories", label: "Catégories" },
  { href: "/boutique/commandes", label: "Commandes" },
];

export function SubNav() {
  const path = usePathname();
  return (
    <nav aria-label="Espace boutique" className="tabs" style={{ marginBottom: 24 }}>
      {ITEMS.map((i) => (
        <Link key={i.href} href={i.href} className="tab" aria-current={path === i.href ? "page" : undefined} style={path === i.href ? { color: "var(--ink)", boxShadow: "inset 0 -3px 0 var(--blue)" } : undefined}>
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
