// src/lib/rapido/import.functions.ts
// Remplace entièrement l'ancien src/lib/rapido.ts (qui était 100% simulé).
//
// Flux : l'admin colle/upload le contenu du fichier d'export Rapido dans
// l'UI → cette server function parse, déduplique (par NEPH), crée les
// comptes manquants et met à jour les existants, puis retourne un rapport
// détaillé (et l'enregistre dans rapido_import_runs / rapido_import_rows
// pour audit).
//
// Sécurité : admin-only (requireRole("admin")).

import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { db } from "@/db/client.server";
import { profiles, credentials, students, userRoles, rapidoImportRuns, rapidoImportRows } from "@/db/schema";
import { requireAuth, requireRole } from "@/lib/auth/middleware.server";
import { hashPassword, generateTemporaryPassword } from "@/lib/auth/password.server";
import { parseRapidoStudentExport } from "./parser";
import { buildUsername, buildFallbackEmail, withUniqueSuffix, STUDENT_EMAIL_DOMAIN } from "./identity";

export type RapidoImportReport = {
  runId: string;
  totalRows: number;
  created: number;
  updated: number;
  skippedErrors: number;
  errors: { rowNumber: number; message: string }[];
  /** Mots de passe temporaires générés pour les NOUVEAUX comptes — à transmettre aux élèves. */
  temporaryCredentials: { username: string; temporaryPassword: string; nom: string; prenom: string }[];
};

async function usernameExists(candidate: string): Promise<boolean> {
  const rows = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.username, candidate)).limit(1);
  return rows.length > 0;
}

async function emailExists(candidate: string): Promise<boolean> {
  const rows = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.email, candidate)).limit(1);
  return rows.length > 0;
}

