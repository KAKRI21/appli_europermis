// scripts/migrate-legacy-data.ts
//
// Migre les 3 exports CSV Supabase (profiles / students / user_roles) vers
// la nouvelle base Neon/Drizzle.
//
// ⚠️ IMPORTANT — mots de passe : Supabase Auth stocke les mots de passe
// hachés avec son propre algorithme interne, INACCESSIBLE même via le
// service role key. Il est IMPOSSIBLE de migrer les mots de passe existants.
// Ce script génère donc un mot de passe temporaire pour chaque compte migré
// et force `mustResetPassword = true`. Un export CSV séparé
// (credentials-a-distribuer.csv) liste ces mots de passe temporaires — à
// transmettre aux élèves/moniteurs par un canal sécurisé (SMS, remise en
// main propre...), PUIS À SUPPRIMER après distribution.
//
// Usage :
//   DATABASE_URL=postgresql://... npx tsx scripts/migrate-legacy-data.ts \
//     --profiles ./profiles-export.csv \
//     --students ./students-export.csv \
//     --roles ./user_roles-export.csv
//
// Le script est idempotent au niveau "profil" : relancer après une erreur
// partielle ne recrée pas les profils déjà insérés (dédup par ancien id
// Supabase, réutilisé comme id dans la nouvelle table `profiles`).

import { readFileSync, writeFileSync } from "node:fs";
import { db } from "../src/db/client.server";
import { profiles, credentials, students, userRoles } from "../src/db/schema";
import { hashPassword, generateTemporaryPassword } from "../src/lib/auth/password.server";
import { eq } from "drizzle-orm";

async function nephExistsInDb(neph: string): Promise<boolean> {
  const rows = await db.select({ id: students.id }).from(students).where(eq(students.neph, neph)).limit(1);
  return rows.length > 0;
}

type Row = Record<string, string>;

function parseCsv(content: string, delimiter = ";"): Row[] {
  const lines = content.split(/\r\n|\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return [];
  const headers = lines[0].split(delimiter);
  return lines.slice(1).map((line) => {
    const cells = line.split(delimiter);
    const row: Row = {};
    headers.forEach((h, i) => (row[h] = cells[i] ?? ""));
    return row;
  });
}

function getArg(flag: string): string {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || !process.argv[idx + 1]) {
    throw new Error(`Missing required argument ${flag}`);
  }
  return process.argv[idx + 1];
}

