// src/lib/rapido/identity.ts
// Génération username/email — logique reprise de la convention déjà en
// place dans les données migrées (prenom.nom, domaine eleves.europermis.fr).

export const STUDENT_EMAIL_DOMAIN = "eleves.europermis.fr";
export const INSTRUCTOR_EMAIL_DOMAIN = "moniteurs.europermis.fr";

function stripDiacritics(input: string): string {
  return input.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function slugifyNamePart(input: string): string {
  return stripDiacritics(input)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

/** "BOUCAR GANA" + "ABBA" -> "boucargana.abba" */
export function buildUsername(prenom: string, nom: string): string {
  const p = slugifyNamePart(prenom.split(" ")[0] ?? prenom); // premier prénom si composé
  const n = slugifyNamePart(nom);
  return `${p}.${n}`;
}

export function buildFallbackEmail(username: string, domain: string): string {
  return `${username}@${domain}`;
}

/**
 * Ajoute un suffixe numérique si le username/email de base est déjà pris.
 * `exists` doit interroger la base et retourner true si la valeur est prise.
 */
export async function withUniqueSuffix(
  base: string,
  exists: (candidate: string) => Promise<boolean>,
  buildCandidate: (base: string, suffix: number) => string = (b, s) => `${b}${s}`,
): Promise<string> {
  if (!(await exists(base))) return base;
  for (let suffix = 2; suffix < 1000; suffix++) {
    const candidate = buildCandidate(base, suffix);
    if (!(await exists(candidate))) return candidate;
  }
  throw new Error(`Impossible de générer un identifiant unique pour "${base}" (trop de collisions)`);
}
