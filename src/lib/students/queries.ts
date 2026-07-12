// src/lib/students/queries.ts
// Couche de données élèves partagée par student.tsx / instructor.tsx / admin.tsx.
// Remplace les lectures/écritures localStorage de l'ancien src/lib/local-auth.ts.

import { createServerFn } from "@tanstack/react-start";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client.server";
import { profiles, students, credentials, userRoles } from "@/db/schema";
import { requireAuth, requireRole } from "@/lib/auth/middleware.server";
import { generateTemporaryPassword, hashPassword } from "@/lib/auth/password.server";
import { buildUsername, buildFallbackEmail, withUniqueSuffix, STUDENT_EMAIL_DOMAIN } from "@/lib/rapido/identity";

export type StudentRecord = {
  id: string;
  userId: string;
  username: string;
  civilite: string | null;
  nom: string;
  prenom: string;
  dateNaissance: string | null;
  lieuNaissance: string | null;
  departementNaissance: string | null;
  paysNaissance: string | null;
  neph: string | null;
  datePremierPermis: string | null;
  lieuPremierPermis: string | null;
  pkg: string | null;
  hours: string | null;
  adresse: string | null;
  codePostal: string | null;
  ville: string | null;
  pays: string | null;
  telephone: string | null;
  email: string | null;
  source: "seed" | "manual" | "rapido";
  createdAt: Date;
};

/** Élève connecté : sa propre fiche uniquement. */
export const getMyStudentProfile = createServerFn({ method: "GET" })
  .middleware([requireAuth, requireRole("student")])
  .handler(async ({ context }): Promise<StudentRecord | null> => {
    const rows = await db
      .select({
        id: students.id,
        userId: students.userId,
        username: profiles.username,
        civilite: students.civilite,
        nom: students.nom,
        prenom: students.prenom,
        dateNaissance: students.dateNaissance,
        lieuNaissance: students.lieuNaissance,
        departementNaissance: students.departementNaissance,
        paysNaissance: students.paysNaissance,
        neph: students.neph,
        datePremierPermis: students.datePremierPermis,
        lieuPremierPermis: students.lieuPremierPermis,
        pkg: students.pkg,
        hours: students.hours,
        adresse: students.adresse,
        codePostal: students.codePostal,
        ville: students.ville,
        pays: students.pays,
        telephone: students.telephone,
        email: students.email,
        source: students.source,
        createdAt: students.createdAt,
      })
      .from(students)
      .innerJoin(profiles, eq(profiles.id, students.userId))
      .where(eq(students.userId, context.userId))
      .limit(1);

    return rows[0] ?? null;
  });

/** Admin + moniteur : liste complète (lecture). */
export const listStudents = createServerFn({ method: "GET" })
  .middleware([requireAuth, requireRole("admin", "instructor")])
  .handler(async (): Promise<StudentRecord[]> => {
    const rows = await db
      .select({
        id: students.id,
        userId: students.userId,
        username: profiles.username,
        civilite: students.civilite,
        nom: students.nom,
        prenom: students.prenom,
        dateNaissance: students.dateNaissance,
        lieuNaissance: students.lieuNaissance,
        departementNaissance: students.departementNaissance,
        paysNaissance: students.paysNaissance,
        neph: students.neph,
        datePremierPermis: students.datePremierPermis,
        lieuPremierPermis: students.lieuPremierPermis,
        pkg: students.pkg,
        hours: students.hours,
        adresse: students.adresse,
        codePostal: students.codePostal,
        ville: students.ville,
        pays: students.pays,
        telephone: students.telephone,
        email: students.email,
        source: students.source,
        createdAt: students.createdAt,
      })
      .from(students)
      .innerJoin(profiles, eq(profiles.id, students.userId));

    return rows;
  });

/** Admin uniquement : supprime un élève (profil + fiche + credentials, cascade). */
export const deleteStudent = createServerFn({ method: "POST" })
  .middleware([requireAuth, requireRole("admin")])
  .inputValidator((data: unknown): { userId: string } => {
    if (!data || typeof data !== "object" || typeof (data as Record<string, unknown>).userId !== "string") {
      throw new Error("userId requis");
    }
    return { userId: (data as Record<string, unknown>).userId as string };
  })
  .handler(async ({ data }) => {
    // ON DELETE CASCADE sur profiles supprime aussi credentials/students/user_roles.
    await db.delete(profiles).where(eq(profiles.id, data.userId));
    return { ok: true };
  });