async function main() {
  const profilesCsv = parseCsv(readFileSync(getArg("--profiles"), "utf-8"));
  const studentsCsv = parseCsv(readFileSync(getArg("--students"), "utf-8"));
  const rolesCsv = parseCsv(readFileSync(getArg("--roles"), "utf-8"));

  console.log(`Chargé : ${profilesCsv.length} profiles, ${studentsCsv.length} students, ${rolesCsv.length} user_roles`);

  const rolesByUserId = new Map<string, "admin" | "instructor" | "student">();
  for (const r of rolesCsv) {
    // En cas de rôles multiples pour un même user_id, le dernier lu gagne —
    // à ajuster si votre base a des comptes multi-rôles légitimes.
    rolesByUserId.set(r.user_id, r.role as "admin" | "instructor" | "student");
  }

  const studentByUserId = new Map<string, Row>();
  for (const s of studentsCsv) {
    studentByUserId.set(s.user_id, s);
  }

  const credentialsToDistribute: { username: string; email: string; temporaryPassword: string; role: string }[] = [];
  let createdProfiles = 0;
  let skippedNoRole = 0;
  let orphanStudentsWithoutProfile = 0;
  const duplicateNephWarnings: { userId: string; displayName: string; neph: string }[] = [];
  const seenNephs = new Set<string>();

  for (const p of profilesCsv) {
    const role = rolesByUserId.get(p.id);
    if (!role) {
      skippedNoRole++;
      console.warn(`⚠️  Profil ${p.id} (${p.display_name}) n'a aucun rôle dans user_roles — ignoré. À vérifier manuellement.`);
      continue;
    }

    // Idempotence : si ce profil (même ancien id Supabase) existe déjà, on saute.
    const existing = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.id, p.id)).limit(1);
    if (existing.length > 0) continue;

    const studentRow = studentByUserId.get(p.id);
    const username = studentRow?.username || `${(p.first_name || "user").toLowerCase()}.${(p.last_name || p.id.slice(0, 8)).toLowerCase()}`.replace(/[^a-z0-9.]/g, "");
    const email = studentRow?.email || `${username}@migration.europermis.fr`;

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);

    await db.insert(profiles).values({
      id: p.id, // on réutilise l'id Supabase tel quel — cohérent avec les FK dans students/user_roles
      displayName: p.display_name || null,
      firstName: p.first_name || null,
      lastName: p.last_name || null,
      email,
      username,
      createdAt: p.created_at ? new Date(p.created_at) : new Date(),
      updatedAt: p.updated_at ? new Date(p.updated_at) : new Date(),
    });

    await db.insert(credentials).values({
      userId: p.id,
      passwordHash,
      mustResetPassword: true,
    });

    await db.insert(userRoles).values({ userId: p.id, role });

    if (role === "student") {
      if (studentRow) {
        const rawNeph = studentRow.neph?.trim() || "";
        let nephToInsert: string | null = rawNeph || null;

        if (rawNeph && (seenNephs.has(rawNeph) || (await nephExistsInDb(rawNeph)))) {
          // NEPH déjà utilisé — soit par un profil migré plus tôt dans ce
          // run, soit déjà présent en base (ex: run précédent partiel avant
          // correctif). On insère quand même la fiche élève, mais SANS le
          // NEPH (pour ne pas violer la contrainte unique), et on le
          // signale dans le rapport final pour un nettoyage manuel ultérieur.
          duplicateNephWarnings.push({
            userId: p.id,
            displayName: p.display_name || `${studentRow.prenom} ${studentRow.nom}`,
            neph: rawNeph,
          });
          nephToInsert = null;
        } else if (rawNeph) {
          seenNephs.add(rawNeph);
        }

        await db.insert(students).values({
          userId: p.id,
          civilite: studentRow.civilite || null,
          nom: studentRow.nom,
          prenom: studentRow.prenom,
          dateNaissance: studentRow.date_naissance || null,
          lieuNaissance: studentRow.lieu_naissance || null,
          departementNaissance: studentRow.departement_naissance || null,
          paysNaissance: studentRow.pays_naissance || null,
          neph: nephToInsert,
          datePremierPermis: studentRow.date_premier_permis || null,
          pkg: studentRow.pkg || "À définir",
          hours: studentRow.hours || "0/20",
          adresse: studentRow.adresse || null,
          codePostal: studentRow.code_postal || null,
          ville: studentRow.ville || null,
          pays: studentRow.pays || null,
          telephone: studentRow.telephone || null,
          email: studentRow.email || null,
          source: "manual",
        });
      } else {
        // Correspond aux 389 comptes "orphelins" détectés dans l'export
        // (rôle student sans ligne dans la table students). On crée le
        // compte/profil quand même — la fiche élève pourra être complétée
        // plus tard (import Rapido avec le bon NEPH, ou saisie manuelle).
        orphanStudentsWithoutProfile++;
        console.warn(`⚠️  ${p.display_name} (${p.id}) : rôle student sans fiche — compte créé sans fiche élève.`);
      }
    }

    credentialsToDistribute.push({ username, email, temporaryPassword, role });
    createdProfiles++;
  }

  const csvLines = ["username;email;role;temporary_password"];
  for (const c of credentialsToDistribute) {
    csvLines.push(`${c.username};${c.email};${c.role};${c.temporaryPassword}`);
  }
  writeFileSync("./credentials-a-distribuer.csv", csvLines.join("\n"), "utf-8");

  if (duplicateNephWarnings.length > 0) {
    const dupLines = ["user_id;display_name;neph_en_double"];
    for (const d of duplicateNephWarnings) {
      dupLines.push(`${d.userId};${d.displayName};${d.neph}`);
    }
    writeFileSync("./neph-en-double-a-verifier.csv", dupLines.join("\n"), "utf-8");
  }

  console.log("\n=== Résumé ===");
  console.log(`Profils créés     : ${createdProfiles}`);
  console.log(`Ignorés (no role) : ${skippedNoRole}`);
  console.log(`Élèves orphelins  : ${orphanStudentsWithoutProfile} (compte créé, fiche à compléter)`);
  console.log(`NEPH en double    : ${duplicateNephWarnings.length} (compte créé SANS neph, voir ./neph-en-double-a-verifier.csv)`);
  console.log(`\n→ Mots de passe temporaires écrits dans ./credentials-a-distribuer.csv`);
  console.log(`  SÉCURITÉ : distribue ce fichier par un canal sécurisé puis SUPPRIME-le.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });