/**
 * N'autorise que des chemins internes (évite les redirections ouvertes).
 * Les parseurs d'URL suppriment tabulations et retours à la ligne : « /\t/evil.fr » devient « //evil.fr ».
 * On refuse donc tout caractère de contrôle et toute barre oblique inverse, puis on vérifie
 * que l'URL résolue reste bien sur notre origine.
 */
export function safeNext(next: unknown, fallback = "/tableau-de-bord"): string {
  if (typeof next !== "string" || next.length > 2000) return fallback;
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  if (/[\u0000-\u001f\u007f-\u009f\\]/.test(next)) return fallback;
  try {
    const base = "https://origine.invalid";
    if (new URL(next, base).origin !== base) return fallback;
  } catch {
    return fallback;
  }
  return next;
}
