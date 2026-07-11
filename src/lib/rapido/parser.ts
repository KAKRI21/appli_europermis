// src/lib/rapido/parser.ts
//
// Parseur pour le format d'export "Dossier de l'élève" de Rapido
// (Codes Rousseau / Planète Permis). Format observé sur un export réel :
// fichier texte, séparateur TABULATION, en-têtes en majuscules, fin de
// ligne CRLF.
//
// Colonnes exactes observées (dans l'ordre) :
//   CIVILITE | NOM USUEL | NOM DE NAISSANCE | ADRESSE | CODE POSTAL | VILLE
//   | PAYS | TELEPHONE 1 | TELEPHONE 2 | TELEPHONE 3 | TELEPHONE 4 | EMAIL
//   | DATE DE NAISSANCE | VILLE DE NAISSANCE | DEPARTEMENT DE NAISSANCE
//   | PAYS DE NAISSANCE | NEPH | DATE PREMIER PERMIS | LIEU PREMIER PERMIS
//
// Règle de split nom/prénom (vérifiée contre les données déjà migrées) :
// "NOM USUEL" contient "NOM PRENOM" — le PREMIER mot est le nom de famille,
// tout le reste est le prénom (gère les prénoms composés du type
// "BOUCAR GANA"). Cette règle a été validée en comparant l'export brut
// Rapido avec les colonnes nom/prenom déjà séparées dans l'export Supabase
// existant (même personnes, même découpage).

export type RawRapidoStudentRow = {
  civilite: string;
  nom: string;
  prenom: string;
  adresse: string;
  codePostal: string;
  ville: string;
  pays: string;
  telephone1: string;
  telephone2: string;
  telephone3: string;
  telephone4: string;
  email: string;
  dateNaissance: string;
  lieuNaissance: string;
  departementNaissance: string;
  paysNaissance: string;
  neph: string;
  datePremierPermis: string;
  lieuPremierPermis: string;
};

export type ParsedRapidoRow = {
  rowNumber: number; // 1-based, hors en-tête
  raw: Record<string, string>; // ligne brute (pour stockage jsonb / debug)
  data: RawRapidoStudentRow | null; // null si erreur de parsing
  error: string | null;
};

const EXPECTED_HEADERS = [
  "CIVILITE",
  "NOM USUEL",
  "NOM DE NAISSANCE",
  "ADRESSE",
  "CODE POSTAL",
  "VILLE",
  "PAYS",
  "TELEPHONE 1",
  "TELEPHONE 2",
  "TELEPHONE 3",
  "TELEPHONE 4",
  "EMAIL",
  "DATE DE NAISSANCE",
  "VILLE DE NAISSANCE",
  "DEPARTEMENT DE NAISSANCE",
  "PAYS DE NAISSANCE",
  "NEPH",
  "DATE PREMIER PERMIS",
  "LIEU PREMIER PERMIS",
] as const;

function splitNomUsuel(nomUsuel: string): { nom: string; prenom: string } {
  const trimmed = nomUsuel.trim().replace(/\s+/g, " ");
  const firstSpace = trimmed.indexOf(" ");
  if (firstSpace === -1) {
    // Un seul mot : on ne peut pas déterminer le prénom, on le laisse vide.
    // Signalé comme erreur par l'appelant (ligne à vérifier manuellement).
    return { nom: trimmed, prenom: "" };
  }
  return {
    nom: trimmed.slice(0, firstSpace),
    prenom: trimmed.slice(firstSpace + 1),
  };
}

/** Valide grossièrement une date JJ/MM/AAAA. Retourne true si vide (champ optionnel) ou valide. */
function isPlausibleFrenchDate(value: string): boolean {
  if (!value.trim()) return true;
  return /^\d{2}\/\d{2}\/\d{4}$/.test(value.trim());
}