export const importRapidoStudents = createServerFn({ method: "POST" })
  .middleware([requireAuth, requireRole("admin")])
  .inputValidator((data: unknown): { fileContent: string; fileName: string } => {
    if (!data || typeof data !== "object") throw new Error("Invalid payload");
    const d = data as Record<string, unknown>;
    if (typeof d.fileContent !== "string" || !d.fileContent.trim()) {
      throw new Error("Contenu du fichier manquant ou vide");
    }
    if (typeof d.fileName !== "string") throw new Error("Nom de fichier manquant");
    return { fileContent: d.fileContent, fileName: d.fileName };
  })
  .handler(async ({ data, context }): Promise<RapidoImportReport> => {
    const { rows, headerError } = parseRapidoStudentExport(data.fileContent);
    if (headerError) {
      throw new Error(headerError);
    }

    const [run] = await db
      .insert(rapidoImportRuns)
      .values({
        fileName: data.fileName,
        importedByUserId: context.userId,
        role: "student",
        totalRows: rows.length,
      })
      .returning({ id: rapidoImportRuns.id });

    let created = 0;
    let updated = 0;
    let skippedErrors = 0;
    const errors: { rowNumber: number; message: string }[] = [];
    const temporaryCredentials: RapidoImportReport["temporaryCredentials"] = [];

    for (const row of rows) {
      if (!row.data) {
        skippedErrors++;
        errors.push({ rowNumber: row.rowNumber, message: row.error ?? "Erreur inconnue" });
        await db.insert(rapidoImportRows).values({
          runId: run.id,
          rowNumber: row.rowNumber,
          status: "error",
          rawData: row.raw,
          errorMessage: row.error,
        });
        continue;
      }

      const r = row.data;

      try {
        // --- Dédup par NEPH (si présent) ---
        const existingByNeph = r.neph
          ? await db.select().from(students).where(eq(students.neph, r.neph)).limit(1)
          : [];

        if (existingByNeph.length > 0) {
          // Mise à jour d'un élève existant — on NE touche PAS au compte
          // (username/email/mot de passe) : seulement les données Rapido.
          const existing = existingByNeph[0];
          await db
            .update(students)
            .set({
              civilite: r.civilite,
              nom: r.nom,
              prenom: r.prenom,
              dateNaissance: r.dateNaissance,
              lieuNaissance: r.lieuNaissance,
              departementNaissance: r.departementNaissance,
              paysNaissance: r.paysNaissance,
              datePremierPermis: r.datePremierPermis,
              lieuPremierPermis: r.lieuPremierPermis,
              adresse: r.adresse,
              codePostal: r.codePostal,
              ville: r.ville,
              pays: r.pays,
              telephone: r.telephone1,
              telephone2: r.telephone2,
              telephone3: r.telephone3,
              telephone4: r.telephone4,
              updatedAt: new Date(),
            })
            .where(eq(students.id, existing.id));

          updated++;
          await db.insert(rapidoImportRows).values({
            runId: run.id,
            rowNumber: row.rowNumber,
            status: "updated",
            rawData: row.raw,
            resultUserId: existing.userId,
          });
          continue;
        }

        // --- Nouveau compte ---
        const baseUsername = buildUsername(r.prenom, r.nom);
        const username = await withUniqueSuffix(baseUsername, usernameExists);

        let email = r.email;
        if (!email || (await emailExists(email))) {
          const fallback = buildFallbackEmail(username, STUDENT_EMAIL_DOMAIN);
          email = (await emailExists(fallback)) ? await withUniqueSuffix(fallback, emailExists) : fallback;
        }

        const temporaryPassword = generateTemporaryPassword();
        const passwordHash = await hashPassword(temporaryPassword);

        const [profile] = await db
          .insert(profiles)
          .values({
            displayName: `${r.prenom} ${r.nom}`.trim(),
            firstName: r.prenom,
            lastName: r.nom,
            email,
            username,
          })
          .returning({ id: profiles.id });

        await db.insert(credentials).values({
          userId: profile.id,
          passwordHash,
          mustResetPassword: true,
        });

        await db.insert(userRoles).values({ userId: profile.id, role: "student" });

        await db.insert(students).values({
          userId: profile.id,
          civilite: r.civilite,
          nom: r.nom,
          prenom: r.prenom,
          dateNaissance: r.dateNaissance,
          lieuNaissance: r.lieuNaissance,
          departementNaissance: r.departementNaissance,
          paysNaissance: r.paysNaissance,
          neph: r.neph || null,
          datePremierPermis: r.datePremierPermis,
          lieuPremierPermis: r.lieuPremierPermis,
          adresse: r.adresse,
          codePostal: r.codePostal,
          ville: r.ville,
          pays: r.pays,
          telephone: r.telephone1,
          telephone2: r.telephone2,
          telephone3: r.telephone3,
          telephone4: r.telephone4,
          email,
          source: "rapido",
        });

        created++;
        temporaryCredentials.push({ username, temporaryPassword, nom: r.nom, prenom: r.prenom });
        await db.insert(rapidoImportRows).values({
          runId: run.id,
          rowNumber: row.rowNumber,
          status: "created",
          rawData: row.raw,
          resultUserId: profile.id,
        });
      } catch (e) {
        skippedErrors++;
        const message = e instanceof Error ? e.message : String(e);
        errors.push({ rowNumber: row.rowNumber, message });
        await db.insert(rapidoImportRows).values({
          runId: run.id,
          rowNumber: row.rowNumber,
          status: "error",
          rawData: row.raw,
          errorMessage: message,
        });
      }
    }

    await db
      .update(rapidoImportRuns)
      .set({
        createdCount: created,
        updatedCount: updated,
        skippedCount: skippedErrors,
        errorCount: errors.length,
        finishedAt: new Date(),
      })
      .where(eq(rapidoImportRuns.id, run.id));

    return {
      runId: run.id,
      totalRows: rows.length,
      created,
      updated,
      skippedErrors,
      errors,
      temporaryCredentials,
    };
  });

// ---------------------------------------------------------------------------
// importRapidoInstructors : à écrire une fois le format d'export moniteur
// confirmé (voir note en bas de parser.ts). La structure sera identique à
// importRapidoStudents ci-dessus, ciblant la table `instructors`.
// ---------------------------------------------------------------------------