/** Admin uniquement : réinitialise le mot de passe d'un élève (nouveau mot de passe temporaire). */
export const resetStudentPassword = createServerFn({ method: "POST" })
  .middleware([requireAuth, requireRole("admin")])
  .inputValidator((data: unknown): { userId: string } => {
    if (!data || typeof data !== "object" || typeof (data as Record<string, unknown>).userId !== "string") {
      throw new Error("userId requis");
    }
    return { userId: (data as Record<string, unknown>).userId as string };
  })
  .handler(async ({ data }) => {
    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);
    await db
      .update(credentials)
      .set({ passwordHash, mustResetPassword: true, updatedAt: new Date() })
      .where(eq(credentials.userId, data.userId));
    return { ok: true, temporaryPassword };
  });

/** Ligne générique pour l'import manuel (onglet JSON/CSV de l'admin). */
export type ManualStudentRow = {
  civilite: string;
  nom: string;
  prenom: string;
  dateNaissance: string;
  lieuNaissance: string;
  neph: string;
  adresse: string;
  codePostal: string;
  ville: string;
  pays: string;
  telephone: string;
  email: string;
  departementNaissance: string;
  paysNaissance: string;
  datePremierPermis: string;
};

async function usernameExists(candidate: string): Promise<boolean> {
  const rows = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.username, candidate)).limit(1);
  return rows.length > 0;
}

async function emailExists(candidate: string): Promise<boolean> {
  const rows = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.email, candidate)).limit(1);
  return rows.length > 0;
}

/**
 * Admin uniquement : import manuel par lot (onglet JSON/CSV). Contrairement
 * à importRapidoStudents (qui exige le format exact de l'export Rapido),
 * cette fonction accepte des lignes déjà structurées et est plus tolérante.
 * Déduplique par NEPH quand il est renseigné, comme l'import Rapido.
 */
export const createStudentsFromRows = createServerFn({ method: "POST" })
  .middleware([requireAuth, requireRole("admin")])
  .inputValidator((data: unknown): { rows: ManualStudentRow[] } => {
    if (!data || typeof data !== "object" || !Array.isArray((data as Record<string, unknown>).rows)) {
      throw new Error("rows requis (tableau)");
    }
    return { rows: (data as { rows: ManualStudentRow[] }).rows };
  })
  .handler(async ({ data }) => {
    let created = 0;
    let skippedDuplicate = 0;
    const errors: { index: number; message: string }[] = [];
    const temporaryCredentials: { username: string; temporaryPassword: string; nom: string; prenom: string }[] = [];

    for (let i = 0; i < data.rows.length; i++) {
      const r = data.rows[i];
      try {
        if (r.neph) {
          const existing = await db.select({ id: students.id }).from(students).where(eq(students.neph, r.neph)).limit(1);
          if (existing.length > 0) {
            skippedDuplicate++;
            continue;
          }
        }

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

        await db.insert(credentials).values({ userId: profile.id, passwordHash, mustResetPassword: true });
        await db.insert(userRoles).values({ userId: profile.id, role: "student" });
        await db.insert(students).values({
          userId: profile.id,
          civilite: r.civilite,
          nom: r.nom,
          prenom: r.prenom,
          dateNaissance: r.dateNaissance || null,
          lieuNaissance: r.lieuNaissance || null,
          departementNaissance: r.departementNaissance || null,
          paysNaissance: r.paysNaissance || null,
          neph: r.neph || null,
          datePremierPermis: r.datePremierPermis || null,
          adresse: r.adresse || null,
          codePostal: r.codePostal || null,
          ville: r.ville || null,
          pays: r.pays || null,
          telephone: r.telephone || null,
          email: r.email || null,
          source: "manual",
        });

        created++;
        temporaryCredentials.push({ username, temporaryPassword, nom: r.nom, prenom: r.prenom });
      } catch (e) {
        errors.push({ index: i, message: e instanceof Error ? e.message : String(e) });
      }
    }

    return { created, skippedDuplicate, errors, temporaryCredentials };
  });

/**
 * Admin uniquement : supprime TOUS les comptes élèves (irréversible).
 * Les comptes admin/instructor ne sont pas touchés.
 */
export const resetAllStudents = createServerFn({ method: "POST" })
  .middleware([requireAuth, requireRole("admin")])
  .handler(async () => {
    const studentUserIds = (
      await db.select({ userId: userRoles.userId }).from(userRoles).where(eq(userRoles.role, "student"))
    ).map((r) => r.userId);

    if (studentUserIds.length === 0) return { deleted: 0 };

    // ON DELETE CASCADE sur profiles supprime credentials/students/user_roles associés.
    await db.delete(profiles).where(inArray(profiles.id, studentUserIds));
    return { deleted: studentUserIds.length };
  });
