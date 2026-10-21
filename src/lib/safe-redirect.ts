/** N'autorise que des chemins internes (évite les redirections ouvertes). */
export function safeNext(next: unknown, fallback = "/tableau-de-bord"): string {
  if (typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
