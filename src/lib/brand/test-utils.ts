// Fabrique d'images de test (octets réels minimaux, pas de vraies images complètes). Utilisé par les tests uniquement.
export function pngBytes(total = 64): Uint8Array {
  const b = new Uint8Array(total);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  return b;
}
export function jpegBytes(total = 64): Uint8Array {
  const b = new Uint8Array(total);
  b.set([0xff, 0xd8, 0xff, 0xe0]);
  return b;
}
export function webpBytes(total = 64): Uint8Array {
  const b = new Uint8Array(total);
  b.set([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20]);
  return b;
}
export const dataUrl = (mime: string, bytes: Uint8Array) => `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
