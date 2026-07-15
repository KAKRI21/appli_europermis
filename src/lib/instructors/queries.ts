// src/lib/instructors/queries.ts
// Gestion des comptes moniteurs — admin uniquement.

import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { db } from "@/db/client.server";
import { profiles, credentials, instructors, userRoles } from "@/db/schema";
import { requireAuth, requireRole } from "@/lib/auth/middleware.server";
import { generateTemporaryPassword, hashPassword } from "@/lib/auth/password.server";
import { buildUsername, buildFallbackEmail, withUniqueSuffix, INSTRUCTOR_EMAIL_DOMAIN } from "@/lib/rapido/identity";

export type InstructorRecord = {
  id: string;
  userId: string;
  username: string;
  nom: string;
  prenom: string;
  numeroAutorisation: string | null;
  telephone: string | null;
  email: string | null;
  actif: boolean;
  createdAt: Date;
};

async function usernameExists(candidate: string): Promise<boolean> {
  const rows = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.username, candidate)).limit(1);
  return rows.length > 0;
}

async function emailExists(candidate: string): Promise<boolean> {
  const rows = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.email, candidate)).limit(1);
  return rows.length > 0;
}

export const listInstructors = createServerFn({ method: "GET" })
  .middleware([requireAuth, requireRole("admin", "instructor")])
  .handler(async (): Promise<InstructorRecord[]> => {
    const rows = await db
      .select({
        id: instructors.id,
        userId: instructors.userId,
        username: profiles.username,
        nom: instructors.nom,
        prenom: instructors.prenom,
        numeroAutorisation: instructors.numeroAutorisation,
        telephone: instructors.telephone,
        email: instructors.email,
        actif: instructors.actif,
        createdAt: instructors.createdAt,
      })
      .from(instructors)
      .innerJoin(profiles, eq(profiles.id, instructors.userId));

    return rows;
  });

export type CreateInstructorInput = {
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  numeroAutorisation: string;
};

/** Admin uniquement : crée un compte moniteur (profil + identifiants + rôle + fiche). */
export const createInstructor = createServerFn({ method: "POST" })
  .middleware([requireAuth, requireRole("admin")])
  .inputValidator((data: unknown): CreateInstructorInput => {
    if (!data || typeof data !== "object") throw new Error("Payload invalide");
    const d = data as Record<string, unknown>;
    if (typeof d.nom !== "string" || !d.nom.trim()) throw new Error("Nom requis");
    if (typeof d.prenom !== "string" || !d.prenom.trim()) throw new Error("Prénom requis");
    return {
      nom: d.nom.trim(),
      prenom: d.prenom.trim(),
      email: typeof d.email === "string" ? d.email.trim() : "",
      telephone: typeof d.telephone === "string" ? d.telephone.trim() : "",
      numeroAutorisation: typeof d.numeroAutorisation === "string" ? d.numeroAutorisation.trim() : "",
    };
  })
  .handler(async ({ data }): Promise<{ username: string; temporaryPassword: string }> => {
    const baseUsername = buildUsername(data.prenom, data.nom);
    const username = await withUniqueSuffix(baseUsername, usernameExists);

    let email = data.email;
    if (!email || (await emailExists(email))) {
      const fallback = buildFallbackEmail(username, INSTRUCTOR_EMAIL_DOMAIN);
      email = (await emailExists(fallback)) ? await withUniqueSuffix(fallback, emailExists) : fallback;
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);

    const [profile] = await db
      .insert(profiles)
      .values({
        displayName: `${data.prenom} ${data.nom}`.trim(),
        firstName: data.prenom,
        lastName: data.nom,
        email,
        username,
      })
      .returning({ id: profiles.id });

    await db.insert(credentials).values({ userId: profile.id, passwordHash, mustResetPassword: true });
    await db.insert(userRoles).values({ userId: profile.id, role: "instructor" });
    await db.insert(instructors).values({
      userId: profile.id,
      nom: data.nom,
      prenom: data.prenom,
      numeroAutorisation: data.numeroAutorisation || null,
      telephone: data.telephone || null,
      email: data.email || null,
      source: "manual",
    });

    return { username, temporaryPassword };
  });

/** Admin uniquement : supprime un compte moniteur. */
export const deleteInstructor = createServerFn({ method: "POST" })
  .middleware([requireAuth, requireRole("admin")])
  .inputValidator((data: unknown): { userId: string } => {
    if (!data || typeof data !== "object" || typeof (data as Record<string, unknown>).userId !== "string") {
      throw new Error("userId requis");
    }
    return { userId: (data as Record<string, unknown>).userId as string };
  })
  .handler(async ({ data }) => {
    await db.delete(profiles).where(eq(profiles.id, data.userId));
    return { ok: true };
  });
