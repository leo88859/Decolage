import { startMockSupabase } from "./mock-supabase";

/** Démarre le faux Supabase en mémoire avant les tests ; la fonction renvoyée l'arrête après. */
export default async function globalSetup() {
  const stop = await startMockSupabase();
  // Échauffement : les toutes premières requêtes du serveur fraîchement lancé sont lentes. On les absorbe ici, hors des tests.
  const base = "http://localhost:3100";
  for (const chemin of ["/b/marque-classique", "/s/bougie-lune", "/b/libre-classique", "/cookies", "/parametres"]) {
    await fetch(base + chemin, { signal: AbortSignal.timeout(150_000) }).then((r) => r.text()).catch(() => undefined);
  }
  return stop;
}
