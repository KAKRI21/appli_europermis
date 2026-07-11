// src/lib/auth/password.server.ts
//
// Hachage de mot de passe SANS dépendance native (pas de bcrypt/argon2 qui
// nécessitent des bindings natifs souvent incompatibles avec un déploiement
// edge/Cloudflare Workers). On utilise Web Crypto (`crypto.subtle`), qui est
// disponible aussi bien sous Node 18+ que sur les runtimes edge.
//
// Algorithme : PBKDF2-SHA256, 210 000 itérations (recommandation OWASP 2023+
// pour PBKDF2-SHA256), sel aléatoire 16 octets par mot de passe.
// Format stocké : "pbkdf2$<iterations>$<saltHex>$<hashHex>"

const ITERATIONS = 210_000;
const KEY_LENGTH_BITS = 256;
const SALT_BYTES = 16;

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

async function deriveKey(password: string, salt: Uint8Array, iterations: number): Promise<ArrayBuffer> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    keyMaterial,
    KEY_LENGTH_BITS,
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const derived = await deriveKey(password, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${toHex(salt.buffer as ArrayBuffer)}$${toHex(derived)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;

  const iterations = parseInt(parts[1], 10);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;

  const salt = fromHex(parts[2]);
  const expectedHex = parts[3];

  const derived = await deriveKey(password, salt, iterations);
  const derivedHex = toHex(derived);

  // Comparaison à temps constant (longueur fixe connue : SHA-256 = 64 chars hex)
  if (derivedHex.length !== expectedHex.length) return false;
  let diff = 0;
  for (let i = 0; i < derivedHex.length; i++) {
    diff |= derivedHex.charCodeAt(i) ^ expectedHex.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Génère un mot de passe temporaire lisible (pour les comptes importés
 * depuis Rapido, qui doivent définir leur propre mot de passe à la
 * première connexion). Évite les caractères ambigus (0/O, 1/l/I).
 */
export function generateTemporaryPassword(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}
