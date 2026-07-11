// src/lib/auth/auth.functions.ts
// Remplace src/lib/supabase-auth.ts + src/lib/auth.functions.ts (ancien, Supabase)

import { createServerFn } from "@tanstack/react-start";
import { eq, or } from "drizzle-orm";
import { db } from "@/db/client.server";
import { profiles, credentials, userRoles } from "@/db/schema";
import { verifyPassword, hashPassword } from "./password.server";
import { createSession, destroySession, getSession } from "./session.server";
import { requireAuth } from "./middleware.server";
import type { CurrentUser } from "./types";

function normalize(input: string) {
  return input.trim().toLowerCase();
}

export const login = createServerFn({ method: "POST" })
  .inputValidator((data: unknown): { usernameOrEmail: string; password: string } => {
    if (!data || typeof data !== "object") throw new Error("Invalid payload");
    const d = data as Record<string, unknown>;
    if (typeof d.usernameOrEmail !== "string" || !d.usernameOrEmail.trim()) {
      throw new Error("Identifiant requis");
    }
    if (typeof d.password !== "string" || !d.password) {
      throw new Error("Mot de passe requis");
    }
    return { usernameOrEmail: d.usernameOrEmail, password: d.password };
  })
  .handler(async ({ data }): Promise<{ ok: true; user: CurrentUser } | { ok: false; error: string }> => {
    const identifier = normalize(data.usernameOrEmail);

    const rows = await db
      .select({
        userId: profiles.id,
        username: profiles.username,
        email: profiles.email,
        displayName: profiles.displayName,
        passwordHash: credentials.passwordHash,
        mustResetPassword: credentials.mustResetPassword,
      })
      .from(profiles)
      .innerJoin(credentials, eq(credentials.userId, profiles.id))
      .where(or(eq(profiles.username, identifier), eq(profiles.email, identifier)))
      .limit(1);

    const row = rows[0];
    if (!row) {
      // Message volontairement identique au cas "mauvais mot de passe" —
      // ne pas révéler si l'identifiant existe (évite l'énumération de comptes).
      return { ok: false, error: "Identifiant ou mot de passe incorrect." };
    }

    const validPassword = await verifyPassword(data.password, row.passwordHash);
    if (!validPassword) {
      return { ok: false, error: "Identifiant ou mot de passe incorrect." };
    }

    const roleRows = await db
      .select({ role: userRoles.role })
      .from(userRoles)
      .where(eq(userRoles.userId, row.userId))
      .limit(1);

    const role = roleRows[0]?.role;
    if (!role) {
      return { ok: false, error: "Ce compte n'a aucun rôle assigné. Contactez le secrétariat." };
    }

    await createSession({ userId: row.userId, role, username: row.username });

    await db
      .update(credentials)
      .set({ lastLoginAt: new Date() })
      .where(eq(credentials.userId, row.userId));

    return {
      ok: true,
      user: {
        userId: row.userId,
        username: row.username,
        role,
        displayName: row.displayName ?? row.username,
      },
    };
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  destroySession();
  return { ok: true };
});

export const getCurrentUser = createServerFn({ method: "GET" }).handler(
  async (): Promise<CurrentUser | null> => {
    const session = await getSession();
    if (!session) return null;

    const rows = await db
      .select({ displayName: profiles.displayName })
      .from(profiles)
      .where(eq(profiles.id, session.userId))
      .limit(1);

    return {
      userId: session.userId,
      username: session.username,
      role: session.role,
      displayName: rows[0]?.displayName ?? session.username,
    };
  },
);

export const changeOwnPassword = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: unknown): { currentPassword: string; newPassword: string } => {
    if (!data || typeof data !== "object") throw new Error("Invalid payload");
    const d = data as Record<string, unknown>;
    if (typeof d.currentPassword !== "string") throw new Error("Mot de passe actuel requis");
    if (typeof d.newPassword !== "string" || d.newPassword.length < 8) {
      throw new Error("Le nouveau mot de passe doit faire au moins 8 caractères");
    }
    return { currentPassword: d.currentPassword, newPassword: d.newPassword };
  })
  .handler(async ({ data, context }) => {
    const rows = await db
      .select({ passwordHash: credentials.passwordHash })
      .from(credentials)
      .where(eq(credentials.userId, context.userId))
      .limit(1);

    const current = rows[0];
    if (!current || !(await verifyPassword(data.currentPassword, current.passwordHash))) {
      throw new Error("Mot de passe actuel incorrect");
    }

    const newHash = await hashPassword(data.newPassword);
    await db
      .update(credentials)
      .set({ passwordHash: newHash, mustResetPassword: false, updatedAt: new Date() })
      .where(eq(credentials.userId, context.userId));

    return { ok: true };
  });
