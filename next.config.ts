import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  // Anti-clickjacking : aucune page de l'application n'est chargée dans un cadre. Les aperçus du constructeur
  // sont des iframes « srcdoc » isolés (sandbox) : ils sont contenus DANS nos pages, sans être encadrés par URL.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Adresses que les visiteurs essaient de taper : on les mène aux bonnes pages.
  async redirects() {
    return [
      { source: "/tarifs", destination: "/#offres", permanent: false },
      { source: "/apprendre", destination: "/guide", permanent: false },
    ];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