export function parseRapidoStudentExport(fileContent: string): {
  rows: ParsedRapidoRow[];
  headerError: string | null;
} {
  // Le fichier peut être en CRLF ou LF selon l'export
  const lines = fileContent.split(/\r\n|\n/).filter((line, idx, arr) => {
    // garder toutes les lignes sauf une dernière ligne vide en fin de fichier
    return !(idx === arr.length - 1 && line.trim() === "");
  });

  if (lines.length === 0) {
    return { rows: [], headerError: "Fichier vide" };
  }

  const header = lines[0].split("\t").map((h) => h.trim());
  const missingHeaders = EXPECTED_HEADERS.filter((h) => !header.includes(h));
  if (missingHeaders.length > 0) {
    return {
      rows: [],
      headerError: `Colonnes manquantes ou format inattendu. Colonnes absentes : ${missingHeaders.join(", ")}. ` +
        `Vérifie que l'export vient bien de Rapido → Dossier de l'élève → Export.`,
    };
  }

  const colIndex = (name: string) => header.indexOf(name);

  const rows: ParsedRapidoRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") continue;

    const cells = line.split("\t");
    const raw: Record<string, string> = {};
    header.forEach((h, idx) => {
      raw[h] = (cells[idx] ?? "").trim();
    });

    const rowNumber = i; // 1-based par rapport aux données (ligne d'en-tête exclue)
    const nomUsuel = raw["NOM USUEL"] ?? "";
    const { nom, prenom } = splitNomUsuel(nomUsuel);

    const errors: string[] = [];
    if (!nom) errors.push("Nom manquant");
    if (!prenom) errors.push(`Impossible de séparer nom/prénom depuis "${nomUsuel}" (un seul mot)`);

    const neph = raw["NEPH"] ?? "";
    // NEPH manquant = pas bloquant (on peut créer le compte quand même) mais
    // signalé, car c'est notre clé de dédup pour les imports suivants.
    if (!neph) errors.push("NEPH manquant — attention, la déduplication ne pourra pas se faire sur ce champ pour cette ligne");

    const dateNaissance = raw["DATE DE NAISSANCE"] ?? "";
    if (!isPlausibleFrenchDate(dateNaissance)) {
      errors.push(`Date de naissance au format inattendu : "${dateNaissance}" (attendu JJ/MM/AAAA)`);
    }

    const email = raw["EMAIL"] ?? "";
    if (email && !email.includes("@")) {
      errors.push(`Email invalide : "${email}"`);
    }

    const blockingError = !nom || !prenom ? errors.join(" ; ") : null;

    rows.push({
      rowNumber,
      raw,
      data: blockingError
        ? null
        : {
            civilite: raw["CIVILITE"] ?? "",
            nom,
            prenom,
            adresse: raw["ADRESSE"] ?? "",
            codePostal: raw["CODE POSTAL"] ?? "",
            ville: raw["VILLE"] ?? "",
            pays: raw["PAYS"] ?? "",
            telephone1: raw["TELEPHONE 1"] ?? "",
            telephone2: raw["TELEPHONE 2"] ?? "",
            telephone3: raw["TELEPHONE 3"] ?? "",
            telephone4: raw["TELEPHONE 4"] ?? "",
            email,
            dateNaissance,
            lieuNaissance: raw["VILLE DE NAISSANCE"] ?? "",
            departementNaissance: raw["DEPARTEMENT DE NAISSANCE"] ?? "",
            paysNaissance: raw["PAYS DE NAISSANCE"] ?? "",
            neph,
            datePremierPermis: raw["DATE PREMIER PERMIS"] ?? "",
            lieuPremierPermis: raw["LIEU PREMIER PERMIS"] ?? "",
          },
      error: errors.length > 0 ? errors.join(" ; ") : null,
    });
  }

  return { rows, headerError: null };
}

// ---------------------------------------------------------------------------
// Import moniteurs : format NON CONFIRMÉ.
//
// Rapido gère les moniteurs mais aucun export d'exemple n'a été fourni pour
// ce projet. Avant d'utiliser importRapidoInstructors (voir import.functions.ts),
// générer un export moniteur depuis Rapido et l'envoyer pour qu'on ajuste ce
// parseur — probablement colonnes NOM / PRENOM / N° AUTORISATION / TELEPHONE
// / EMAIL, mais à vérifier plutôt que de deviner.
// ---------------------------------------------------------------------------
