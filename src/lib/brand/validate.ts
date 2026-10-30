// Validation pure de la marque (utilisée côté serveur ET côté navigateur pour les messages).
// Le serveur reste la seule autorité : le navigateur ne fait que prévenir plus tôt.

import { COLOR_KEYS, FAVICON_MAX_BYTES, LOGO_MAX_BYTES, NAME_MAX, type Brand } from "./types";

export type Check<T> = { ok: true; value: T } | { ok: false; error: string };
export type FieldErrors = Partial<Record<"name" | "primary" | "secondary" | "accent" | "surface" | "text" | "logo" | "favicon", string>>;

const HEX = /^#[0-9a-fA-F]{6}$/;
// Caractères de contrôle et marques bidirectionnelles (affichage trompeur).
const BAD_CHARS = /[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩﻿]/;

export function validateName(input: unknown): Check<string> {
  if (typeof input !== "string") return { ok: false, error: "Le nom est obligatoire." };
  const name = input.normalize("NFC").trim().replace(/\s+/g, " ");
  const length = [...name].length;
  if (length < 1) return { ok: false, error: "Le nom est obligatoire." };
  if (length > NAME_MAX) return { ok: false, error: `Le nom fait ${NAME_MAX} caractères au maximum.` };
  if (/[<>]/.test(name)) return { ok: false, error: "Le nom ne peut pas contenir de balises (< ou >)." };
  if (BAD_CHARS.test(name)) return { ok: false, error: "Le nom contient un caractère invisible ou de contrôle." };
  return { ok: true, value: name };
}

/** Accepte #rrggbb uniquement (majuscules tolérées), renvoie en minuscules. */
export function validateColor(input: unknown, label = "La couleur"): Check<string> {
  if (typeof input !== "string" || !HEX.test(input.trim())) return { ok: false, error: `${label} doit être au format #rrggbb (par exemple #2f5bff).` };
  return { ok: true, value: input.trim().toLowerCase() };
}

// ─── Images ──────────────────────────────────────────────────────────────

export type ImageKind = "png" | "jpeg" | "webp";
const MIME_OF: Record<ImageKind, string> = { png: "image/png", jpeg: "image/jpeg", webp: "image/webp" };

/** Détecte le vrai format d'après les octets magiques (jamais d'après le nom ou le type déclaré). */
export function sniffImage(bytes: Uint8Array): ImageKind | null {
  const at = (i: number, ...sig: number[]) => sig.every((b, k) => bytes[i + k] === b);
  if (bytes.length >= 33 && at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a) && at(12, 0x49, 0x48, 0x44, 0x52)) return "png"; // signature + bloc IHDR
  if (bytes.length >= 4 && at(0, 0xff, 0xd8, 0xff)) return "jpeg";
  if (bytes.length >= 16 && at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return "webp"; // RIFF....WEBP
  return null;
}

const DATA_URL = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

function decodeBase64(b64: string): Uint8Array | null {
  if (b64.length % 4 !== 0) return null;
  try {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

/**
 * Contrôle complet d'une image reçue en data URL : format autorisé, base64 valide,
 * octets magiques cohérents avec le type annoncé, taille décodée.
 * `allowed` : formats acceptés (logo : png, jpeg, webp ; favicon : png).
 */
export function validateImageDataUrl(input: unknown, opts: { allowed: ImageKind[]; maxBytes: number; label: string }): Check<string> {
  const { allowed, maxBytes, label } = opts;
  const formats = allowed.map((k) => k.toUpperCase()).join(", ");
  if (typeof input !== "string") return { ok: false, error: `${label} invalide.` };
  // Borne la longueur AVANT toute analyse (le base64 pèse environ 4/3 de la taille réelle).
  if (input.length > Math.ceil(maxBytes / 3) * 4 + 64) return { ok: false, error: `${label} trop lourd : ${Math.round(maxBytes / 1000)} Ko maximum.` };
  const m = DATA_URL.exec(input);
  if (!m) return { ok: false, error: `${label} : formats acceptés ${formats} uniquement (SVG refusé).` };
  const bytes = decodeBase64(m[2]!);
  if (!bytes) return { ok: false, error: `${label} : fichier corrompu.` };
  if (bytes.length > maxBytes) return { ok: false, error: `${label} trop lourd : ${Math.round(maxBytes / 1000)} Ko maximum.` };
  const kind = sniffImage(bytes);
  if (!kind || MIME_OF[kind] !== m[1]) return { ok: false, error: `${label} : le contenu n'est pas une vraie image ${formats}.` };
  if (!allowed.includes(kind)) return { ok: false, error: `${label} : formats acceptés ${formats} uniquement.` };
  return { ok: true, value: input };
}

export const validateLogo = (input: unknown) => validateImageDataUrl(input, { allowed: ["png", "jpeg", "webp"], maxBytes: LOGO_MAX_BYTES, label: "Le logo" });
export const validateFavicon = (input: unknown) => validateImageDataUrl(input, { allowed: ["png"], maxBytes: FAVICON_MAX_BYTES, label: "Le favicon" });

// ─── Marque complète ─────────────────────────────────────────────────────

export const COLOR_LABELS: Record<(typeof COLOR_KEYS)[number], string> = {
  primary: "La couleur principale",
  secondary: "La couleur secondaire",
  accent: "La couleur d'accent",
  surface: "La couleur de fond",
  text: "La couleur du texte",
};

/**
 * Valide un objet venu de l'extérieur (corps de requête, instantané `previous`).
 * Les champs inconnus (dont un éventuel user_id) sont ignorés. logo/favicon absents ou null = aucun.
 */
export function validateBrand(input: unknown): { ok: true; brand: Brand } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const src = (input && typeof input === "object" && !Array.isArray(input) ? input : {}) as Record<string, unknown>;
  const name = validateName(src.name);
  if (!name.ok) errors.name = name.error;
  const colors: Partial<Record<(typeof COLOR_KEYS)[number], string>> = {};
  for (const k of COLOR_KEYS) {
    const c = validateColor(src[k], COLOR_LABELS[k]);
    if (c.ok) colors[k] = c.value;
    else errors[k] = c.error;
  }
  let logo: string | null = null;
  if (src.logo !== undefined && src.logo !== null) {
    const l = validateLogo(src.logo);
    if (l.ok) logo = l.value;
    else errors.logo = l.error;
  }
  let favicon: string | null = null;
  if (src.favicon !== undefined && src.favicon !== null) {
    const f = validateFavicon(src.favicon);
    if (f.ok) favicon = f.value;
    else errors.favicon = f.error;
  }
  if (Object.keys(errors).length || !name.ok) return { ok: false, errors };
  return { ok: true, brand: { name: name.value, ...(colors as Record<(typeof COLOR_KEYS)[number], string>), logo, favicon } };
}
